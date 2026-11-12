import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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

export function FleetCard({ vehicle, onQuickBook, onAskAi, busy, compact }: FleetCardProps) {
  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      <View style={styles.topRow}>
        <View style={styles.catBadge}>
          <Ionicons
            name={vehicle.category === 'Scooter' ? 'bicycle' : vehicle.category === 'EV' ? 'flash' : 'car-sport'}
            size={12}
            color={Theme.colors.mcpA}
          />
          <Text style={styles.catText}>
            {formatCategoryId(vehicle.category)} · {vehicle.transmission === 'Automatic' ? 'Matic' : 'Manual'}
          </Text>
        </View>
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={12} color={Theme.colors.mcpB} />
          <Text style={styles.ratingText}>{vehicle.rating.toFixed(1)}</Text>
        </View>
      </View>

      <Text style={styles.name}>{vehicle.name}</Text>
      {!compact && <Text style={styles.tagline}>{vehicle.tagline}</Text>}

      <View style={styles.specsRow}>
        <View style={styles.specChip}>
          <Text style={styles.specText}>{vehicle.seats} Kursi</Text>
        </View>
        <View style={styles.specChip}>
          <Text style={styles.specText}>{formatFuelId(vehicle.fuelType)}</Text>
        </View>
        {vehicle.surfRackReady && (
          <View style={[styles.specChip, { borderColor: Theme.colors.primaryBorder }]}>
            <Text style={[styles.specText, { color: Theme.colors.primaryBright }]}>Rak Surf</Text>
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
              <Ionicons name="chatbubble-ellipses-outline" size={14} color={Theme.colors.mcpA} />
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
  card: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 14,
    marginBottom: 10
  },
  cardCompact: {
    padding: 12,
    marginBottom: 8
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
    backgroundColor: Theme.colors.mcpASoft,
    borderColor: Theme.colors.mcpABorder,
    borderWidth: 1,
    borderRadius: Theme.radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 3
  },
  catText: {
    color: Theme.colors.mcpA,
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
    color: Theme.colors.primaryBright,
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
    backgroundColor: Theme.colors.mcpASoft,
    borderColor: Theme.colors.mcpABorder,
    borderWidth: 1,
    borderRadius: Theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  askBtnText: {
    color: Theme.colors.mcpA,
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
    color: '#052E1E',
    fontSize: 12,
    fontWeight: '800'
  }
});
