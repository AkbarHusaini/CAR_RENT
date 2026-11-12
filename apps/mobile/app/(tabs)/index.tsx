import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BookingCard } from '@/components/BookingCard';
import { FleetCard } from '@/components/FleetCard';
import { FormattedText } from '@/components/FormattedText';
import { McpTraceCard } from '@/components/McpTraceCard';
import { WeatherCard } from '@/components/WeatherCard';
import { formatHubLabel, Theme } from '@/constants/theme';
import { useAppContext } from '@/context/AppContext';
import {
  ApiClient,
  BaliWeatherReport,
  BookingRecord,
  FleetVehicle,
  LlmEngineMode,
  McpToolTraceEntry
} from '@/services/api';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  engineUsed?: string;
  totalDurationMs?: number;
  trace?: McpToolTraceEntry[];
  booking?: BookingRecord | null;
  bookingsList?: BookingRecord[] | null;
  vehicles?: FleetVehicle[];
  weather?: BaliWeatherReport | null;
}

const QUICK_PROMPTS = [
  {
    label: '🚗 Sewa SUV di Canggu',
    prompt: 'Sewa SUV matic di Canggu buat besok selama 3 hari atas nama Maya'
  },
  {
    label: '🌦️ Cek Cuaca Canggu',
    prompt: 'Cek cuaca di Canggu dan rekomendasikan mobil atau motor yang cocok'
  },
  {
    label: '📋 Pesanan Saya',
    prompt: 'Lihat daftar pesanan saya'
  },
  {
    label: '📍 Pindah ke Ubud',
    prompt: 'Ubah lokasi jemput pesanan terakhir ke Ubud selama 4 hari tambah surf rack'
  },
  {
    label: '🛵 Sewa NMAX Seminyak',
    prompt: 'Pesan Yamaha NMAX di Seminyak untuk 2 hari atas nama Maya'
  },
  {
    label: '⭐ Simpan Preferensi',
    prompt: 'Ingat ya, Maya lebih suka SUV matic dengan surf rack di Canggu'
  }
];

const ENGINE_CYCLE: LlmEngineMode[] = ['auto', 'direct', 'gemini', 'openai', 'ollama'];

function getEngineLabel(mode: LlmEngineMode): string {
  switch (mode) {
    case 'auto':
      return 'Otomatis';
    case 'direct':
      return 'Cepat';
    case 'gemini':
      return 'Gemini';
    case 'openai':
      return 'OpenAI';
    case 'ollama':
      return 'Ollama';
  }
}

