import { McpClientManager } from '../mcp/clientManager.js';
import { runDirectMcpRouter } from './directRouter.js';
import { runGeminiAgent, runOllamaAgent, runOpenAiAgent } from './llmAgent.js';
import {
  ChatTurnRequest,
  ChatTurnResponse,
  LlmEngineMode,
  LlmRuntimeConfig,
  McpToolTraceEntry
} from './types.js';

export interface EngineStatus {
  preferredEngine: LlmEngineMode;
  ollama: { url: string; model: string; reachable: boolean };
  gemini: { configured: boolean; model: string };
  openai: { configured: boolean; baseUrl: string; model: string };
  directRouter: { available: true };
}

export async function probeOllamaReachable(baseUrlOverride?: string): Promise<boolean> {
  const baseUrl = (baseUrlOverride || process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(
    /\/+$/,
    ''
  );
  try {
    const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(1200) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function getEngineStatus(): Promise<EngineStatus> {
  const preferredEngine = (process.env.LLM_ENGINE as LlmEngineMode) || 'auto';
  const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
  const ollamaModel = process.env.OLLAMA_MODEL || 'qwen2.5:3b';
  const ollamaReachable = await probeOllamaReachable(ollamaUrl);

  return {
    preferredEngine,
    ollama: { url: ollamaUrl, model: ollamaModel, reachable: ollamaReachable },
    gemini: {
      configured: Boolean(process.env.GEMINI_API_KEY?.trim()),
      model: process.env.GEMINI_MODEL || 'gemini-3.8-flash'
    },
    openai: {
      configured: Boolean(process.env.OPENAI_API_KEY?.trim()),
      baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini'
    },
    directRouter: { available: true }
  };
}

export async function testLlmConnectivity(
  engine: Exclude<LlmEngineMode, 'auto' | 'direct'>,
  config?: LlmRuntimeConfig
): Promise<{ ok: boolean; engine: string; detail: string }> {
  if (engine === 'gemini') {
    const apiKey = (config?.geminiApiKey || process.env.GEMINI_API_KEY || '').trim();
    const rawModel = (config?.geminiModel || process.env.GEMINI_MODEL || 'gemini-3.8-flash').trim();
    const model = rawModel === 'gemini-2.5-flash' ? 'gemini-3.8-flash' : rawModel;
    if (!apiKey) {
      return { ok: false, engine: `gemini:${model}`, detail: 'GEMINI_API_KEY belum diisi.' };
    }
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Reply with OK' }] }],
          generationConfig: { maxOutputTokens: 64 }
        }),
        signal: AbortSignal.timeout(15000)
      }
    );
    if (!res.ok) {
      return { ok: false, engine: `gemini:${model}`, detail: `HTTP ${res.status}: ${await res.text()}` };
    }
    return { ok: true, engine: `gemini:${model}`, detail: 'Gemini API terhubung dan merespons dengan baik.' };
  }

  if (engine === 'openai') {
    const apiKey = (config?.openaiApiKey || process.env.OPENAI_API_KEY || '').trim();
    const baseUrl = (
      config?.openaiBaseUrl ||
      process.env.OPENAI_BASE_URL ||
      'https://api.openai.com/v1'
    ).replace(/\/+$/, '');
    const model = (config?.openaiModel || process.env.OPENAI_MODEL || 'gpt-4o-mini').trim();
    if (!apiKey) {
      return { ok: false, engine: `openai:${model}`, detail: 'OPENAI_API_KEY belum diisi.' };
    }
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Reply with OK' }],
        max_tokens: 8
      }),
      signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) {
      return { ok: false, engine: `openai:${model}`, detail: `HTTP ${res.status}: ${await res.text()}` };
    }
    return {
      ok: true,
      engine: `openai:${model}`,
      detail: `OpenAI-compatible endpoint (${baseUrl}) terhubung.`
    };
  }

  const ollamaUrl = (
    config?.ollamaBaseUrl ||
    process.env.OLLAMA_BASE_URL ||
    'http://127.0.0.1:11434'
  ).replace(/\/+$/, '');
  const ollamaModel = (config?.ollamaModel || process.env.OLLAMA_MODEL || 'qwen2.5:3b').trim();
  const reachable = await probeOllamaReachable(ollamaUrl);
  if (!reachable) {
    return {
      ok: false,
      engine: `ollama:${ollamaModel}`,
      detail: `Ollama tidak aktif di ${ollamaUrl}. Jalankan 'ollama serve' terlebih dahulu.`
    };
  }
  return {
    ok: true,
    engine: `ollama:${ollamaModel}`,
    detail: `Ollama server aktif di ${ollamaUrl}.`
  };
}

