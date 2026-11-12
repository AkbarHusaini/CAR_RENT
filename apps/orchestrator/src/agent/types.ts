export type McpServerId = 'mcp-a' | 'mcp-b' | 'mcp-c';
export type McpOperationDirection = 'READ' | 'WRITE' | 'MEMORY';
export type LlmEngineMode = 'auto' | 'direct' | 'ollama' | 'gemini' | 'openai';

export interface LlmRuntimeConfig {
  geminiApiKey?: string;
  geminiModel?: string;
  openaiApiKey?: string;
  openaiBaseUrl?: string;
  openaiModel?: string;
  ollamaBaseUrl?: string;
  ollamaModel?: string;
}

export interface McpServerInfo {
  id: McpServerId;
  name: string;
  label: string;
  role: string;
  direction: McpOperationDirection;
  transport: 'stdio';
  packageRef: string;
  connected: boolean;
  toolCount: number;
  lastLatencyMs: number | null;
}

export interface McpToolDescriptor {
  serverId: McpServerId;
  serverLabel: string;
  direction: McpOperationDirection;
  name: string;
  namespacedName: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpToolTraceEntry {
  id: string;
  timestamp: string;
  serverId: McpServerId;
  serverLabel: string;
  direction: McpOperationDirection;
  toolName: string;
  namespacedName: string;
  arguments: Record<string, unknown>;
  result: unknown;
  isError: boolean;
  durationMs: number;
}

export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatTurnRequest {
  message: string;
  sessionId?: string;
  customerName?: string;
  preferredHub?: string;
  engine?: LlmEngineMode;
  llmConfig?: LlmRuntimeConfig;
  history?: ChatHistoryMessage[];
}

export interface ChatTurnResponse {
  reply: string;
  engineUsed: string;
  fallbackReason?: string;
  totalDurationMs: number;
  trace: McpToolTraceEntry[];
  vehicles: Record<string, unknown>[];
  booking: Record<string, unknown> | null;
  weather: Record<string, unknown> | null;
  bookingsList: Record<string, unknown>[] | null;
}
