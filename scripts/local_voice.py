"""Generate AI Tavern's cast and serve Qwen3-TTS on the local machine."""

import argparse
import gc
import io
import json
import os
import re
import statistics
import threading
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "voice-data"
AUDIO = ROOT / "public" / "audio"
VOICE_ID = re.compile(r"[a-z0-9_-]{1,64}")
PILOT = {"eileen", "old_tom"}
DESIGN = "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign"
BASE = "Qwen/Qwen3-TTS-12Hz-0.6B-Base"
os.environ.setdefault("HF_HOME", str(ROOT / ".voice-models"))
os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")


def load_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_atomic(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_bytes(data)
    temporary.replace(path)


def write_json(path, value):
    write_atomic(path, (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode())


def load_model(repo, device):
    os.environ["HF_HUB_OFFLINE"] = "1"
    import torch
    from qwen_tts import Qwen3TTSModel

    if device == "auto":
        needed = (5 if repo == DESIGN else 2.5) * 1024**3
        device = "cuda" if torch.cuda.is_available() and torch.cuda.mem_get_info()[0] > needed else "cpu"
    if device == "cpu":
        torch.set_num_threads(min(8, os.cpu_count() or 1))
    print(f"Loading {repo} on {device}", flush=True)
    dtype = torch.bfloat16 if device == "cuda" else torch.float32
    return Qwen3TTSModel.from_pretrained(
        repo, device_map="cuda:0" if device == "cuda" else "cpu",
        dtype=dtype, attn_implementation="sdpa", local_files_only=True,
    )


def audio_bytes(audio, rate, format):
    import numpy as np
    import soundfile as sf

    if not len(audio) or not np.isfinite(audio).all():
        raise RuntimeError("The model produced empty or silent audio.")
    peak = float(np.max(np.abs(audio)))
    if peak < 0.005:
        raise RuntimeError("The model produced silent audio.")
    if peak > 0.98:
        audio = audio * (0.98 / peak)
    with io.BytesIO() as buffer:
        sf.write(buffer, audio, rate, format=format)
        return buffer.getvalue()


def prepare_references(voices, device):
    missing = []
    for voice in voices:
        directory = DATA / voice["id"]
        audio, transcript = directory / "reference.wav", directory / "reference.txt"
        if not audio.is_file() or not transcript.is_file():
            missing.append((voice, audio, transcript))
    if not missing:
        return
    model = load_model(DESIGN, device)
    for voice, audio, transcript in missing:
        wavs, rate = model.generate_voice_design(
            text=voice["reference"], language="Chinese", instruct=voice["direction"],
        )
        write_atomic(audio, audio_bytes(wavs[0], rate, "WAV"))
        write_atomic(transcript, (voice["reference"] + "\n").encode())
        print(f"Reference ready: {voice['id']}", flush=True)
    del model
    gc.collect()
    import torch
    if torch.cuda.is_available():
        torch.cuda.empty_cache()


class Synthesizer:
    def __init__(self, device):
        self.model = load_model(BASE, device)
        self.prompts = {}

    def synthesize(self, voice_id, text, format):
        directory = DATA / voice_id
        audio, transcript = directory / "reference.wav", directory / "reference.txt"
        if not audio.is_file() or not transcript.is_file():
            raise FileNotFoundError(voice_id)
        stamp = (audio.stat().st_mtime_ns, transcript.stat().st_mtime_ns)
        previous = self.prompts.get(voice_id)
        if previous is None or previous[0] != stamp:
            prompt = self.model.create_voice_clone_prompt(
                ref_audio=str(audio), ref_text=transcript.read_text(encoding="utf-8").strip(),
            )
            self.prompts[voice_id] = (stamp, prompt)
        wavs, rate = self.model.generate_voice_clone(
            text=text, language="Chinese", voice_clone_prompt=self.prompts[voice_id][1],
        )
        return audio_bytes(wavs[0], rate, format)


def make_samples(engine, voice):
    voice_id = voice["id"]
    for kind in ("sample", "danger"):
        if kind in voice:
            synthesize_clip(engine, voice_id, voice[kind], AUDIO / "voices" / voice_id / (kind + ".mp3"))


def synthesize_clip(engine, voice_id, text, path):
    started = time.perf_counter()
    write_atomic(path, engine.synthesize(voice_id, text, "MP3"))
    print(f"{path.relative_to(ROOT)} — {time.perf_counter() - started:.2f}s", flush=True)


def make_pack(engine):
    lines = load_json(ROOT / "lib" / "voiceLines.json")
    # Finish every line before replacing the existing Eileen recordings.
    replacements = []
    for group, prefix in (("greetings", ""), ("commissions", "commission-"), ("lessons", "lesson-")):
        for line_id, text in lines[group].items():
            data = engine.synthesize("eileen", text, "MP3")
            replacements.append((AUDIO / "eileen" / (prefix + line_id + ".mp3"), data))
            print(f"Prepared Eileen: {prefix}{line_id}", flush=True)
    for line_id, text in lines["tavern"].items():
        data = engine.synthesize("old_tom", text, "MP3")
        replacements.append((AUDIO / "voices" / "old_tom" / (line_id + ".mp3"), data))
        print(f"Prepared Old Tom: {line_id}", flush=True)
    for path, data in replacements:
        write_atomic(path, data)


def serve(engine):
    gate = threading.Lock()

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            if self.path != "/synthesize" or self.headers.get("Host") != "127.0.0.1:8765":
                self.send_error(404)
                return
            try:
                self.connection.settimeout(5)
                length = int(self.headers.get("Content-Length", "0"))
                if not 1 <= length <= 8192 or self.headers.get_content_type() != "application/json":
                    raise ValueError("Invalid request")
                payload = json.loads(self.rfile.read(length))
                voice_id, text = payload["voiceId"], payload["text"]
                if not VOICE_ID.fullmatch(voice_id) or not isinstance(text, str) or not text.strip() or len(text) > 500:
                    raise ValueError("Invalid dialogue")
            except (ValueError, TypeError, KeyError, TimeoutError):
                self.send_error(400)
                return
            if not gate.acquire(blocking=False):
                self.send_error(503, "Voice synthesis busy")
                return
            try:
                data = engine.synthesize(voice_id, text.strip(), "WAV")
            except FileNotFoundError:
                self.send_error(404, "Voice unavailable")
                return
            except RuntimeError as error:
                self.log_error("Synthesis failed: %s", error)
                self.send_error(503, "Voice synthesis failed")
                return
            finally:
                gate.release()
            try:
                self.send_response(200)
                self.send_header("Content-Type", "audio/wav")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
            except (ConnectionError, TimeoutError):
                pass  # The player skipped the line while it was being generated.

    with ThreadingHTTPServer(("127.0.0.1", 8765), Handler) as server:
        print("AI Tavern voice service: http://127.0.0.1:8765", flush=True)
        server.serve_forever()


def benchmark(port):
    url = f"http://127.0.0.1:{port}/api/voice"
    client = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    warmup_and_lines = [
        ("eileen", "我去把炉火拨旺一点，你先坐。"),
        ("eileen", "烛台放低一点。墙边有人留下了记号。"),
        ("old_tom", "门闩卡住了。来，咱们一块儿把它抬起来。"),
        ("eileen", "雨小了。等石阶干一点，我们就出发。"),
        ("old_tom", "你们先把马牵进去，我再去敲钟。"),
    ]
    times = []
    write_json(DATA / "benchmark.json", {"autoplay": False})
    for index, (voice_id, text) in enumerate(warmup_and_lines):
        request = urllib.request.Request(url, json.dumps({"characterId": voice_id, "text": text}).encode(),
                                         headers={"Content-Type": "application/json"})
        started = time.perf_counter()
        with client.open(request, timeout=21) as response:
            if response.headers.get_content_type() != "audio/wav" or not response.read().startswith(b"RIFF"):
                raise RuntimeError("The route did not return playable WAV audio.")
        elapsed = time.perf_counter() - started
        print(f"{'Warm-up' if index == 0 else voice_id}: {elapsed:.2f}s", flush=True)
        if index:
            times.append(elapsed)
    # Leave half a second for browser decoding and starting the sound device.
    result = {"seconds": [round(value, 2) for value in times],
              "medianSeconds": round(statistics.median(times), 2), "autoplay": max(times) <= 4.5}
    write_json(DATA / "benchmark.json", result)
    print(result)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--device", choices=("auto", "cuda", "cpu"), default="auto")
    commands = parser.add_subparsers(dest="command", required=True)
    for name in ("download", "pilot", "pack", "serve"):
        commands.add_parser(name)
    measure = commands.add_parser("benchmark")
    measure.add_argument("--port", type=int, default=8080)
    add = commands.add_parser("add")
    for name in ("id", "name", "direction", "reference", "sample"):
        add.add_argument("--" + name, required=True)
    args = parser.parse_args()
    cast = load_json(ROOT / "lib" / "voiceCast.json")
    if args.command == "download":
        from huggingface_hub import snapshot_download
        for repo in (DESIGN, BASE):
            snapshot_download(repo, allow_patterns=["*.json", "*.safetensors", "*.txt", "*.tiktoken", "LICENSE"])
    elif args.command == "serve":
        serve(Synthesizer(args.device))
    elif args.command == "benchmark":
        benchmark(args.port)
    elif args.command == "add":
        if (not VOICE_ID.fullmatch(args.id) or any(voice["id"] == args.id for voice in cast)
                or (DATA / args.id / "profile.json").exists()):
            parser.error("Choose an unused voice id (lowercase letters, digits, hyphen or underscore).")
        if not args.sample.strip() or len(args.sample) > 500 or not args.name.strip():
            parser.error("A display name and a sample of 1–500 characters are required.")
        voice = {key: getattr(args, key) for key in ("id", "name", "direction", "reference", "sample")}
        prepare_references([voice], args.device)
        make_samples(Synthesizer(args.device), voice)
        write_json(DATA / args.id / "profile.json", {
            "name": args.name, "sample": args.sample, "description": args.direction,
        })
    else:
        if args.command == "pack" and any(not (AUDIO / "voices" / voice / clip).is_file()
                                         for voice in PILOT for clip in ("sample.mp3", "danger.mp3")):
            parser.error("Run and audition the two pilot voices before making the full pack.")
        voices = cast if args.command == "pack" else [voice for voice in cast if voice["id"] in PILOT]
        prepare_references(voices, args.device)
        engine = Synthesizer(args.device)
        for voice in voices:
            if args.command == "pilot" or voice["id"] not in PILOT:
                make_samples(engine, voice)
        if args.command == "pack":
            make_pack(engine)


if __name__ == "__main__":
    main()
