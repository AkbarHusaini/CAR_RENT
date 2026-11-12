import { McpClientManager } from '../mcp/clientManager.js';
import { ChatHistoryMessage, LlmRuntimeConfig, McpToolDescriptor, McpToolTraceEntry } from './types.js';

const SYSTEM_PROMPT = `You are the Easy Rent Bali AI Concierge mobile assistant.
You orchestrate 3 real Model Context Protocol (MCP) servers:
- MCP A (mcp_a__*): READ-ONLY fleet catalog, rental quotes, hub info, and live Open-Meteo Bali weather.
- MCP B (mcp_b__*): WRITE/PERSIST SQLite reservation ledger (create_booking, update_booking, cancel_booking, list_bookings, get_booking).
- MCP C (mcp_c__*): Official Knowledge Graph memory (@modelcontextprotocol/server-memory) for saving/recalling user travel preferences.

CRITICAL RULES:
1. Always query MCP A first (mcp_a__search_fleet / mcp_a__get_bali_weather / mcp_a__calculate_quote) before quoting prices or confirming availability. Never guess vehicle IDs or rates.
2. When the user wants to book, modify, extend, reschedule, or cancel a reservation, you MUST invoke MCP B (mcp_b__create_booking / mcp_b__update_booking / mcp_b__cancel_booking) using exact vehicleId, vehicleName, and dailyRateIdr retrieved from MCP A.
3. For startDate, default to tomorrow's ISO date (${new Date(Date.now() + 86400_000).toISOString().slice(0, 10)}) if the user says "tomorrow" or doesn't give a date.
4. When the user states preferences (like automatic, surf rack, child seat, preferred hub) or completes a booking, store a brief observation in MCP C (mcp_c__create_entities / mcp_c__add_observations).
5. Answer warmly, concisely (2–4 short sentences max), and in plain human language matching the user's language (English or Indonesian). Do NOT repeat raw internal tool/database names like "mcp_a__" or "SQLite" unless the user explicitly asks; the app UI already renders clean weather, vehicle, and MCP trace cards automatically. Include exact booking IDs and IDR totals returned by the tools.`;

/**
 * Gemini v1beta Schema proto strictly accepts only a subset of OpenAPI 3.0 keywords.
 * Using an explicit whitelist prevents 400 INVALID_ARGUMENT errors on Zod/MCP JSON Schemas
 * (e.g. $schema, additionalProperties, minLength, maxLength, exclusiveMinimum, huge maximums).
 */
export function sanitizeSchemaForGemini(schema: unknown): Record<string, unknown> {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return { type: 'object', properties: {} };
  }

  const src = schema as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  if (typeof src.type === 'string') {
    out.type = src.type;
  } else if (Array.isArray(src.type)) {
    const first = src.type.find((t) => typeof t === 'string' && t !== 'null');
    out.type = first || 'string';
  }

  if (typeof src.description === 'string' && src.description.trim().length > 0) {
    out.description = src.description;
  }

  if (Array.isArray(src.enum)) {
    out.enum = src.enum.map((v) => String(v));
  }

  if (Array.isArray(src.required) && src.required.length > 0) {
    out.required = src.required.filter((r) => typeof r === 'string');
  }

  if (src.properties && typeof src.properties === 'object' && !Array.isArray(src.properties)) {
    const props: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(src.properties as Record<string, unknown>)) {
      props[k] = sanitizeSchemaForGemini(v);
    }
    out.properties = props;
  } else if (out.type === 'object') {
    out.properties = {};
  }

  if (src.items && typeof src.items === 'object') {
    out.items = sanitizeSchemaForGemini(src.items);
  }

  return out;
}

function compactResultForLlm(result: unknown): unknown {
  if (!result || typeof result !== 'object') return result;
  const obj = result as Record<string, unknown>;
  if (Array.isArray(obj.vehicles)) {
    return {
      ...obj,
      vehicles: (obj.vehicles as Array<Record<string, unknown>>).map((v) => ({
        id: v.id,
        name: v.name,
        category: v.category,
        transmission: v.transmission,
        seats: v.seats,
        dailyRateIdr: v.dailyRateIdr,
        hubs: v.hubs,
        surfRackReady: v.surfRackReady
      }))
    };
  }
  return result;
}

function selectRelevantTools(tools: McpToolDescriptor[]): McpToolDescriptor[] {
  const excludedMemoryTools = new Set([
    'delete_entities',
    'delete_observations',
    'delete_relations',
    'open_nodes'
  ]);
  return tools.filter((t) => !(t.serverId === 'mcp-c' && excludedMemoryTools.has(t.name)));
}

