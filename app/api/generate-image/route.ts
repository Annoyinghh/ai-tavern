// ============================================================
// AI 酒馆 - 在线 AI 二次元图像生成 API
// POST /api/generate-image
// 通过 Pollinations.ai / Flux 在线 AI 绘图 Web 接口实时生成画作
// ============================================================

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { prompt, seed, width = 512, height = 768 } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: '缺少提示词 prompt' }, { status: 400 });
    }

    const randomSeed = seed || Math.floor(Math.random() * 1000000);
    const encodedPrompt = encodeURIComponent(
      `${prompt}, high quality anime visual novel bust portrait, masterwork anime illustration, Genshin Impact aesthetic, sharp details, vibrant coloring`
    );

    // 调用 Web 在线 AI 绘图端点
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&nologo=true&seed=${randomSeed}`;

    return NextResponse.json({
      success: true,
      imageUrl,
      seed: randomSeed,
      prompt,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '未知错误';
    return NextResponse.json({ error: 'AI 图像生成失败', detail: msg }, { status: 500 });
  }
}
