import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  formatDateIndo,
  formatHubLabel,
  formatIdr,
  Theme,
  translateWeatherCondition
} from '@/constants/theme';
import { BaliWeatherReport, BookingRecord } from '@/services/api';

interface BookingCardProps {
  booking: BookingRecord;
  weather?: BaliWeatherReport | null;
  onViewVoucher?: (booking: BookingRecord) => void;
  onExtendOneDay?: (booking: BookingRecord) => void;
  onSwitchHub?: (booking: BookingRecord) => void;
  onCancel?: (booking: BookingRecord) => void;
  busy?: boolean;
}

function getStatusStyle(status: BookingRecord['status']) {
  switch (status) {
    case 'confirmed':
      return {
        label: 'Terkonfirmasi',
        color: Theme.colors.primaryBright,
        bg: Theme.colors.primarySoft,
        border: Theme.colors.primaryBorder
      };
    case 'active':
      return {
        label: 'Sedang Disewa',
        color: Theme.colors.mcpA,
        bg: Theme.colors.mcpASoft,
        border: Theme.colors.mcpABorder
      };
    case 'cancelled':
      return {
        label: 'Dibatalkan',
        color: Theme.colors.danger,
        bg: Theme.colors.dangerSoft,
        border: Theme.colors.dangerBorder
      };
    default:
      return {
        label: String(status),
        color: Theme.colors.textSecondary,
        bg: Theme.colors.surfaceElevated,
        border: Theme.colors.border
      };
  }
}