function extractRichArtifacts(trace: McpToolTraceEntry[]): {
  vehicles: Record<string, unknown>[];
  booking: Record<string, unknown> | null;
  weather: Record<string, unknown> | null;
  bookingsList: Record<string, unknown>[] | null;
} {
  let vehicles: Record<string, unknown>[] = [];
  let booking: Record<string, unknown> | null = null;
  let weather: Record<string, unknown> | null = null;
  let bookingsList: Record<string, unknown>[] | null = null;

  for (const entry of trace) {
    if (entry.isError || !entry.result || typeof entry.result !== 'object') continue;
    const res = entry.result as Record<string, unknown>;

    if (entry.serverId === 'mcp-a') {
      if (entry.toolName === 'search_fleet' && Array.isArray(res.vehicles)) {
        vehicles = res.vehicles as Record<string, unknown>[];
      } else if (entry.toolName === 'get_vehicle_details' && res.vehicle && typeof res.vehicle === 'object') {
        vehicles = [res.vehicle as Record<string, unknown>];
      } else if (entry.toolName === 'get_bali_weather' && res.weather && typeof res.weather === 'object') {
        weather = res.weather as Record<string, unknown>;
      }
    } else if (entry.serverId === 'mcp-b') {
      if (
        (entry.toolName === 'create_booking' ||
          entry.toolName === 'update_booking' ||
          entry.toolName === 'cancel_booking' ||
          entry.toolName === 'get_booking') &&
        res.booking &&
        typeof res.booking === 'object'
      ) {
        booking = res.booking as Record<string, unknown>;
      } else if (entry.toolName === 'list_bookings' && Array.isArray(res.bookings)) {
        bookingsList = res.bookings as Record<string, unknown>[];
      }
    }
  }

  return { vehicles, booking, weather, bookingsList };
}

function formatFallbackNote(provider: string, err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('503') || msg.toLowerCase().includes('high demand') || msg.toLowerCase().includes('unavailable')) {
    return `${provider} sedang sibuk sementara (503) — dijawab otomatis dengan mode Cepat.`;
  }
  if (msg.includes('429') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('rate')) {
    return `Kuota ${provider} tercapai — dijawab otomatis dengan mode Cepat.`;
  }
  if (msg.toLowerCase().includes('tidak dapat terhubung ke ollama') || msg.toLowerCase().includes('fetch failed')) {
    return `${provider} belum aktif — dijawab otomatis dengan mode Cepat.`;
  }
  if (msg.toLowerCase().includes('belum diisi')) {
    return `API key ${provider} belum diisi — dijawab otomatis dengan mode Cepat.`;
  }
  return `${provider} tidak merespons — dialihkan ke mode Cepat.`;
}

export async function executeChatTurn(
  manager: McpClientManager,
  req: ChatTurnRequest
): Promise<ChatTurnResponse> {
  const start = performance.now();
  const mode: LlmEngineMode = req.engine || (process.env.LLM_ENGINE as LlmEngineMode) || 'auto';
  const history = req.history ?? [];
  const contextNote = `Active customer context: name=${req.customerName || 'Guest Traveler'}, preferredHub=${req.preferredHub || 'CANGGU'}.`;

  const hasGemini = Boolean((req.llmConfig?.geminiApiKey || process.env.GEMINI_API_KEY || '').trim());
  const hasOpenAi = Boolean((req.llmConfig?.openaiApiKey || process.env.OPENAI_API_KEY || '').trim());

  let outcome: { reply: string; trace: McpToolTraceEntry[]; engineUsed: string };
  let fallbackReason: string | undefined;

  if (mode === 'direct') {
    outcome = await runDirectMcpRouter(manager, req);
  } else if (mode === 'gemini') {
    try {
      outcome = await runGeminiAgent(manager, req.message, history, contextNote, req.llmConfig);
    } catch (err) {
      fallbackReason = formatFallbackNote('Gemini', err);
      outcome = await runDirectMcpRouter(manager, req);
    }
  } else if (mode === 'openai') {
    try {
      outcome = await runOpenAiAgent(manager, req.message, history, contextNote, req.llmConfig);
    } catch (err) {
      fallbackReason = formatFallbackNote('OpenAI', err);
      outcome = await runDirectMcpRouter(manager, req);
    }
  } else if (mode === 'ollama') {
    try {
      outcome = await runOllamaAgent(manager, req.message, history, contextNote, req.llmConfig);
    } catch (err) {
      fallbackReason = formatFallbackNote('Ollama', err);
      outcome = await runDirectMcpRouter(manager, req);
    }
  } else {
    // 'auto': try configured Gemini -> OpenAI -> Ollama -> fallback cleanly to Direct MCP Router
    if (hasGemini) {
      try {
        outcome = await runGeminiAgent(manager, req.message, history, contextNote, req.llmConfig);
      } catch (err) {
        fallbackReason = formatFallbackNote('Gemini', err);
        outcome = await runDirectMcpRouter(manager, req);
      }
    } else if (hasOpenAi) {
      try {
        outcome = await runOpenAiAgent(manager, req.message, history, contextNote, req.llmConfig);
      } catch (err) {
        fallbackReason = formatFallbackNote('OpenAI', err);
        outcome = await runDirectMcpRouter(manager, req);
      }
    } else if (await probeOllamaReachable(req.llmConfig?.ollamaBaseUrl)) {
      try {
        outcome = await runOllamaAgent(manager, req.message, history, contextNote, req.llmConfig);
      } catch (err) {
        fallbackReason = formatFallbackNote('Ollama', err);
        outcome = await runDirectMcpRouter(manager, req);
      }
    } else {
      outcome = await runDirectMcpRouter(manager, req);
    }
  }

  const totalDurationMs = Math.max(1, Math.round(performance.now() - start));
  const artifacts = extractRichArtifacts(outcome.trace);

  return {
    reply: outcome.reply,
    engineUsed: outcome.engineUsed,
    fallbackReason,
    totalDurationMs,
    trace: outcome.trace,
    ...artifacts
  };
}
