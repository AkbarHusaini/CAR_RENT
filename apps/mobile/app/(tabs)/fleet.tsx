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
import { FleetCard } from '@/components/FleetCard';
import { WeatherCard } from '@/components/WeatherCard';
import { formatHubLabel, Theme } from '@/constants/theme';
import { useAppContext } from '@/context/AppContext';
import { ApiClient, BaliWeatherReport, FleetVehicle } from '@/services/api';

const HUBS = [
  { code: 'CANGGU', label: 'Canggu' },
  { code: 'KUTA', label: 'Kuta' },
  { code: 'AIRPORT_DPS', label: 'Bandara DPS' },
  { code: 'UBUD', label: 'Ubud' },
  { code: 'SEMINYAK', label: 'Seminyak' },
  { code: 'ULUWATU', label: 'Uluwatu' }
];

const CATEGORIES = [
  { code: 'ALL', label: 'Semua' },
  { code: 'SUV', label: 'SUV' },
  { code: 'MPV', label: 'MPV' },
  { code: 'Compact', label: 'Compact' },
  { code: 'EV', label: 'Listrik' },
  { code: 'Scooter', label: 'Motor' }
];

export default function FleetScreen() {
  const router = useRouter();
  const {
    apiBaseUrl,
    preferredHub,
    setPreferredHub,
    customerName,
    setPendingPrompt,
    setActiveVoucherBooking,
    bumpBookingsVersion
  } = useAppContext();

  const [category, setCategory] = useState('ALL');
  const [fleet, setFleet] = useState<FleetVehicle[]>([]);
  const [weather, setWeather] = useState<BaliWeatherReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFleet = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await ApiClient.getFleet(apiBaseUrl, { category, hub: preferredHub });
      setFleet(res.fleet);
      setWeather(res.weather);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, category, preferredHub]);

  useEffect(() => {
    loadFleet();
  }, [loadFleet]);

  const handleAskAi = (vehicle: FleetVehicle) => {
    setPendingPrompt(`Tolong info lengkap ${vehicle.name} di ${formatHubLabel(preferredHub)} dan estimasi sewa 3 hari`);
    router.push('/');
  };

  const handleInstantBook = async (vehicle: FleetVehicle) => {
    setBookingBusy(true);
    try {
      const tomorrow = new Date(Date.now() + 86400_000).toISOString().slice(0, 10);
      const res = await ApiClient.createBooking(apiBaseUrl, {
        customerName: customerName || 'Maya',
        vehicleId: vehicle.id,
        pickupHub: preferredHub,
        startDate: tomorrow,
        days: 3,
        addons: vehicle.surfRackReady ? ['surf_rack'] : [],
        notes: 'Pemesanan langsung dari menu Armada'
      });
      bumpBookingsVersion();
      setActiveVoucherBooking(res.booking);
      router.push('/modal');
    } catch (err) {
      Alert.alert('Gagal Memesan', err instanceof Error ? err.message : String(err));
    } finally {
      setBookingBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.innerWrap}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.title}>Armada & Cuaca</Text>
              <Text style={styles.subtitle}>Pilih lokasi penjemputan dan tipe kendaraan</Text>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {HUBS.map((h) => {
              const active = preferredHub === h.code;
              return (
                <Pressable
                  key={h.code}
                  onPress={() => setPreferredHub(h.code)}
                  style={[styles.pill, active && styles.pillActive]}
                >
                  <Text style={[styles.pillText, active && styles.pillTextActive]}>{h.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {CATEGORIES.map((cat) => {
              const active = category === cat.code;
              return (
                <Pressable
                  key={cat.code}
                  onPress={() => setCategory(cat.code)}
                  style={[styles.catPill, active && styles.catPillActive]}
                >
                  <Text style={[styles.catText, active && styles.catTextActive]}>{cat.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadFleet} tintColor={Theme.colors.primaryBright} />}
      >
        <View style={styles.innerWrap}>
          {weather && (
            <View style={{ marginBottom: 14 }}>
              <WeatherCard weather={weather} />
            </View>
          )}

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {loading && fleet.length === 0 ? (
            <View style={styles.center}>
              <ActivityIndicator color={Theme.colors.mcpA} />
              <Text style={styles.loadingLabel}>Memuat daftar armada & cuaca...</Text>
            </View>
          ) : fleet.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.loadingLabel}>
                Belum ada unit tersedia di {formatHubLabel(preferredHub)} untuk kategori ini.
              </Text>
            </View>
          ) : (
            fleet.map((v) => (
              <FleetCard
                key={v.id}
                vehicle={v}
                busy={bookingBusy}
                onAskAi={handleAskAi}
                onQuickBook={handleInstantBook}
              />
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
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  title: { color: Theme.colors.textPrimary, fontSize: 18, fontWeight: '800' },
  subtitle: { color: Theme.colors.textSecondary, fontSize: 12, marginTop: 2 },
  filterRow: { gap: 8, paddingTop: 2 },
  pill: {
    backgroundColor: Theme.colors.canvas,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radius.pill,
    paddingHorizontal: 13,
    paddingVertical: 6
  },
  pillActive: {
    backgroundColor: Theme.colors.mcpASoft,
    borderColor: Theme.colors.mcpA
  },
  pillText: { color: Theme.colors.textSecondary, fontSize: 12, fontWeight: '600' },
  pillTextActive: { color: Theme.colors.mcpA },
  catPill: {
    backgroundColor: Theme.colors.canvas,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radius.sm,
    paddingHorizontal: 11,
    paddingVertical: 5
  },
  catPillActive: {
    backgroundColor: Theme.colors.primarySoft,
    borderColor: Theme.colors.primaryBright
  },
  catText: { color: Theme.colors.textMuted, fontSize: 12, fontWeight: '600' },
  catTextActive: { color: Theme.colors.primaryBright },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  errorBox: {
    backgroundColor: Theme.colors.dangerSoft,
    borderColor: Theme.colors.dangerBorder,
    borderWidth: 1,
    borderRadius: Theme.radius.md,
    padding: 12,
    marginBottom: 12
  },
  errorText: { color: Theme.colors.danger, fontSize: 12 },
  center: { padding: 30, alignItems: 'center', gap: 10 },
  loadingLabel: { color: Theme.colors.textSecondary, fontSize: 13, textAlign: 'center' }
});
