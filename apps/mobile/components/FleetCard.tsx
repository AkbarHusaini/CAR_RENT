import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatHubLabel, formatIdr, Theme } from '@/constants/theme';
import { FleetVehicle } from '@/services/api';

interface FleetCardProps {
  vehicle: FleetVehicle;
  onQuickBook?: (vehicle: FleetVehicle) => void;
  onAskAi?: (vehicle: FleetVehicle) => void;
  busy?: boolean;
  compact?: boolean;
}

function formatCategoryId(cat: FleetVehicle['category']): string {
  if (cat === 'Scooter') return 'Motor';
  if (cat === 'EV') return 'Mobil Listrik';
  return cat;
}

function formatFuelId(fuel: string): string {
  if (fuel === 'Electric') return 'Listrik';
  if (fuel === 'Hybrid') return 'Hybrid';
  return 'Bensin';
}

function getVehicleThumbnail(v: FleetVehicle): string {
  if (v.category === 'Scooter') {
    return 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=160&auto=format&fit=crop&q=80';
  }
  if (v.category === 'EV') {
    return 'https://images.unsplash.com/photo-1563720223185-11003d516935?w=160&auto=format&fit=crop&q=80';
  }
  if (v.category === 'MPV') {
    return 'https://images.unsplash.com/photo-1502877338535-766e1452684a?w=160&auto=format&fit=crop&q=80';
  }
  return 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=160&auto=format&fit=crop&q=80';
}

export function FleetCard({ vehicle, onQuickBook, onAskAi, busy, compact }: FleetCardProps) {
  if (compact) {
    return (
      <View style={styles.recommendCard}>
        <View style={styles.recommendHeader}>
          <Ionicons name="sparkles" size={13} color={Theme.colors.primary} />
          <Text style={styles.recommendHeaderText}>Saran Pilihan Armada</Text>
        </View>

        <View style={styles.recommendBody}>
          <Image source={{ uri: getVehicleThumbnail(vehicle) }} style={styles.recommendThumb} />
          <View style={{ flex: 1 }}>
            <Text style={styles.recommendName} numberOfLines={1}>
              {vehicle.name}
            </Text>
            <Text style={styles.recommendSub} numberOfLines={1}>
              {formatCategoryId(vehicle.category)} · {vehicle.transmission === 'Automatic' ? 'Matic' : 'Manual'} ·{' '}
              {vehicle.seats} Kursi
            </Text>
            <View style={styles.recommendRatingRow}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Ionicons key={s} name="star" size={11} color="#D97706" />
              ))}
              <Text style={styles.recommendRatingText}>{vehicle.rating.toFixed(1)}</Text>
            </View>
          </View>
        </View>

        {onQuickBook && (
          <Pressable
            onPress={() => onQuickBook(vehicle)}
            disabled={busy}
            style={({ pressed }) => [styles.recommendBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.recommendBtnText}>Pesan Unit Ini ({formatIdr(vehicle.dailyRateIdr)}/hari) →</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.catBadge}>
          <Ionicons
            name={vehicle.category === 'Scooter' ? 'bicycle' : vehicle.category === 'EV' ? 'flash' : 'car-sport'}
            size={12}
            color={Theme.colors.primary}
          />
          <Text style={styles.catText}>
            {formatCategoryId(vehicle.category)} · {vehicle.transmission === 'Automatic' ? 'Matic' : 'Manual'}
          </Text>
        </View>
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={12} color="#D97706" />
          <Text style={styles.ratingText}>{vehicle.rating.toFixed(1)}</Text>
        </View>
      </View>

      <Text style={styles.name}>{vehicle.name}</Text>
      <Text style={styles.tagline}>{vehicle.tagline}</Text>

      <View style={styles.specsRow}>
        <View style={styles.specChip}>
          <Text style={styles.specText}>{vehicle.seats} Kursi</Text>
        </View>
        <View style={styles.specChip}>
          <Text style={styles.specText}>{formatFuelId(vehicle.fuelType)}</Text>
        </View>
        {vehicle.surfRackReady && (
          <View style={[styles.specChip, { borderColor: Theme.colors.primaryBorder }]}>
            <Text style={[styles.specText, { color: Theme.colors.primary }]}>Rak Surf</Text>
          </View>
        )}
        <View style={styles.specChip}>
          <Text style={styles.specText}>{vehicle.hubs.slice(0, 2).map(formatHubLabel).join(' · ')}</Text>
        </View>
      </View>

      <View style={styles.footerRow}>
        <View>
          <Text style={styles.rateValue}>{formatIdr(vehicle.dailyRateIdr)}</Text>
          <Text style={styles.rateUnit}>per hari</Text>
        </View>
        <View style={styles.btnGroup}>
          {onAskAi && (
            <Pressable
              onPress={() => onAskAi(vehicle)}
              disabled={busy}
              style={[styles.askBtn, busy && { opacity: 0.5 }]}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={14} color={Theme.colors.primary} />
              <Text style={styles.askBtnText}>Tanya AI</Text>
            </Pressable>
          )}
          {onQuickBook && (
            <Pressable
              onPress={() => onQuickBook(vehicle)}
              disabled={busy}
              style={[styles.bookBtn, busy && { opacity: 0.5 }]}
            >
              <Text style={styles.bookBtnText}>Pesan</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  recommendCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#EDE4DA',
    padding: 16,
    marginTop: 8,
    marginBottom: 4,
    shadowColor: '#4E3629',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2
  },
  recommendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12
  },
  recommendHeaderText: {
    color: Theme.colors.primary,
    fontSize: 13,
    fontWeight: '700'
  },
  recommendBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14
  },
  recommendThumb: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F5ECE3'
  },
  recommendName: {
    color: '#2D231C',
    fontSize: 15,
    fontWeight: '700'
  },
  recommendSub: {
    color: '#7D6F64',
    fontSize: 12,
    marginTop: 2
  },
  recommendRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4
  },
  recommendRatingText: {
    color: '#2D231C',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4
  },
  recommendBtn: {
    backgroundColor: '#4E3629',
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  recommendBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700'
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#4E3629',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  catBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Theme.colors.surfaceElevated,
    borderColor: Theme.colors.border,
    borderWidth: 1,
    borderRadius: Theme.radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 3
  },
  catText: {
    color: Theme.colors.primary,
    fontSize: 11,
    fontWeight: '700'
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  ratingText: {
    color: Theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: '700'
  },
  name: {
    color: Theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8
  },
  tagline: {
    color: Theme.colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4
  },
  specsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10
  },
  specChip: {
    backgroundColor: Theme.colors.canvas,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  specText: {
    color: Theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: '500'
  },
  footerRow: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8
  },
  rateValue: {
    color: Theme.colors.primary,
    fontSize: 16,
    fontWeight: '800'
  },
  rateUnit: {
    color: Theme.colors.textMuted,
    fontSize: 11
  },
  btnGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  askBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Theme.colors.surfaceElevated,
    borderColor: Theme.colors.border,
    borderWidth: 1,
    borderRadius: Theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  askBtnText: {
    color: Theme.colors.primary,
    fontSize: 12,
    fontWeight: '700'
  },
  bookBtn: {
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.radius.md,
    paddingHorizontal: 16,
    paddingVertical: 8
  },
  bookBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800'
  }
});
