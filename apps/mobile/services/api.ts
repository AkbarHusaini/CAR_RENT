import Constants from 'expo-constants';
import { Platform } from 'react-native';

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

export interface FleetVehicle {
  id: string;
  name: string;
  brand: string;
  year: number;
  category: 'SUV' | 'MPV' | 'Compact' | 'EV' | 'Scooter';
  transmission: 'Automatic' | 'Manual';
  seats: number;
  luggageBags: number;
  fuelType: string;
  dailyRateIdr: number;
  depositIdr: number;
  hubs: string[];
  surfRackReady: boolean;
  features: string[];
  recommendedFor: string[];
  rating: number;
  unitsTotal: number;
  tagline: string;
}

export interface BaliWeatherReport {
  hub: string;
  hubName: string;
  area: string;
  temperatureC: number;
  condition: string;
  precipitationProbabilityPct: number;
  windSpeedKmh: number;
  isRainRisk: boolean;
  ridingAdvisory: string;
  recommendedCategories: string[];
  source: string;
  observedAt: string;
}

export interface BookingRecord {
  booking_id: string;
  customer_name: string;
  customer_phone: string | null;
  vehicle_id: string;
  vehicle_name: string;
  vehicle_category: string;
  pickup_hub: string;
  start_date: string;
  days: number;
  daily_rate_idr: number;
  delivery_fee_idr: number;
  addons_json: string;
  total_idr: number;
  status: 'confirmed' | 'active' | 'cancelled' | 'completed';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface HealthResponse {
  ok: boolean;
  service: string;
  timestamp: string;
  servers: McpServerInfo[];
  engines: {
    preferredEngine: LlmEngineMode;
    ollama: { url: string; model: string; reachable: boolean };
    gemini: { configured: boolean; model: string };
    openai: { configured: boolean; model: string };
    directRouter: { available: boolean };
  };
}

export interface ChatResponse {
  reply: string;
  engineUsed: string;
  fallbackReason?: string;
  totalDurationMs: number;
  trace: McpToolTraceEntry[];
  vehicles: FleetVehicle[];
  booking: BookingRecord | null;
  weather: BaliWeatherReport | null;
  bookingsList: BookingRecord[] | null;
}

export function detectDefaultApiUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location?.hostname) {
      return `http://${window.location.hostname}:3001`;
    }
    return 'http://localhost:3001';
  }

  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as unknown as { manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } } })
      .manifest2?.extra?.expoGo?.debuggerHost;

  if (hostUri && typeof hostUri === 'string') {
    const host = hostUri.split(':')[0];
    if (host && host !== '127.0.0.1' && host !== 'localhost') {
      return `http://${host}:3001`;
    }
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3001';
  }

  return 'http://localhost:3001';
}

async function apiRequest<T>(baseUrl: string, path: string, init?: RequestInit): Promise<T> {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const res = await fetch(`${cleanBase}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    }
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Invalid JSON from ${cleanBase}${path}: ${text.slice(0, 120)}`);
  }
  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    if (typeof json === 'object' && json !== null) {
      const obj = json as Record<string, unknown>;
      if (typeof obj.detail === 'string' && obj.detail) {
        errMsg = obj.detail;
      } else if ('error' in obj) {
        errMsg = typeof obj.error === 'string' ? obj.error : JSON.stringify(obj.error);
      } else if (typeof obj.message === 'string' && obj.message) {
        errMsg = obj.message;
      }
    }
    throw new Error(errMsg);
  }
  return json as T;
}

export const ApiClient = {
  getHealth(baseUrl: string) {
    return apiRequest<HealthResponse>(baseUrl, '/api/health');
  },
  sendChat(
    baseUrl: string,
    payload: {
      message: string;
      customerName?: string;
      preferredHub?: string;
      engine?: LlmEngineMode;
      llmConfig?: LlmRuntimeConfig;
      history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    },
    signal?: AbortSignal
  ) {
    return apiRequest<ChatResponse>(baseUrl, '/api/chat', {
      method: 'POST',
      body: JSON.stringify(payload),
      signal
    });
  },
  testLlm(
    baseUrl: string,
    engine: 'gemini' | 'openai' | 'ollama',
    llmConfig?: LlmRuntimeConfig
  ) {
    return apiRequest<{ ok: boolean; engine: string; detail: string }>(baseUrl, '/api/llm/test', {
      method: 'POST',
      body: JSON.stringify({ engine, llmConfig })
    });
  },
  getFleet(baseUrl: string, params?: { category?: string; hub?: string }) {
    const qs = new URLSearchParams();
    if (params?.category && params.category !== 'ALL') qs.set('category', params.category);
    if (params?.hub) qs.set('hub', params.hub);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return apiRequest<{
      fleet: FleetVehicle[];
      weather: BaliWeatherReport | null;
      hubs: Array<{ code: string; name: string; area: string; deliveryFeeIdr: number }>;
      trace: McpToolTraceEntry[];
    }>(baseUrl, `/api/fleet${suffix}`);
  },
  getBookings(baseUrl: string, status = 'all') {
    return apiRequest<{ bookings: BookingRecord[]; trace: McpToolTraceEntry }>(
      baseUrl,
      `/api/bookings?status=${encodeURIComponent(status)}`
    );
  },
  createBooking(
    baseUrl: string,
    payload: {
      customerName: string;
      vehicleId: string;
      pickupHub: string;
      startDate: string;
      days: number;
      addons?: string[];
      notes?: string;
    }
  ) {
    return apiRequest<{ booking: BookingRecord; trace: McpToolTraceEntry[] }>(baseUrl, '/api/bookings', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  updateBooking(
    baseUrl: string,
    bookingId: string,
    payload: { pickupHub?: string; days?: number; addons?: string[]; notes?: string }
  ) {
    return apiRequest<{ booking: BookingRecord; trace: McpToolTraceEntry }>(
      baseUrl,
      `/api/bookings/${encodeURIComponent(bookingId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload)
      }
    );
  },
  cancelBooking(baseUrl: string, bookingId: string, reason?: string) {
    return apiRequest<{ booking: BookingRecord; trace: McpToolTraceEntry }>(
      baseUrl,
      `/api/bookings/${encodeURIComponent(bookingId)}/cancel`,
      {
        method: 'POST',
        body: JSON.stringify({ reason })
      }
    );
  },
  getMemory(baseUrl: string) {
    return apiRequest<{
      graph: { entities?: Array<{ name: string; entityType: string; observations: string[] }> };
      trace: McpToolTraceEntry;
    }>(baseUrl, '/api/memory');
  },
  getMcpTools(baseUrl: string) {
    return apiRequest<{ servers: McpServerInfo[]; tools: McpToolDescriptor[] }>(baseUrl, '/api/mcp/tools');
  },
  getMcpLogs(baseUrl: string, limit = 60) {
    return apiRequest<{ logs: McpToolTraceEntry[] }>(baseUrl, `/api/mcp/logs?limit=${limit}`);
  },
  invokeMcpTool(baseUrl: string, tool: string, args: Record<string, unknown>) {
    return apiRequest<{ trace: McpToolTraceEntry }>(baseUrl, '/api/mcp/invoke', {
      method: 'POST',
      body: JSON.stringify({ tool, arguments: args })
    });
  }
};

