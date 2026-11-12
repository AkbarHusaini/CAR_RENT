import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  ApiClient,
  BookingRecord,
  detectDefaultApiUrl,
  HealthResponse,
  LlmEngineMode,
  LlmRuntimeConfig
} from '@/services/api';

const STORAGE_URL_KEY = 'erb_api_base_url';
const STORAGE_ENGINE_KEY = 'erb_llm_engine';
const STORAGE_NAME_KEY = 'erb_customer_name';
const STORAGE_LLM_CFG_KEY = 'erb_llm_runtime_cfg';

interface AppContextValue {
  apiBaseUrl: string;
  setApiBaseUrl: (url: string) => Promise<void>;
  engine: LlmEngineMode;
  setEngine: (engine: LlmEngineMode) => Promise<void>;
  llmConfig: LlmRuntimeConfig;
  setLlmConfig: (cfg: LlmRuntimeConfig) => Promise<void>;
  customerName: string;
  setCustomerName: (name: string) => Promise<void>;
  preferredHub: string;
  setPreferredHub: (hub: string) => void;
  health: HealthResponse | null;
  healthError: string | null;
  refreshHealth: () => Promise<void>;
  pendingPrompt: string | null;
  setPendingPrompt: (prompt: string | null) => void;
  activeVoucherBooking: BookingRecord | null;
  setActiveVoucherBooking: (booking: BookingRecord | null) => void;
  bookingsVersion: number;
  bumpBookingsVersion: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [apiBaseUrl, setApiBaseUrlState] = useState<string>(detectDefaultApiUrl());
  const [engine, setEngineState] = useState<LlmEngineMode>('auto');
  const [llmConfig, setLlmConfigState] = useState<LlmRuntimeConfig>({
    geminiModel: 'gemini-3.8-flash',
    openaiBaseUrl: 'https://api.openai.com/v1',
    openaiModel: 'gpt-4o-mini',
    ollamaBaseUrl: 'http://127.0.0.1:11434',
    ollamaModel: 'qwen2.5:3b'
  });
  const [customerName, setCustomerNameState] = useState<string>('Maya');
  const [preferredHub, setPreferredHub] = useState<string>('CANGGU');
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [activeVoucherBooking, setActiveVoucherBooking] = useState<BookingRecord | null>(null);
  const [bookingsVersion, setBookingsVersion] = useState<number>(0);

  const refreshHealth = useCallback(
    async (overrideUrl?: string) => {
      const target = overrideUrl ?? apiBaseUrl;
      try {
        const h = await ApiClient.getHealth(target);
        setHealth(h);
        setHealthError(null);
      } catch (err) {
        setHealth(null);
        setHealthError(err instanceof Error ? err.message : 'Orchestrator unreachable');
      }
    },
    [apiBaseUrl]
  );

  useEffect(() => {
    (async () => {
      try {
        const [savedUrl, savedEngine, savedName, savedCfg] = await Promise.all([
          AsyncStorage.getItem(STORAGE_URL_KEY),
          AsyncStorage.getItem(STORAGE_ENGINE_KEY),
          AsyncStorage.getItem(STORAGE_NAME_KEY),
          AsyncStorage.getItem(STORAGE_LLM_CFG_KEY)
        ]);
        const effectiveUrl = savedUrl || detectDefaultApiUrl();
        if (savedUrl) setApiBaseUrlState(savedUrl);
        if (savedEngine) setEngineState(savedEngine as LlmEngineMode);
        if (savedName) setCustomerNameState(savedName);
        if (savedCfg) {
          try {
            const parsed = JSON.parse(savedCfg) as LlmRuntimeConfig;
            if (parsed.geminiModel === 'gemini-2.5-flash') {
              parsed.geminiModel = 'gemini-3.8-flash';
            }
            setLlmConfigState((prev) => ({ ...prev, ...parsed }));
          } catch {
            // ignore corrupt cache
          }
        }
        await refreshHealth(effectiveUrl);
      } catch {
        await refreshHealth();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setApiBaseUrl = useCallback(
    async (url: string) => {
      const clean = url.trim().replace(/\/+$/, '');
      setApiBaseUrlState(clean);
      await AsyncStorage.setItem(STORAGE_URL_KEY, clean);
      await refreshHealth(clean);
    },
    [refreshHealth]
  );

  const setEngine = useCallback(async (next: LlmEngineMode) => {
    setEngineState(next);
    await AsyncStorage.setItem(STORAGE_ENGINE_KEY, next);
  }, []);

  const setLlmConfig = useCallback(async (cfg: LlmRuntimeConfig) => {
    setLlmConfigState(cfg);
    await AsyncStorage.setItem(STORAGE_LLM_CFG_KEY, JSON.stringify(cfg));
  }, []);

  const setCustomerName = useCallback(async (name: string) => {
    setCustomerNameState(name);
    await AsyncStorage.setItem(STORAGE_NAME_KEY, name);
  }, []);

  const bumpBookingsVersion = useCallback(() => {
    setBookingsVersion((v) => v + 1);
  }, []);

  return (
    <AppContext.Provider
      value={{
        apiBaseUrl,
        setApiBaseUrl,
        engine,
        setEngine,
        llmConfig,
        setLlmConfig,
        customerName,
        setCustomerName,
        preferredHub,
        setPreferredHub,
        health,
        healthError,
        refreshHealth: () => refreshHealth(),
        pendingPrompt,
        setPendingPrompt,
        activeVoucherBooking,
        setActiveVoucherBooking,
        bookingsVersion,
        bumpBookingsVersion
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}
