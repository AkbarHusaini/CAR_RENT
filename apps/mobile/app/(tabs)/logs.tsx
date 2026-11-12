import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Theme } from '@/constants/theme';
import { useAppContext } from '@/context/AppContext';
import { ApiClient, LlmEngineMode, McpToolDescriptor, McpToolTraceEntry } from '@/services/api';

const ENGINES: Array<{ id: LlmEngineMode; label: string }> = [
  { id: 'auto', label: 'Otomatis' },
  { id: 'direct', label: 'Cepat (Tanpa API)' },
  { id: 'gemini', label: 'Gemini AI' },
  { id: 'openai', label: 'OpenAI / Groq' },
  { id: 'ollama', label: 'Ollama Lokal' }
];

export default function McpLogsScreen() {
  const {
    apiBaseUrl,
    setApiBaseUrl,
    engine,
    setEngine,
    llmConfig,
    setLlmConfig,
    customerName,
    setCustomerName,
    health,
    refreshHealth
  } = useAppContext();

  const [urlDraft, setUrlDraft] = useState(apiBaseUrl);
  const [nameDraft, setNameDraft] = useState(customerName);
  const [geminiKeyDraft, setGeminiKeyDraft] = useState(llmConfig.geminiApiKey || '');
  const [geminiModelDraft, setGeminiModelDraft] = useState(
    !llmConfig.geminiModel || llmConfig.geminiModel === 'gemini-2.5-flash'
      ? 'gemini-3.8-flash'
      : llmConfig.geminiModel
  );
  const [openaiKeyDraft, setOpenaiKeyDraft] = useState(llmConfig.openaiApiKey || '');
  const [openaiBaseDraft, setOpenaiBaseDraft] = useState(
    llmConfig.openaiBaseUrl || 'https://api.openai.com/v1'
  );
  const [openaiModelDraft, setOpenaiModelDraft] = useState(llmConfig.openaiModel || 'gpt-4o-mini');
  const [ollamaUrlDraft, setOllamaUrlDraft] = useState(
    llmConfig.ollamaBaseUrl || 'http://127.0.0.1:11434'
  );
  const [ollamaModelDraft, setOllamaModelDraft] = useState(llmConfig.ollamaModel || 'qwen2.5:3b');

  // Progressive disclosure: keep advanced API keys and developer MCP logs collapsed by default
  const [showKeyFields, setShowKeyFields] = useState(false);
  const [showDevInspector, setShowDevInspector] = useState(false);

  const [testBanner, setTestBanner] = useState<{ ok: boolean; text: string } | null>(null);
  const [testingLlm, setTestingLlm] = useState(false);

  const [tools, setTools] = useState<McpToolDescriptor[]>([]);
  const [logs, setLogs] = useState<McpToolTraceEntry[]>([]);
  const [filterServer, setFilterServer] = useState<'all' | 'mcp-a' | 'mcp-b' | 'mcp-c'>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [invoking, setInvoking] = useState<string | null>(null);

  const buildDraftLlmConfig = () => ({
    geminiApiKey: geminiKeyDraft.trim() || undefined,
    geminiModel: geminiModelDraft.trim() || 'gemini-3.8-flash',
    openaiApiKey: openaiKeyDraft.trim() || undefined,
    openaiBaseUrl: openaiBaseDraft.trim() || 'https://api.openai.com/v1',
    openaiModel: openaiModelDraft.trim() || 'gpt-4o-mini',
    ollamaBaseUrl: ollamaUrlDraft.trim() || 'http://127.0.0.1:11434',
    ollamaModel: ollamaModelDraft.trim() || 'qwen2.5:3b'
  });

  useEffect(() => {
    if (llmConfig.geminiApiKey && !geminiKeyDraft) setGeminiKeyDraft(llmConfig.geminiApiKey);
    if (llmConfig.geminiModel && geminiModelDraft === 'gemini-2.5-flash') {
      setGeminiModelDraft(
        llmConfig.geminiModel === 'gemini-2.5-flash' ? 'gemini-3.8-flash' : llmConfig.geminiModel
      );
    }
    if (llmConfig.openaiApiKey && !openaiKeyDraft) setOpenaiKeyDraft(llmConfig.openaiApiKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [llmConfig]);

  const loadInspector = useCallback(async () => {
    setLoading(true);
    try {
      const [toolsRes, logsRes] = await Promise.all([
        ApiClient.getMcpTools(apiBaseUrl),
        ApiClient.getMcpLogs(apiBaseUrl, 60)
      ]);
      setTools(toolsRes.tools);
      setLogs(logsRes.logs);
      await refreshHealth();
    } catch {
      // Health error already handled by AppContext
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, refreshHealth]);

  useEffect(() => {
    loadInspector();
  }, [loadInspector]);

  const handleSaveSettings = async () => {
    const cfg = buildDraftLlmConfig();
    await setLlmConfig(cfg);
    await setApiBaseUrl(urlDraft);
    await setCustomerName(nameDraft.trim() || 'Maya');
    await loadInspector();
    setTestBanner({ ok: true, text: `Pengaturan disimpan & terhubung ke ${urlDraft}` });
  };

  const handleTestLlm = async (target: 'gemini' | 'openai' | 'ollama') => {
    const cfg = buildDraftLlmConfig();
    await setLlmConfig(cfg);
    setTestingLlm(true);
    setTestBanner(null);
    try {
      const res = await ApiClient.testLlm(urlDraft.trim().replace(/\/+$/, ''), target, cfg);
      setTestBanner({ ok: res.ok, text: `${res.engine}: ${res.detail}` });
    } catch (err) {
      setTestBanner({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setTestingLlm(false);
    }
  };

  const handleTestTool = async (tool: McpToolDescriptor) => {
    setInvoking(tool.namespacedName);
    try {
      let args: Record<string, unknown> = {};
      if (tool.name === 'get_bali_weather') args = { hub: 'CANGGU' };
      else if (tool.name === 'search_fleet') args = { category: 'SUV' };
      else if (tool.name === 'calculate_quote') args = { vehicleId: 'TOY-RAZ-04', days: 3, hub: 'CANGGU' };
      else if (tool.name === 'get_vehicle_details') args = { vehicleId: 'TOY-RAZ-04' };
      else if (tool.name === 'list_bookings') args = {};
      else if (tool.name === 'get_booking') args = { bookingId: 'ERB-2026-101' };
      else if (tool.name === 'search_nodes') args = { query: customerName || 'Maya' };

      await ApiClient.invokeMcpTool(apiBaseUrl, tool.namespacedName, args);
      await loadInspector();
    } catch (err) {
      Alert.alert('Gagal Menjalankan Tool', err instanceof Error ? err.message : String(err));
    } finally {
      setInvoking(null);
    }
  };

  const visibleLogs = logs.filter((l) => filterServer === 'all' || l.serverId === filterServer);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.innerWrap}>
          <Text style={styles.title}>Pengaturan</Text>
          <Text style={styles.subtitle}>Atur nama pemesan, mode AI, API key, dan log teknis MCP</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadInspector} tintColor={Theme.colors.primaryBright} />}
      >
        <View style={styles.innerWrap}>
          {/* Bagian 1: Pengaturan Harian Sederhana */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>Profil & Mode Asisten</Text>
              <View style={styles.statusBadge}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: health?.ok ? Theme.colors.primaryBright : Theme.colors.danger }
                  ]}
                />
                <Text style={styles.statusBadgeText}>
                  {health?.ok ? `${health.servers.length} MCP Aktif` : 'Terputus'}
                </Text>
              </View>
            </View>

            <Text style={styles.fieldLabel}>Nama Pemesan Default</Text>
            <TextInput
              value={nameDraft}
              onChangeText={setNameDraft}
              placeholder="Maya"
              placeholderTextColor={Theme.colors.textMuted}
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>Pilih Mode Asisten AI</Text>
            <View style={styles.engineRow}>
              {ENGINES.map((e) => {
                const active = engine === e.id;
                return (
                  <Pressable
                    key={e.id}
                    onPress={() => setEngine(e.id)}
                    style={[styles.engineChip, active && styles.engineChipActive]}
                  >
                    <Text style={[styles.engineText, active && styles.engineTextActive]}>{e.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.hintText}>
              Tip: Mode "Cepat (Tanpa API)" merespons instan tanpa kuota AI, sedangkan "Otomatis" memakai Gemini / OpenAI jika API Key diisi.
            </Text>

            {/* Bagian 2: Pengaturan Lanjutan (Accordion) */}
            <Pressable onPress={() => setShowKeyFields((v) => !v)} style={styles.accordionRow}>
              <View style={styles.accordionLeft}>
                <Ionicons name="key-outline" size={16} color={Theme.colors.mcpA} />
                <Text style={styles.accordionText}>Atur API Key & Server Backend</Text>
              </View>
              <Ionicons
                name={showKeyFields ? 'chevron-up' : 'chevron-down'}
                size={17}
                color={Theme.colors.textSecondary}
              />
            </Pressable>

            {showKeyFields && (
              <View style={styles.keysBox}>
                <Text style={styles.fieldLabel}>Alamat Server Backend (Orchestrator URL)</Text>
                <TextInput
                  value={urlDraft}
                  onChangeText={setUrlDraft}
                  placeholder="http://localhost:3001"
                  placeholderTextColor={Theme.colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                />

                <Text style={styles.fieldLabel}>Google Gemini API Key</Text>
                <TextInput
                  value={geminiKeyDraft}
                  onChangeText={setGeminiKeyDraft}
                  placeholder="AIza..."
                  placeholderTextColor={Theme.colors.textMuted}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                />
                <View style={styles.inlineRow}>
                  <TextInput
                    value={geminiModelDraft}
                    onChangeText={setGeminiModelDraft}
                    placeholder="gemini-3.8-flash"
                    placeholderTextColor={Theme.colors.textMuted}
                    autoCapitalize="none"
                    style={[styles.input, { flex: 1 }]}
                  />
                  <Pressable onPress={() => handleTestLlm('gemini')} disabled={testingLlm} style={styles.miniTestBtn}>
                    <Text style={styles.miniTestBtnText}>Tes Gemini</Text>
                  </Pressable>
                </View>

                <Text style={styles.fieldLabel}>OpenAI / Groq / OpenRouter API Key</Text>
                <TextInput
                  value={openaiKeyDraft}
                  onChangeText={setOpenaiKeyDraft}
                  placeholder="sk-... / gsk_... / sk-or-..."
                  placeholderTextColor={Theme.colors.textMuted}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                />
                <TextInput
                  value={openaiBaseDraft}
                  onChangeText={setOpenaiBaseDraft}
                  placeholder="https://api.openai.com/v1"
                  placeholderTextColor={Theme.colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                />
                <View style={styles.inlineRow}>
                  <TextInput
                    value={openaiModelDraft}
                    onChangeText={setOpenaiModelDraft}
                    placeholder="gpt-4o-mini"
                    placeholderTextColor={Theme.colors.textMuted}
                    autoCapitalize="none"
                    style={[styles.input, { flex: 1 }]}
                  />
                  <Pressable onPress={() => handleTestLlm('openai')} disabled={testingLlm} style={styles.miniTestBtn}>
                    <Text style={styles.miniTestBtnText}>Tes OpenAI</Text>
                  </Pressable>
                </View>

                <Text style={styles.fieldLabel}>Ollama Lokal (URL & Model)</Text>
                <TextInput
                  value={ollamaUrlDraft}
                  onChangeText={setOllamaUrlDraft}
                  placeholder="http://127.0.0.1:11434"
                  placeholderTextColor={Theme.colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                />
                <View style={styles.inlineRow}>
                  <TextInput
                    value={ollamaModelDraft}
                    onChangeText={setOllamaModelDraft}
                    placeholder="qwen2.5:3b"
                    placeholderTextColor={Theme.colors.textMuted}
                    autoCapitalize="none"
                    style={[styles.input, { flex: 1 }]}
                  />
                  <Pressable onPress={() => handleTestLlm('ollama')} disabled={testingLlm} style={styles.miniTestBtn}>
                    <Text style={styles.miniTestBtnText}>Tes Ollama</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {testBanner && (
              <View style={[styles.bannerBox, testBanner.ok ? styles.bannerOk : styles.bannerErr]}>
                <Text style={[styles.bannerText, { color: testBanner.ok ? Theme.colors.primaryBright : Theme.colors.danger }]}>
                  {testBanner.text}
                </Text>
              </View>
            )}

            <Pressable onPress={handleSaveSettings} style={styles.saveBtn}>
              {testingLlm ? (
                <ActivityIndicator size="small" color="#052E1E" />
              ) : (
                <Ionicons name="checkmark-circle-outline" size={17} color="#052E1E" />
              )}
              <Text style={styles.saveBtnText}>Simpan Pengaturan</Text>
            </Pressable>
          </View>

          {/* Bagian 3: Inspektor & Log MCP untuk Developer / Penilai */}
          <Pressable
            onPress={() => setShowDevInspector((v) => !v)}
            style={styles.devToggleCard}
          >
            <View style={styles.accordionLeft}>
              <Ionicons name="terminal-outline" size={17} color={Theme.colors.primaryBright} />
              <View>
                <Text style={styles.devTitle}>Inspektor & Log Teknis MCP</Text>
                <Text style={styles.devSub}>
                  {health?.servers.length ?? 0} server aktif · {tools.length} tool · {logs.length} riwayat log
                </Text>
              </View>
            </View>
            <Ionicons
              name={showDevInspector ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={Theme.colors.textSecondary}
            />
          </Pressable>

          {showDevInspector && (
            <View style={styles.devSection}>
              <Text style={styles.sectionTitle}>Server MCP Terhubung ({health?.servers.length ?? 0})</Text>
              {(health?.servers ?? []).map((s) => {
                const accent =
                  s.id === 'mcp-a' ? Theme.colors.mcpA : s.id === 'mcp-b' ? Theme.colors.mcpB : Theme.colors.mcpC;
                return (
                  <View key={s.id} style={[styles.serverCard, { borderLeftColor: accent }]}>
                    <View style={styles.serverTop}>
                      <Text style={[styles.serverLabel, { color: accent }]}>{s.label}</Text>
                      <Text style={styles.monoMeta}>
                        {s.toolCount} tools · {s.lastLatencyMs ?? '-'}ms
                      </Text>
                    </View>
                    <Text style={styles.serverRole}>{s.role}</Text>
                    <Text style={styles.serverPkg}>{s.packageRef}</Text>
                  </View>
                );
              })}

              <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Daftar Tool MCP ({tools.length})</Text>
              <View style={styles.toolsWrap}>
                {tools.map((t) => {
                  const accent =
                    t.serverId === 'mcp-a'
                      ? Theme.colors.mcpA
                      : t.serverId === 'mcp-b'
                      ? Theme.colors.mcpB
                      : Theme.colors.mcpC;
                  const canQuickTest =
                    t.serverId === 'mcp-a' ||
                    t.name === 'list_bookings' ||
                    t.name === 'get_booking' ||
                    t.name === 'read_graph' ||
                    t.name === 'search_nodes';
                  return (
                    <View key={t.namespacedName} style={styles.toolRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.toolName, { color: accent }]}>{t.namespacedName}</Text>
                        <Text style={styles.toolDesc} numberOfLines={2}>
                          {t.description}
                        </Text>
                      </View>
                      {canQuickTest && (
                        <Pressable
                          onPress={() => handleTestTool(t)}
                          disabled={invoking === t.namespacedName}
                          style={styles.testBtn}
                        >
                          {invoking === t.namespacedName ? (
                            <ActivityIndicator size="small" color={Theme.colors.primaryBright} />
                          ) : (
                            <Text style={styles.testBtnText}>Uji</Text>
                          )}
                        </Pressable>
                      )}
                    </View>
                  );
                })}
              </View>

              <View style={styles.streamHeader}>
                <Text style={styles.sectionTitle}>Riwayat Eksekusi JSON-RPC ({visibleLogs.length})</Text>
                <View style={styles.filterRow}>
                  {(['all', 'mcp-a', 'mcp-b', 'mcp-c'] as const).map((f) => (
                    <Pressable
                      key={f}
                      onPress={() => setFilterServer(f)}
                      style={[styles.filterPill, filterServer === f && styles.filterPillActive]}
                    >
                      <Text style={[styles.filterText, filterServer === f && styles.filterTextActive]}>
                        {f === 'all' ? 'SEMUA' : f.toUpperCase()}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {visibleLogs.map((log) => {
                const accent =
                  log.serverId === 'mcp-a'
                    ? Theme.colors.mcpA
                    : log.serverId === 'mcp-b'
                    ? Theme.colors.mcpB
                    : Theme.colors.mcpC;
                const isOpen = expandedLogId === log.id;
                return (
                  <Pressable
                    key={log.id}
                    onPress={() => setExpandedLogId(isOpen ? null : log.id)}
                    style={[styles.logCard, { borderLeftColor: accent }]}
                  >
                    <View style={styles.logTop}>
                      <Text style={[styles.logTool, { color: accent }]}>
                        {log.serverId.toUpperCase()} · {log.toolName}
                      </Text>
                      <Text style={styles.monoMeta}>
                        {log.durationMs}ms · {new Date(log.timestamp).toLocaleTimeString()}
                      </Text>
                    </View>
                    <Text style={styles.logArgs} numberOfLines={isOpen ? undefined : 1}>
                      args: {JSON.stringify(log.arguments)}
                    </Text>
                    {isOpen && (
                      <View style={styles.jsonBox}>
                        <Text style={styles.jsonText}>{JSON.stringify(log.result, null, 2)}</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Theme.colors.canvas },
  innerWrap: {
    width: '100%',
    maxWidth: Theme.layout.maxWidth,
    alignSelf: 'center',
    gap: 10
  },
  header: {
    backgroundColor: Theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  title: { color: Theme.colors.textPrimary, fontSize: 18, fontWeight: '800' },
  subtitle: { color: Theme.colors.textSecondary, fontSize: 12, marginTop: 2 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 36 },
  card: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 16,
    gap: 10
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8
  },
  cardTitle: { color: Theme.colors.textPrimary, fontSize: 15, fontWeight: '700' },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Theme.colors.canvas,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusBadgeText: { color: Theme.colors.textSecondary, fontSize: 11, fontWeight: '600' },
  fieldLabel: { color: Theme.colors.textSecondary, fontSize: 12, fontWeight: '600', marginTop: 2 },
  input: {
    backgroundColor: Theme.colors.canvas,
    borderWidth: 1,
    borderColor: Theme.colors.borderLight,
    borderRadius: Theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Theme.colors.textPrimary,
    fontSize: 13
  },
  engineRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  engineChip: {
    backgroundColor: Theme.colors.canvas,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  engineChipActive: { backgroundColor: Theme.colors.primarySoft, borderColor: Theme.colors.primaryBright },
  engineText: { color: Theme.colors.textSecondary, fontSize: 12, fontWeight: '600' },
  engineTextActive: { color: Theme.colors.primaryBright },
  hintText: { color: Theme.colors.textMuted, fontSize: 12, lineHeight: 17 },
  accordionRow: {
    marginTop: 4,
    paddingVertical: 11,
    paddingHorizontal: 12,
    backgroundColor: Theme.colors.canvas,
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  accordionLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  accordionText: { color: Theme.colors.mcpA, fontSize: 13, fontWeight: '600' },
  keysBox: {
    backgroundColor: Theme.colors.canvas,
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 12,
    gap: 8
  },
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  miniTestBtn: {
    backgroundColor: Theme.colors.mcpASoft,
    borderColor: Theme.colors.mcpABorder,
    borderWidth: 1,
    borderRadius: Theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  miniTestBtnText: { color: Theme.colors.mcpA, fontSize: 12, fontWeight: '700' },
  bannerBox: { borderRadius: Theme.radius.md, borderWidth: 1, padding: 10 },
  bannerOk: { backgroundColor: Theme.colors.primarySoft, borderColor: Theme.colors.primaryBorder },
  bannerErr: { backgroundColor: Theme.colors.dangerSoft, borderColor: Theme.colors.dangerBorder },
  bannerText: { fontSize: 12, lineHeight: 17 },
  saveBtn: {
    marginTop: 4,
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.radius.md,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  saveBtnText: { color: '#052E1E', fontSize: 13, fontWeight: '800' },
  devToggleCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  devTitle: { color: Theme.colors.textPrimary, fontSize: 14, fontWeight: '700' },
  devSub: { color: Theme.colors.textSecondary, fontSize: 12, marginTop: 2 },
  devSection: { gap: 10 },
  sectionTitle: { color: Theme.colors.textPrimary, fontSize: 14, fontWeight: '700' },
  serverCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderLeftWidth: 3,
    padding: 12,
    gap: 4
  },
  serverTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  serverLabel: { fontSize: 12, fontWeight: '800', flex: 1 },
  monoMeta: { color: Theme.colors.textSecondary, fontSize: 11, fontFamily: Theme.fonts.mono },
  serverRole: { color: Theme.colors.textPrimary, fontSize: 12 },
  serverPkg: { color: Theme.colors.textMuted, fontSize: 11, fontFamily: Theme.fonts.mono },
  toolsWrap: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 12,
    gap: 8
  },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border
  },
  toolName: { fontSize: 12, fontWeight: '700', fontFamily: Theme.fonts.mono },
  toolDesc: { color: Theme.colors.textSecondary, fontSize: 11, marginTop: 2 },
  testBtn: {
    backgroundColor: Theme.colors.primarySoft,
    borderColor: Theme.colors.primaryBorder,
    borderWidth: 1,
    borderRadius: Theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  testBtnText: { color: Theme.colors.primaryBright, fontSize: 11, fontWeight: '700' },
  streamHeader: { marginTop: 6, gap: 8 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  filterPill: {
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  filterPillActive: { backgroundColor: Theme.colors.mcpASoft, borderColor: Theme.colors.mcpA },
  filterText: { color: Theme.colors.textSecondary, fontSize: 11, fontWeight: '600' },
  filterTextActive: { color: Theme.colors.mcpA },
  logCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderLeftWidth: 3,
    padding: 10,
    gap: 4
  },
  logTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  logTool: { fontSize: 11, fontWeight: '800', fontFamily: Theme.fonts.mono },
  logArgs: { color: Theme.colors.textSecondary, fontSize: 11, fontFamily: Theme.fonts.mono },
  jsonBox: {
    marginTop: 6,
    backgroundColor: '#0A0F16',
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: Theme.colors.border
  },
  jsonText: { color: '#CBD5E1', fontSize: 10, fontFamily: Theme.fonts.mono }
});
