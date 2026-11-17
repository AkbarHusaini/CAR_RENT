import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
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
  McpToolTraceEntry
} from '@/services/api';

const MAYA_AVATAR =
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&auto=format&fit=crop&q=80';
const CUSTOMER_AVATAR =
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=160&auto=format&fit=crop&q=80';

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

export default function ChatScreen() {
  const router = useRouter();
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const {
    apiBaseUrl,
    engine,
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

  const todayDateString = `Hari Ini, ${new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long'
  })}`;

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      role: 'assistant',
      timestamp: '10:35 AM',
      text:
        'Halo Kak! Meja favoritmu dan unit rental pilihan di **Canggu Hub** sudah disiapkan ya. 🌴\n\n' +
        'Silakan ketuk saran rekomendasi di bawah atau ketik langsung kebutuhan sewa kendaraanmu.'
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
        ? 'Permintaan dibatalkan atau melewati batas waktu. Silakan coba kirim ulang.'
        : isNetworkDown
        ? `Belum dapat terhubung ke server backend (${apiBaseUrl}). Pastikan backend sudah berjalan lalu coba lagi.`
        : `Terjadi kendala sementara saat memproses permintaan (${rawMsg.slice(0, 140)}). Silakan coba kirim ulang.`;
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

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Tier 1: Top Navigation Bar */}
      <View style={styles.topNav}>
        <View style={[styles.innerWrap, styles.topNavRow]}>
          <Pressable onPress={() => router.push('/fleet')} style={styles.circleBtn}>
            <Ionicons name="arrow-back" size={19} color="#4E3629" />
          </Pressable>

          <View style={styles.topCenterTitleWrap}>
            <View style={styles.miniLogoBox}>
              <Ionicons name="cafe-outline" size={14} color="#4E3629" />
            </View>
            <Text style={styles.topTitleText}>Direct Chat</Text>
          </View>

          <Image source={{ uri: CUSTOMER_AVATAR }} style={styles.customerAvatar} />
        </View>
      </View>

      {/* Tier 2: Concierge Agent Profile Bar */}
      <View style={styles.agentBar}>
        <View style={[styles.innerWrap, styles.agentBarRow]}>
          <View style={styles.agentAvatarWrap}>
            <Image source={{ uri: MAYA_AVATAR }} style={styles.agentAvatar} />
            <View style={styles.agentBadgeDot}>
              <Ionicons name="cafe" size={8} color="#FFFFFF" />
            </View>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.agentName}>Barista Maya</Text>
            <View style={styles.agentStatusRow}>
              <Ionicons name="cafe-outline" size={12} color="#7D6F64" />
              <Text style={styles.agentStatusText} numberOfLines={1}>
                {health?.ok
                  ? `Sedang menyeduh kopi & menyiapkan unit ${formatHubLabel(preferredHub)}...`
                  : healthError || 'Menghubungkan ke layanan...'}
              </Text>
            </View>
          </View>

          <View style={styles.agentActionsGroup}>
            <Pressable
              onPress={() =>
                Linking.openURL('https://wa.me/6288999999060').catch(() =>
                  Alert.alert('Hubungi WhatsApp', '088999999060')
                )
              }
              style={styles.circleBtn}
            >
              <Ionicons name="call-outline" size={17} color="#4E3629" />
            </Pressable>
            <Pressable onPress={() => router.push('/fleet')} style={styles.circleBtn}>
              <Ionicons name="storefront-outline" size={17} color="#4E3629" />
            </Pressable>
          </View>
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
          <View style={[styles.innerWrap, { gap: 14 }]}>
            {/* Center Date Pill Divider */}
            <View style={styles.datePillWrap}>
              <View style={styles.datePill}>
                <Ionicons name="calendar-outline" size={12} color="#7D6555" />
                <Text style={styles.datePillText}>{todayDateString}</Text>
              </View>
            </View>

            {messages.map((m) => {
              if (m.role === 'user') {
                return (
                  <View key={m.id} style={styles.userMsgWrap}>
                    <View style={styles.userBubble}>
                      <Text style={styles.userText}>{m.text}</Text>
                      <View style={styles.userTimeRow}>
                        <Text style={styles.userTimestamp}>{m.timestamp} ✓✓</Text>
                      </View>
                    </View>
                  </View>
                );
              }

              return (
                <View key={m.id} style={styles.botMsgWrap}>
                  <View style={styles.botBubbleRow}>
                    <Image source={{ uri: MAYA_AVATAR }} style={styles.botAvatarInline} />
                    <View style={styles.botBubble}>
                      <FormattedText text={m.text} style={styles.botText} boldStyle={{ color: '#2D231C' }} />
                      <Text style={styles.botTimestamp}>{m.timestamp}</Text>
                    </View>
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

            {/* Cozy Warm Status Banner */}
            <View style={styles.statusPillBanner}>
              <Ionicons name="flame-outline" size={13} color="#7D553A" />
              <Text style={styles.statusPillText}>
                {health?.ok
                  ? `Suhu Canggu: ${Math.round(messages.find((m) => m.weather)?.weather?.temperatureC ?? 30)}°C · Armada disiapkan tepat waktu & bersih`
                  : 'Menghubungkan ke layanan Easy Rent Bali...'}
              </Text>
            </View>

            {sending && (
              <View style={styles.loadingCard}>
                <ActivityIndicator size="small" color="#4E3629" />
                <Text style={styles.loadingText}>Sedang menyiapkan jawaban ({elapsedSec} detik)...</Text>
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
              <Pressable
                onPress={() => setInput('Halo Maya, apa rekomendasi kendaraan terbaik hari ini?')}
                style={styles.attachBtn}
              >
                <Ionicons name="attach-outline" size={20} color="#4E3629" />
              </Pressable>

              <View style={styles.inputWrap}>
                <TextInput
                  value={input}
                  onChangeText={setInput}
                  placeholder="Ketik pesan hangat..."
                  placeholderTextColor="#A89B8F"
                  style={styles.textInput}
                  multiline={false}
                  returnKeyType="send"
                  onSubmitEditing={() => sendMessage()}
                />
                <Ionicons name="happy-outline" size={20} color="#7D6F64" style={styles.emojiIcon} />
              </View>

              <Pressable
                onPress={() => sendMessage()}
                disabled={sending || input.trim().length === 0}
                style={[styles.sendBtn, (sending || input.trim().length === 0) && { opacity: 0.45 }]}
              >
                <Ionicons name="send" size={17} color="#FFFFFF" />
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
    backgroundColor: '#FAF7F2'
  },
  innerWrap: {
    width: '100%',
    maxWidth: Theme.layout.maxWidth,
    alignSelf: 'center'
  },
  topNav: {
    backgroundColor: '#FAF7F2',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10
  },
  topNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  circleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F4EDE4',
    alignItems: 'center',
    justifyContent: 'center'
  },
  topCenterTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  miniLogoBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#F4EDE4',
    alignItems: 'center',
    justifyContent: 'center'
  },
  topTitleText: {
    color: '#2D231C',
    fontSize: 18,
    fontWeight: '700'
  },
  customerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F4EDE4'
  },
  agentBar: {
    backgroundColor: '#FAF7F2',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EDE4DA'
  },
  agentBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  agentAvatarWrap: {
    position: 'relative'
  },
  agentAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F4EDE4'
  },
  agentBadgeDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#4E3629',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FAF7F2'
  },
  agentName: {
    color: '#2D231C',
    fontSize: 15,
    fontWeight: '700'
  },
  agentStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2
  },
  agentStatusText: {
    color: '#7D6F64',
    fontSize: 12,
    flex: 1
  },
  agentActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  datePillWrap: {
    alignItems: 'center',
    marginVertical: 4
  },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F4ECE2',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EADECF',
    paddingHorizontal: 14,
    paddingVertical: 5
  },
  datePillText: {
    color: '#7D6555',
    fontSize: 12,
    fontWeight: '600'
  },
  chatScroll: {
    flex: 1
  },
  chatContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24
  },
  userMsgWrap: {
    alignItems: 'flex-end',
    marginVertical: 4
  },
  userBubble: {
    maxWidth: '82%',
    backgroundColor: '#4E3629',
    borderRadius: 20,
    borderBottomRightRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#4E3629',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2
  },
  userText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 21
  },
  userTimeRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4
  },
  userTimestamp: {
    color: '#D8C6B6',
    fontSize: 10,
    fontWeight: '500'
  },
  botMsgWrap: {
    alignItems: 'stretch',
    marginVertical: 4
  },
  botBubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    maxWidth: '88%'
  },
  botAvatarInline: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F4EDE4'
  },
  botBubble: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EDE4DA',
    borderRadius: 20,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#4E3629',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
    flex: 1
  },
  botText: {
    color: '#2D231C',
    fontSize: 14,
    lineHeight: 21
  },
  botTimestamp: {
    color: '#9E9084',
    fontSize: 10,
    alignSelf: 'flex-end',
    marginTop: 4
  },
  statusPillBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FCEFE3',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F3DEC9',
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: 'center',
    marginVertical: 6
  },
  statusPillText: {
    color: '#7D553A',
    fontSize: 12,
    fontWeight: '600'
  },
  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EDE4DA',
    borderRadius: Theme.radius.lg,
    padding: 12
  },
  loadingText: {
    color: '#7D6F64',
    fontSize: 13,
    flex: 1
  },
  cancelReqBtn: {
    backgroundColor: '#FFF5F5',
    borderColor: '#FEB2B2',
    borderWidth: 1,
    borderRadius: Theme.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  cancelReqText: {
    color: '#C53030',
    fontSize: 12,
    fontWeight: '700'
  },
  quickDock: {
    backgroundColor: '#FAF7F2',
    borderTopWidth: 1,
    borderTopColor: '#EDE4DA',
    paddingTop: 8,
    paddingBottom: 12,
    paddingHorizontal: 16
  },
  quickScroll: {
    gap: 8,
    paddingBottom: 8
  },
  quickChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EDE4DA',
    borderRadius: Theme.radius.pill,
    paddingHorizontal: 13,
    paddingVertical: 7,
    shadowColor: '#4E3629',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1
  },
  quickChipText: {
    color: '#4E3629',
    fontSize: 12,
    fontWeight: '600'
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  attachBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F4EDE4',
    alignItems: 'center',
    justifyContent: 'center'
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EDE4DA',
    borderRadius: 25,
    height: 46,
    paddingHorizontal: 14,
    shadowColor: '#4E3629',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1
  },
  textInput: {
    flex: 1,
    color: '#2D231C',
    fontSize: 14,
    paddingRight: 8
  },
  emojiIcon: {
    marginLeft: 4
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4E3629',
    alignItems: 'center',
    justifyContent: 'center'
  }
});