export function BookingCard({
  booking,
  weather,
  onViewVoucher,
  onExtendOneDay,
  onSwitchHub,
  onCancel,
  busy
}: BookingCardProps) {
  const statusStyle = getStatusStyle(booking.status);
  let addons: string[] = [];
  try {
    addons = JSON.parse(booking.addons_json || '[]');
  } catch {
    addons = [];
  }

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg, borderColor: statusStyle.border }]}>
          <Ionicons
            name={booking.status === 'cancelled' ? 'close-circle' : 'checkmark-circle'}
            size={13}
            color={statusStyle.color}
          />
          <Text style={[styles.statusText, { color: statusStyle.color }]}>{statusStyle.label}</Text>
        </View>
        <Text style={styles.refText}>#{booking.booking_id}</Text>
      </View>

      <View style={styles.heroRow}>
        <View style={styles.vehicleIconWrap}>
          <Ionicons
            name={booking.vehicle_category === 'Scooter' ? 'bicycle' : 'car-sport'}
            size={22}
            color={Theme.colors.primaryBright}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.vehicleTitle}>{booking.vehicle_name}</Text>
          <Text style={styles.vehicleSub}>Pemesan: {booking.customer_name}</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Ionicons name="location-outline" size={14} color={Theme.colors.mcpA} />
          <Text style={styles.metaText}>{formatHubLabel(booking.pickup_hub)}</Text>
        </View>
        <Text style={styles.metaDot}>·</Text>
        <View style={styles.metaItem}>
          <Ionicons name="calendar-outline" size={14} color={Theme.colors.primaryBright} />
          <Text style={styles.metaText}>
            {formatDateIndo(booking.start_date)} ({booking.days} hari)
          </Text>
        </View>
        {addons.length > 0 && (
          <>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.metaText}>{addons.map((a) => a.replace(/_/g, ' ')).join(', ')}</Text>
          </>
        )}
      </View>

      <View style={styles.priceRow}>
        <View>
          <Text style={styles.priceLabel}>Total Biaya</Text>
          <View style={styles.priceValWrap}>
            <Text style={styles.priceValue}>{formatIdr(booking.total_idr)}</Text>
            <Text style={styles.priceSub}>({formatIdr(booking.daily_rate_idr)}/hari)</Text>
          </View>
        </View>
        <View style={styles.vipPill}>
          <Text style={styles.vipText}>Tanpa Deposit</Text>
        </View>
      </View>

      {weather && (
        <View style={styles.weatherStrip}>
          <Ionicons
            name={weather.isRainRisk ? 'rainy-outline' : 'sunny-outline'}
            size={15}
            color={weather.isRainRisk ? Theme.colors.mcpA : '#FBBF24'}
          />
          <Text style={styles.weatherText}>
            Cuaca {formatHubLabel(weather.hub)}: {Math.round(weather.temperatureC)}°C ·{' '}
            {translateWeatherCondition(weather.condition)} ({weather.precipitationProbabilityPct}% hujan)
          </Text>
        </View>
      )}

      {(onViewVoucher || (booking.status !== 'cancelled' && (onExtendOneDay || onSwitchHub || onCancel))) && (
        <View style={styles.actionsWrap}>
          {onViewVoucher && booking.status !== 'cancelled' && (
            <Pressable
              onPress={() => onViewVoucher(booking)}
              disabled={busy}
              style={[styles.primaryBtn, busy && { opacity: 0.55 }]}
            >
              <Ionicons name="qr-code-outline" size={14} color="#06281B" />
              <Text style={styles.primaryBtnText}>Lihat E-Tiket</Text>
            </Pressable>
          )}

          {booking.status !== 'cancelled' && onExtendOneDay && (
            <Pressable
              onPress={() => onExtendOneDay(booking)}
              disabled={busy}
              style={[styles.secondaryBtn, busy && { opacity: 0.5 }]}
            >
              <Text style={styles.secondaryBtnText}>+1 Hari</Text>
            </Pressable>
          )}

          {booking.status !== 'cancelled' && onSwitchHub && (
            <Pressable
              onPress={() => onSwitchHub(booking)}
              disabled={busy}
              style={[styles.secondaryBtn, busy && { opacity: 0.5 }]}
            >
              <Text style={styles.secondaryBtnText}>Ganti Lokasi</Text>
            </Pressable>
          )}

          {booking.status !== 'cancelled' && onCancel && (
            <Pressable
              onPress={() => onCancel(booking)}
              disabled={busy}
              style={[styles.cancelBtn, busy && { opacity: 0.5 }]}
            >
              <Text style={styles.cancelBtnText}>Batalkan</Text>
            </Pressable>
          )}
        </View>
      )}
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
    marginTop: 8
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Theme.radius.pill,
    borderWidth: 1
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700'
  },
  refText: {
    color: Theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: Theme.fonts.mono
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12
  },
  vehicleIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center'
  },
  vehicleTitle: {
    color: Theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '700'
  },
  vehicleSub: {
    color: Theme.colors.textSecondary,
    fontSize: 12,
    marginTop: 2
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  metaText: {
    color: Theme.colors.textSecondary,
    fontSize: 12
  },
  metaDot: {
    color: Theme.colors.textMuted,
    fontSize: 12
  },
  priceRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8
  },
  priceLabel: {
    color: Theme.colors.textMuted,
    fontSize: 11
  },
  priceValWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 2,
    flexWrap: 'wrap'
  },
  priceValue: {
    color: Theme.colors.primaryBright,
    fontSize: 18,
    fontWeight: '800'
  },
  priceSub: {
    color: Theme.colors.textSecondary,
    fontSize: 11
  },
  vipPill: {
    backgroundColor: Theme.colors.primarySoft,
    borderRadius: Theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  vipText: {
    color: Theme.colors.primaryBright,
    fontSize: 11,
    fontWeight: '600'
  },
  weatherStrip: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Theme.colors.canvas,
    borderRadius: Theme.radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  weatherText: {
    flex: 1,
    color: Theme.colors.textSecondary,
    fontSize: 12,
    lineHeight: 17
  },
  actionsWrap: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  primaryBtn: {
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  primaryBtnText: {
    color: '#052E1E',
    fontSize: 12,
    fontWeight: '800'
  },
  secondaryBtn: {
    backgroundColor: Theme.colors.canvas,
    borderColor: Theme.colors.borderLight,
    borderWidth: 1,
    borderRadius: Theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  secondaryBtnText: {
    color: Theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: '600'
  },
  cancelBtn: {
    backgroundColor: Theme.colors.dangerSoft,
    borderColor: Theme.colors.dangerBorder,
    borderWidth: 1,
    borderRadius: Theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  cancelBtnText: {
    color: Theme.colors.danger,
    fontSize: 12,
    fontWeight: '600'
  }
});
