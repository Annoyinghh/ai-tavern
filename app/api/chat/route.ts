import OpenAI from 'openai';
import { buildDirectorPrompt, cleanNarration, fallbackDirector, parseDirectorResponse, validateDirectorContext, type DirectorContext } from '../../../lib/adventure';

interface Message { role: 'system' | 'user' | 'assistant' | 'narrator' | 'player' | 'dice'; content: string }
interface Settings { apiKey?: string; baseUrl?: string; model?: string; temperature?: number }

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('请求格式无效');
  return value as Record<string, unknown>;
}
function readMessages(input: unknown): Message[] {
  if (input === undefined) return [];
  if (!Array.isArray(input) || input.length > 60) throw new Error('消息数量无效');
  const messages = input.map(v => {
    const m = object(v);
    if (!['system', 'user', 'assistant', 'narrator', 'player', 'dice'].includes(m.role as string) || typeof m.content !== 'string' || m.content.length > 12000) throw new Error('消息格式或角色无效');
    return { role: m.role as Message['role'], content: m.content };
  });
  if (messages.reduce((n, m) => n + m.content.length, 0) > 60000) throw new Error('消息上下文过长');
  return messages;
}
function readSettings(value: unknown): Settings {
  if (value === undefined || value === null) return {};
  const settings = object(value);
  for (const key of ['apiKey', 'baseUrl', 'model']) {
    if (settings[key] !== undefined && (typeof settings[key] !== 'string' || (settings[key] as string).length > (key === 'apiKey' ? 8192 : 2048))) throw new Error('模型设置无效');
  }
  if (settings.temperature !== undefined && (typeof settings.temperature !== 'number' || !Number.isFinite(settings.temperature) || settings.temperature < 0 || settings.temperature > 2)) throw new Error('温度设置必须为0至2');
  if (settings.baseUrl) {
    const url = new URL(settings.baseUrl as string);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('API地址必须为HTTP或HTTPS');
  }
  return settings as Settings;
}

function providerFailure(error: unknown) {
  const status = error instanceof OpenAI.APIError ? error.status : undefined;
  const upstreamStatus = status && status >= 100 && status <= 599 ? status : undefined;
  if (status === 401 || status === 403) return { error: `模型认证失败（HTTP ${status}），请检查API密钥与服务权限。`, code: 'authentication', upstreamStatus, retryable: false };
  if (status === 404) return { error: '模型或请求路径不存在（HTTP 404），请检查模型名称及API地址配置。', code: 'model_or_path', upstreamStatus, retryable: false };
  if (status === 429) return { error: '模型请求受限（HTTP 429），请检查额度或稍后重试。', code: 'rate_limit', upstreamStatus, retryable: true };
  if (status && status >= 500) return { error: `模型服务暂时异常（HTTP ${status}），请稍后重试。`, code: 'upstream', upstreamStatus, retryable: true };
  if (error instanceof OpenAI.APIConnectionError) return { error: '无法连接模型服务，请检查网络、API地址和服务可达性后重试。', code: 'network', retryable: true };
  return { error: '模型调用失败，本次未应用任何变化。请检查模型设置后重试。', code: 'model_error', upstreamStatus, retryable: true };
}

/** Standard Web Request/Response route; compatible with the installed Next route handler API. */
export async function POST(req: Request) {
  let messages: Message[];
  let systemPrompt: string;
  let settings: Settings;
  let context: DirectorContext | undefined;
  let offline = false;
  try {
    const raw = await req.text();
    if (raw.length > 550000) return Response.json({ error: '请求内容过大，请缩短剧本或对话上下文', retryable: false }, { status: 413 });
    const body = object(JSON.parse(raw));
    if (body.offline !== undefined && typeof body.offline !== 'boolean') throw new Error('离线模式必须使用布尔值');
    offline = body.offline === true;
    messages = readMessages(body.messages);
    settings = readSettings(body.customSettings);
    if (body.systemPrompt !== undefined && (typeof body.systemPrompt !== 'string' || body.systemPrompt.length > 30000)) throw new Error('系统提示过长或格式无效');
    systemPrompt = (body.systemPrompt as string | undefined) ?? '';
    if (body.directorContext !== undefined) context = validateDirectorContext(body.directorContext);
    if (!context && !systemPrompt && !messages.length) throw new Error('缺少消息或系统提示词');
  } catch (error) {
    return Response.json({ error: error instanceof SyntaxError ? '请求JSON无效' : error instanceof Error ? error.message : '请求格式无效', retryable: false }, { status: 400 });
  }

  const apiKey = settings.apiKey || process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
  const provider = settings.apiKey
    ? /openai/i.test(settings.baseUrl ?? '') || /^(?:gpt-|o[134](?:-|$))/.test(settings.model ?? '') ? 'openai' : 'deepseek'
    : process.env.DEEPSEEK_API_KEY ? 'deepseek' : 'openai';
  const baseURL = settings.baseUrl || (provider === 'openai' ? process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1' : process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com');
  const model = settings.model || (provider === 'openai' ? process.env.OPENAI_MODEL || 'gpt-4o-mini' : process.env.DEEPSEEK_MODEL || 'deepseek-chat');
  if (!apiKey || offline) {
    if (context) {
      const director = fallbackDirector(context);
      return Response.json({ content: director.narration, director });
    }
    const last = messages.filter(m => m.role !== 'system').at(-1)?.content;
    return Response.json({ content: `【离线模式 · ${offline ? '用户选择本地演练' : '未配置模型密钥'}，未调用AI】\n${last ? `已记录你的行动：${cleanNarration(last).slice(0, 200)}。` : '酒馆的灯火仍然亮着。'}\n你可以继续观察现场、与同伴交谈，或在设置中配置模型以获得动态叙事。`, offline: true });
  }

  try {
    const client = new OpenAI({ apiKey, baseURL, maxRetries: 0, timeout: 45000 });
    const prepared = context ? buildDirectorPrompt(context) : undefined;
    const apiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = prepared
      ? [
        { role: 'system', content: prepared.prompt },
        { role: 'user', content: '根据上面已检索的剧情资料，回应当前行动并返回规定 JSON。' },
      ]
      : [
        { role: 'system', content: systemPrompt || '你是一个资深 DND 跑团地下城主（DM）。请按照当前剧本场景与设定主持。' },
        ...messages.map(m => ({ role: m.role === 'narrator' ? 'assistant' as const : m.role === 'dice' || m.role === 'player' ? 'user' as const : m.role, content: m.role === 'dice' ? `[骰子判定结果] ${m.content}` : m.content })),
      ];
    const completion = await client.chat.completions.create({ model, messages: apiMessages, max_tokens: context ? 1800 : 1000, temperature: settings.temperature ?? 0.8 });
    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error('模型未返回内容');
    if (context && prepared) {
      try {
        const director = parseDirectorResponse(content, context, prepared.sources);
        return Response.json({ content: director.narration, director });
      } catch {
        return Response.json({ error: '主持提案未通过校验，本次未应用任何变化。请重试。', retryable: true }, { status: 502 });
      }
    }
    return Response.json({ content: cleanNarration(content) });
  } catch (error) {
    // Do not echo provider errors, which can include configured URLs or credentials.
    return Response.json(providerFailure(error), { status: 502 });
  }
}