export interface LlmRunResult {
  reply: string;
  trace: McpToolTraceEntry[];
  engineUsed: string;
}

export async function runOllamaAgent(
  manager: McpClientManager,
  userMessage: string,
  history: ChatHistoryMessage[],
  contextNote: string,
  config?: LlmRuntimeConfig
): Promise<LlmRunResult> {
  const baseUrl = (
    config?.ollamaBaseUrl ||
    process.env.OLLAMA_BASE_URL ||
    'http://127.0.0.1:11434'
  ).replace(/\/+$/, '');
  const model = config?.ollamaModel || process.env.OLLAMA_MODEL || 'qwen2.5:3b';
  const timeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS || '120000');

  const tools = selectRelevantTools(manager.getAllTools()).map((t) => ({
    type: 'function',
    function: {
      name: t.namespacedName,
      description: `[${t.serverId.toUpperCase()} ${t.direction}] ${t.description}`,
      parameters: t.inputSchema
    }
  }));

  const messages: Array<Record<string, unknown>> = [
    { role: 'system', content: `${SYSTEM_PROMPT}\n${contextNote}` },
    ...history.slice(-6).map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage }
  ];

  const trace: McpToolTraceEntry[] = [];

  for (let step = 0; step < 5; step++) {
    let res: Response;
    try {
      res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, tools, stream: false }),
        signal: AbortSignal.timeout(timeoutMs)
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Tidak dapat terhubung ke Ollama di ${baseUrl} (${msg}). Pastikan 'ollama serve' aktif atau ganti engine ke Gemini/OpenAI/Direct MCP.`
      );
    }

    if (!res.ok) {
      throw new Error(`Ollama API error (${res.status}): ${await res.text()}`);
    }

    const data = (await res.json()) as {
      message?: {
        role: string;
        content?: string;
        tool_calls?: Array<{
          function?: { name: string; arguments: Record<string, unknown> | string };
        }>;
      };
    };

    const msg = data.message;
    if (!msg) throw new Error('Empty response from Ollama');
    messages.push(msg as Record<string, unknown>);

    const toolCalls = msg.tool_calls ?? [];
    if (toolCalls.length === 0) {
      return {
        reply: msg.content?.trim() || 'Done.',
        trace,
        engineUsed: `ollama:${model}`
      };
    }

    for (const tc of toolCalls) {
      const fnName = tc.function?.name;
      if (!fnName) continue;
      let args: Record<string, unknown> = {};
      if (typeof tc.function?.arguments === 'string') {
        try {
          args = JSON.parse(tc.function.arguments);
        } catch {
          args = {};
        }
      } else if (tc.function?.arguments && typeof tc.function.arguments === 'object') {
        args = tc.function.arguments;
      }

      const entry = await manager.callNamespacedTool(fnName, args);
      trace.push(entry);
      messages.push({
        role: 'tool',
        content: JSON.stringify(entry.result)
      });
    }
  }

  return {
    reply: 'I completed the MCP tool steps above. Let me know if you want to adjust anything!',
    trace,
    engineUsed: `ollama:${model}`
  };
}

export async function runGeminiAgent(
  manager: McpClientManager,
  userMessage: string,
  history: ChatHistoryMessage[],
  contextNote: string,
  config?: LlmRuntimeConfig
): Promise<LlmRunResult> {
  const apiKey = (config?.geminiApiKey || process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY belum diisi. Masukkan Gemini API Key di tab MCP Logs -> Settings atau di file .env.'
    );
  }
  const rawModel = (config?.geminiModel || process.env.GEMINI_MODEL || 'gemini-3.8-flash').trim();
  const model = rawModel === 'gemini-2.5-flash' ? 'gemini-3.8-flash' : rawModel;

  const functionDeclarations = selectRelevantTools(manager.getAllTools()).map((t) => ({
    name: t.namespacedName,
    description: `[${t.serverId.toUpperCase()} ${t.direction}] ${t.description}`,
    parameters: sanitizeSchemaForGemini(t.inputSchema)
  }));

  const contents: Array<Record<string, unknown>> = [
    ...history.slice(-6).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    })),
    { role: 'user', parts: [{ text: userMessage }] }
  ];

  const trace: McpToolTraceEntry[] = [];
  let useThinkingConfig = model.startsWith('gemini-3');

  for (let step = 0; step < 5; step++) {
    const bodyPayload: Record<string, unknown> = {
      systemInstruction: { parts: [{ text: `${SYSTEM_PROMPT}\n${contextNote}` }] },
      contents,
      tools: [{ functionDeclarations }]
    };
    if (useThinkingConfig) {
      bodyPayload.generationConfig = {
        thinkingConfig: { thinkingLevel: 'LOW' }
      };
    }

    let res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
        signal: AbortSignal.timeout(30000)
      }
    );

    if (!res.ok && res.status === 400 && useThinkingConfig) {
      const errText = await res.text();
      if (errText.includes('thinkingConfig') || errText.includes('thinkingLevel')) {
        useThinkingConfig = false;
        delete bodyPayload.generationConfig;
        res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyPayload),
            signal: AbortSignal.timeout(30000)
          }
        );
      } else {
        throw new Error(`Gemini API error (400): ${errText}`);
      }
    }

    if (!res.ok) {
      throw new Error(`Gemini API error (${res.status}): ${await res.text()}`);
    }

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: {
          role: string;
          parts?: Array<{ text?: string; functionCall?: { name: string; args?: Record<string, unknown> } }>;
        };
      }>;
    };

    const candidateContent = data.candidates?.[0]?.content;
    const parts = candidateContent?.parts ?? [];
    if (parts.length > 0) {
      contents.push({ role: 'model', parts });
    }

    const calls = parts.filter((p) => p.functionCall);
    if (calls.length === 0) {
      const text = parts
        .map((p) => p.text)
        .filter(Boolean)
        .join('\n')
        .trim();
      return {
        reply: text || 'Done.',
        trace,
        engineUsed: `gemini:${model}`
      };
    }

    const responseParts: Array<Record<string, unknown>> = [];
    for (const c of calls) {
      const fc = c.functionCall!;
      const entry = await manager.callNamespacedTool(fc.name, fc.args ?? {});
      trace.push(entry);
      responseParts.push({
        functionResponse: {
          name: fc.name,
          response: { result: compactResultForLlm(entry.result) }
        }
      });
    }
    contents.push({ role: 'user', parts: responseParts });
  }

  return {
    reply: 'I completed the requested MCP operations.',
    trace,
    engineUsed: `gemini:${model}`
  };
}

export async function runOpenAiAgent(
  manager: McpClientManager,
  userMessage: string,
  history: ChatHistoryMessage[],
  contextNote: string,
  config?: LlmRuntimeConfig
): Promise<LlmRunResult> {
  const apiKey = (config?.openaiApiKey || process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY belum diisi. Masukkan OpenAI/OpenRouter/Groq API Key di tab MCP Logs -> Settings atau di file .env.'
    );
  }
  const baseUrl = (
    config?.openaiBaseUrl ||
    process.env.OPENAI_BASE_URL ||
    'https://api.openai.com/v1'
  ).replace(/\/+$/, '');
  const model = (config?.openaiModel || process.env.OPENAI_MODEL || 'gpt-4o-mini').trim();

  const tools = selectRelevantTools(manager.getAllTools()).map((t) => ({
    type: 'function',
    function: {
      name: t.namespacedName,
      description: `[${t.serverId.toUpperCase()} ${t.direction}] ${t.description}`,
      parameters: t.inputSchema
    }
  }));

  const messages: Array<Record<string, unknown>> = [
    { role: 'system', content: `${SYSTEM_PROMPT}\n${contextNote}` },
    ...history.slice(-6).map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage }
  ];

  const trace: McpToolTraceEntry[] = [];

  for (let step = 0; step < 5; step++) {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({ model, messages, tools }),
      signal: AbortSignal.timeout(45000)
    });

    if (!res.ok) {
      throw new Error(`OpenAI-compatible API error (${res.status}): ${await res.text()}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{
        message?: {
          role: string;
          content?: string | null;
          tool_calls?: Array<{
            id: string;
            type: string;
            function: { name: string; arguments: string };
          }>;
        };
      }>;
    };

    const msg = data.choices?.[0]?.message;
    if (!msg) throw new Error('Empty response from OpenAI-compatible API');
    messages.push(msg as Record<string, unknown>);

    const toolCalls = msg.tool_calls ?? [];
    if (toolCalls.length === 0) {
      return {
        reply: msg.content?.trim() || 'Done.',
        trace,
        engineUsed: `openai:${model}`
      };
    }

    for (const tc of toolCalls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function.arguments || '{}');
      } catch {
        args = {};
      }
      const entry = await manager.callNamespacedTool(tc.function.name, args);
      trace.push(entry);
      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify(entry.result)
      });
    }
  }

  return {
    reply: 'I completed the requested MCP operations.',
    trace,
    engineUsed: `openai:${model}`
  };
}
