import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BookingCard } from '@/components/BookingCard';
import { formatHubLabel, Theme } from '@/constants/theme';
import { useAppContext } from '@/context/AppContext';
import { ApiClient, BookingRecord } from '@/services/api';

const STATUS_FILTERS = [
  { code: 'all', label: 'Semua' },
  { code: 'confirmed', label: 'Terkonfirmasi' },
  { code: 'active', label: 'Aktif' },
  { code: 'cancelled', label: 'Dibatalkan' }
] as const;

const HUB_CYCLE = ['CANGGU', 'UBUD', 'SEMINYAK', 'KUTA', 'AIRPORT_DPS', 'ULUWATU'];

export default function BookingsScreen() {
  const router = useRouter();
  const { apiBaseUrl, bookingsVersion, bumpBookingsVersion, setActiveVoucherBooking } = useAppContext();

  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]['code']>('all');
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [memoryEntities, setMemoryEntities] = useState<
    Array<{ name: string; entityType: string; observations: string[] }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [bkRes, memRes] = await Promise.all([
        ApiClient.getBookings(apiBaseUrl, statusFilter),
        ApiClient.getMemory(apiBaseUrl)
      ]);
      setBookings(bkRes.bookings);
      setMemoryEntities(memRes.graph?.entities ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData, bookingsVersion]);

  const handleExtend = async (booking: BookingRecord) => {
    setBusyId(booking.booking_id);
    try {
      await ApiClient.updateBooking(apiBaseUrl, booking.booking_id, {
        days: booking.days + 1,
        notes: `Durasi diperpanjang +1 hari`
      });
      bumpBookingsVersion();
    } catch (err) {
      Alert.alert('Gagal Memperbarui', err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  const handleSwitchHub = async (booking: BookingRecord) => {
    const idx = HUB_CYCLE.indexOf(booking.pickup_hub);
    const nextHub = HUB_CYCLE[(idx + 1) % HUB_CYCLE.length];
    setBusyId(booking.booking_id);
    try {
      await ApiClient.updateBooking(apiBaseUrl, booking.booking_id, {
        pickupHub: nextHub,
        notes: `Lokasi jemput diubah ke ${formatHubLabel(nextHub)}`
      });
      bumpBookingsVersion();
    } catch (err) {
      Alert.alert('Gagal Ganti Lokasi', err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  const handleCancel = async (booking: BookingRecord) => {
    setBusyId(booking.booking_id);
    try {
      await ApiClient.cancelBooking(apiBaseUrl, booking.booking_id);
      bumpBookingsVersion();
    } catch (err) {
      Alert.alert('Gagal Membatalkan', err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  const handleViewVoucher = (booking: BookingRecord) => {
    setActiveVoucherBooking(booking);
    router.push('/modal');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.innerWrap}>
          <Text style={styles.title}>Daftar Pesanan</Text>
          <Text style={styles.subtitle}>Lihat, ubah jadwal, atau batalkan reservasi Anda</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {STATUS_FILTERS.map((st) => {
              const active = statusFilter === st.code;
              return (
                <Pressable
                  key={st.code}
                  onPress={() => setStatusFilter(st.code)}
                  style={[styles.pill, active && styles.pillActive]}
                >
                  <Text style={[styles.pillText, active && styles.pillTextActive]}>{st.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} tintColor={Theme.colors.primaryBright} />}
      >
        <View style={styles.innerWrap}>
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Text style={styles.sectionTitle}>Reservasi ({bookings.length})</Text>

          {loading && bookings.length === 0 ? (
            <ActivityIndicator color={Theme.colors.primaryBright} style={{ marginVertical: 24 }} />
          ) : bookings.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Belum ada pesanan pada kategori ini.</Text>
            </View>
          ) : (
            bookings.map((bk) => (
              <BookingCard
                key={bk.booking_id}
                booking={bk}
                busy={busyId === bk.booking_id}
                onViewVoucher={handleViewVoucher}
                onExtendOneDay={handleExtend}
                onSwitchHub={handleSwitchHub}
                onCancel={handleCancel}
              />
            ))
          )}

          <View style={[styles.sectionHeader, { marginTop: 22 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="bookmark-outline" size={16} color={Theme.colors.mcpC} />
              <Text style={styles.sectionTitle}>Catatan Preferensi Pelanggan</Text>
            </View>
          </View>

          {memoryEntities.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                Belum ada preferensi tersimpan. Asisten akan mencatat preferensi Anda secara otomatis saat Anda memesan.
              </Text>
            </View>
          ) : (
            memoryEntities.map((ent) => (
              <View key={ent.name} style={styles.memoryCard}>
                <Text style={styles.memName}>{ent.name}</Text>
                {ent.observations.map((obs, idx) => (
                  <Text key={`${ent.name}-${idx}`} style={styles.memObs}>
                    • {obs}
                  </Text>
                ))}
              </View>
            ))
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
    gap: 8
  },
  header: {
    backgroundColor: Theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12
  },
  title: { color: Theme.colors.textPrimary, fontSize: 18, fontWeight: '800' },
  subtitle: { color: Theme.colors.textSecondary, fontSize: 12, marginTop: 2 },
  filterRow: { gap: 8, paddingTop: 4 },
  pill: {
    backgroundColor: Theme.colors.canvas,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 6
  },
  pillActive: { backgroundColor: Theme.colors.primarySoft, borderColor: Theme.colors.primaryBright },
  pillText: { color: Theme.colors.textSecondary, fontSize: 12, fontWeight: '600' },
  pillTextActive: { color: Theme.colors.primaryBright },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: Theme.colors.textPrimary, fontSize: 14, fontWeight: '700' },
  errorBox: {
    backgroundColor: Theme.colors.dangerSoft,
    borderColor: Theme.colors.dangerBorder,
    borderWidth: 1,
    borderRadius: Theme.radius.md,
    padding: 12,
    marginBottom: 8
  },
  errorText: { color: Theme.colors.danger, fontSize: 12 },
  emptyCard: {
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radius.md,
    padding: 16
  },
  emptyText: { color: Theme.colors.textSecondary, fontSize: 13, lineHeight: 19 },
  memoryCard: {
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radius.lg,
    padding: 14,
    gap: 4
  },
  memName: { color: Theme.colors.textPrimary, fontSize: 14, fontWeight: '700', marginBottom: 2 },
  memObs: { color: Theme.colors.textSecondary, fontSize: 12, lineHeight: 18 }
});