export default function ChatScreen() {
  const router = useRouter();
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const {
    apiBaseUrl,
    engine,
    setEngine,
    llmConfig,
    customerName,
    preferredHub,
    health,
    healthError,
    refreshHealth,
    pendingPrompt,
    setPendingPrompt,
    setActiveVoucherBooking,
    bumpBookingsVersion
  } = useAppContext();

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      role: 'assistant',
      timestamp: 'Siap',
      text:
        'Halo! Saya asisten **Easy Rent Bali**.\n\n' +
        'Pilih salah satu menu cepat di bawah atau ketik kebutuhan sewa mobil, motor, maupun cek cuaca Bali.'
    }
  ]);

  const sendMessage = async (textOverride?: string) => {
    const trimmed = (textOverride ?? input).trim();
    if (!trimmed || sending) return;

    if (!textOverride) setInput('');
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setSending(true);
    setElapsedSec(0);

    const controller = new AbortController();
    abortRef.current = controller;
    const timer = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    const hardTimeout = setTimeout(() => controller.abort(), 65000);

    try {
      const history = nextMessages
        .filter((m) => m.id !== 'welcome-1')
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.text }));

      const res = await ApiClient.sendChat(
        apiBaseUrl,
        {
          message: trimmed,
          customerName,
          preferredHub,
          engine,
          llmConfig,
          history
        },
        controller.signal
      );

      const botMsg: ChatMessage = {
        id: `a_${Date.now()}`,
        role: 'assistant',
        text: res.fallbackReason ? `${res.reply}\n\n_(Catatan: ${res.fallbackReason})_` : res.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        engineUsed: res.engineUsed,
        totalDurationMs: res.totalDurationMs,
        trace: res.trace,
        booking: res.booking,
        bookingsList: res.bookingsList,
        vehicles: res.vehicles,
        weather: res.weather
      };

      setMessages((prev) => [...prev, botMsg]);
      if (res.trace.some((t) => t.serverId === 'mcp-b')) {
        bumpBookingsVersion();
      }
      refreshHealth().catch(() => {});
    } catch (err) {
      const isAbort = err instanceof Error && err.name === 'AbortError';
      const rawMsg = err instanceof Error ? err.message : String(err);
      const isNetworkDown =
        /failed to fetch|network request failed|econnrefused|load failed/i.test(rawMsg);
      const friendlyMsg = isAbort
        ? `Permintaan dibatalkan atau melewati batas waktu pada mode "${getEngineLabel(engine)}". Coba pilih mode **Cepat** di kanan atas.`
        : isNetworkDown
        ? `Belum dapat terhubung ke server backend (${apiBaseUrl}). Pastikan backend sudah berjalan lalu coba lagi.`
        : `Terjadi kendala sementara saat memproses permintaan (${rawMsg.slice(0, 140)}). Coba ganti mode di pojok kanan atas ke **Cepat**.`;
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: 'assistant',
          text: friendlyMsg,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      clearInterval(timer);
      clearTimeout(hardTimeout);
      abortRef.current = null;
      setSending(false);
    }
  };

  useEffect(() => {
    if (pendingPrompt) {
      const promptToRun = pendingPrompt;
      setPendingPrompt(null);
      sendMessage(promptToRun);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPrompt]);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }, [messages.length, sending]);

  const handleOpenVoucher = (booking: BookingRecord) => {
    setActiveVoucherBooking(booking);
    router.push('/modal');
  };

  const handleExtendBooking = async (booking: BookingRecord) => {
    setMutatingId(booking.booking_id);
    try {
      const res = await ApiClient.updateBooking(apiBaseUrl, booking.booking_id, {
        days: booking.days + 1,
        notes: `Diperpanjang menjadi ${booking.days + 1} hari dari Chat`
      });
      bumpBookingsVersion();
      setMessages((prev) => [
        ...prev,
        {
          id: `upd_${Date.now()}`,
          role: 'assistant',
          text: `Durasi **#${res.booking.booking_id}** diperpanjang menjadi **${res.booking.days} hari**.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          engineUsed: 'direct-mcp-mutation',
          trace: [res.trace],
          booking: res.booking
        }
      ]);
    } catch (err) {
      Alert.alert('Gagal Memperbarui', err instanceof Error ? err.message : String(err));
    } finally {
      setMutatingId(null);
    }
  };

  const handleCancelBooking = async (booking: BookingRecord) => {
    setMutatingId(booking.booking_id);
    try {
      const res = await ApiClient.cancelBooking(apiBaseUrl, booking.booking_id);
      bumpBookingsVersion();
      setMessages((prev) => [
        ...prev,
        {
          id: `can_${Date.now()}`,
          role: 'assistant',
          text: `Pesanan **#${res.booking.booking_id}** telah dibatalkan.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          engineUsed: 'direct-mcp-mutation',
          trace: [res.trace],
          booking: res.booking
        }
      ]);
    } catch (err) {
      Alert.alert('Gagal Membatalkan', err instanceof Error ? err.message : String(err));
    } finally {
      setMutatingId(null);
    }
  };

  const handleQuickBookVehicle = async (vehicle: FleetVehicle) => {
    await sendMessage(
      `Pesan ${vehicle.name} di ${formatHubLabel(preferredHub)} untuk 3 hari atas nama ${customerName || 'Maya'}`
    );
  };

  const cycleEngine = () => {
    const idx = ENGINE_CYCLE.indexOf(engine);
    const next = ENGINE_CYCLE[(idx + 1) % ENGINE_CYCLE.length];
    setEngine(next);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Clean Simple Header */}
      <View style={styles.header}>
        <View style={[styles.innerWrap, styles.brandRow]}>
          <View style={styles.logoBox}>
            <Ionicons name="car-sport" size={18} color={Theme.colors.primaryBright} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.brandTitle}>Easy Rent Bali</Text>
            <View style={styles.statusSubRow}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: health?.ok ? Theme.colors.primaryBright : Theme.colors.danger }
                ]}
              />
              <Text style={styles.statusSubText} numberOfLines={1}>
                {health?.ok
                  ? `Siap membantu · Hub ${formatHubLabel(preferredHub)}`
                  : healthError || 'Menghubungkan ke server...'}
              </Text>
            </View>
          </View>
          <Pressable onPress={cycleEngine} style={styles.enginePill}>
            <Ionicons name="sparkles-outline" size={13} color={Theme.colors.mcpA} />
            <Text style={styles.enginePillText}>{getEngineLabel(engine)}</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/logs')} style={styles.iconBtn}>
            <Ionicons name="settings-outline" size={17} color={Theme.colors.textPrimary} />
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.chatScroll}
          contentContainerStyle={styles.chatContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.innerWrap, { gap: 16 }]}>
            {messages.map((m) => {
              if (m.role === 'user') {
                return (
                  <View key={m.id} style={styles.userMsgWrap}>
                    <View style={styles.userBubble}>
                      <Text style={styles.userText}>{m.text}</Text>
                    </View>
                    <Text style={styles.msgTimestamp}>{m.timestamp} ✓✓</Text>
                  </View>
                );
              }

              return (
                <View key={m.id} style={styles.botMsgWrap}>
                  <View style={styles.botHeader}>
                    <View style={styles.botAvatar}>
                      <Ionicons name="car-sport" size={13} color={Theme.colors.primaryBright} />
                    </View>
                    <Text style={styles.botName}>Easy Rent Bali</Text>
                    <Text style={styles.botTimeTag}>{m.timestamp}</Text>
                  </View>

                  <View style={styles.botBubble}>
                    <FormattedText text={m.text} style={styles.botText} />
                  </View>

                  {!m.booking && m.weather && <WeatherCard weather={m.weather} />}

                  {m.booking && (
                    <BookingCard
                      booking={m.booking}
                      weather={m.weather}
                      busy={mutatingId === m.booking.booking_id}
                      onViewVoucher={handleOpenVoucher}
                      onExtendOneDay={handleExtendBooking}
                      onCancel={handleCancelBooking}
                    />
                  )}

                  {!m.booking && m.bookingsList && m.bookingsList.length > 0 && (
                    <View style={{ marginTop: 6 }}>
                      {m.bookingsList.slice(0, 3).map((bk) => (
                        <BookingCard
                          key={bk.booking_id}
                          booking={bk}
                          busy={mutatingId === bk.booking_id}
                          onViewVoucher={handleOpenVoucher}
                          onExtendOneDay={handleExtendBooking}
                          onCancel={handleCancelBooking}
                        />
                      ))}
                    </View>
                  )}

                  {!m.booking && m.vehicles && m.vehicles.length > 0 && (
                    <View style={{ marginTop: 8 }}>
                      {m.vehicles.slice(0, 3).map((v) => (
                        <FleetCard
                          key={v.id}
                          vehicle={v}
                          compact
                          busy={sending}
                          onQuickBook={handleQuickBookVehicle}
                        />
                      ))}
                    </View>
                  )}

                  {m.trace && m.trace.length > 0 && (
                    <McpTraceCard
                      trace={m.trace}
                      totalDurationMs={m.totalDurationMs}
                      engineUsed={m.engineUsed}
                    />
                  )}
                </View>
              );
            })}

            {sending && (
              <View style={styles.loadingCard}>
                <ActivityIndicator size="small" color={Theme.colors.primaryBright} />
                <Text style={styles.loadingText}>Sedang memproses ({elapsedSec} detik)...</Text>
                <Pressable onPress={() => abortRef.current?.abort()} style={styles.cancelReqBtn}>
                  <Text style={styles.cancelReqText}>Batal</Text>
                </Pressable>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Bottom Dock */}
        <View style={styles.quickDock}>
          <View style={styles.innerWrap}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickScroll}>
              {QUICK_PROMPTS.map((qp) => (
                <Pressable
                  key={qp.label}
                  onPress={() => sendMessage(qp.prompt)}
                  disabled={sending}
                  style={({ pressed }) => [styles.quickChip, pressed && { opacity: 0.7 }]}
                >
                  <Text style={styles.quickChipText}>{qp.label}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.composerRow}>
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="Ketik pertanyaan, cek cuaca, atau sewa kendaraan..."
                placeholderTextColor={Theme.colors.textMuted}
                style={styles.textInput}
                multiline={false}
                returnKeyType="send"
                onSubmitEditing={() => sendMessage()}
              />
              <Pressable
                onPress={() => sendMessage()}
                disabled={sending || input.trim().length === 0}
                style={[styles.sendBtn, (sending || input.trim().length === 0) && { opacity: 0.45 }]}
              >
                <Ionicons name="arrow-up" size={20} color="#052E1E" />
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Theme.colors.canvas
  },
  innerWrap: {
    width: '100%',
    maxWidth: Theme.layout.maxWidth,
    alignSelf: 'center'
  },
  header: {
    backgroundColor: Theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 11
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  logoBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Theme.colors.primarySoft,
    borderWidth: 1,
    borderColor: Theme.colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center'
  },
  brandTitle: {
    color: Theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '800'
  },
  statusSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4
  },
  statusSubText: {
    color: Theme.colors.textSecondary,
    fontSize: 12,
    flex: 1
  },
  enginePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Theme.colors.mcpASoft,
    borderColor: Theme.colors.mcpABorder,
    borderWidth: 1,
    borderRadius: Theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  enginePillText: {
    color: Theme.colors.mcpA,
    fontSize: 11,
    fontWeight: '700'
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: Theme.colors.canvas,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  chatScroll: {
    flex: 1
  },
  chatContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24
  },
  userMsgWrap: {
    alignItems: 'flex-end'
  },
  userBubble: {
    maxWidth: '82%',
    backgroundColor: Theme.colors.userBubble,
    borderWidth: 1,
    borderColor: Theme.colors.userBubbleBorder,
    borderRadius: Theme.radius.lg,
    borderBottomRightRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  userText: {
    color: Theme.colors.textPrimary,
    fontSize: 14,
    lineHeight: 20
  },
  msgTimestamp: {
    color: Theme.colors.textMuted,
    fontSize: 10,
    marginTop: 4
  },
  botMsgWrap: {
    alignItems: 'stretch'
  },
  botHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8
  },
  botAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Theme.colors.primarySoft,
    borderWidth: 1,
    borderColor: Theme.colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center'
  },
  botName: {
    color: Theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: '700'
  },
  botTimeTag: {
    color: Theme.colors.textMuted,
    fontSize: 11
  },
  botBubble: {
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radius.lg,
    paddingHorizontal: 15,
    paddingVertical: 12
  },
  botText: {
    color: '#E2E8F0',
    fontSize: 14,
    lineHeight: 21
  },
  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.mcpABorder,
    borderRadius: Theme.radius.lg,
    padding: 12
  },
  loadingText: {
    color: Theme.colors.mcpA,
    fontSize: 13,
    flex: 1
  },
  cancelReqBtn: {
    backgroundColor: Theme.colors.dangerSoft,
    borderColor: Theme.colors.dangerBorder,
    borderWidth: 1,
    borderRadius: Theme.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  cancelReqText: {
    color: Theme.colors.danger,
    fontSize: 12,
    fontWeight: '700'
  },
  quickDock: {
    backgroundColor: Theme.colors.canvas,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border,
    paddingTop: 10,
    paddingBottom: 12,
    paddingHorizontal: 16
  },
  quickScroll: {
    gap: 8,
    paddingBottom: 10
  },
  quickChip: {
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.borderLight,
    borderRadius: Theme.radius.pill,
    paddingHorizontal: 13,
    paddingVertical: 7
  },
  quickChipText: {
    color: Theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: '600'
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  textInput: {
    flex: 1,
    height: 46,
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.borderLight,
    borderRadius: Theme.radius.pill,
    paddingHorizontal: 16,
    color: Theme.colors.textPrimary,
    fontSize: 14
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center'
  }
});
