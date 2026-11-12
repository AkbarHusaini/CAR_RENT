import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatHubLabel, Theme, translateWeatherCondition } from '@/constants/theme';
import { BaliWeatherReport } from '@/services/api';

interface WeatherCardProps {
  weather: BaliWeatherReport;
}

export function WeatherCard({ weather }: WeatherCardProps) {
  const isRain = weather.isRainRisk;
  const accentColor = isRain ? Theme.colors.mcpA : '#FBBF24';
  const softBg = isRain ? 'rgba(56, 189, 248, 0.10)' : 'rgba(251, 191, 36, 0.10)';
  const borderColor = isRain ? 'rgba(56, 189, 248, 0.25)' : 'rgba(251, 191, 36, 0.25)';
  const badgeBg = isRain ? 'rgba(56, 189, 248, 0.14)' : 'rgba(16, 185, 129, 0.14)';
  const badgeTextColor = isRain ? Theme.colors.mcpA : Theme.colors.primaryBright;

  const hubName = formatHubLabel(weather.hub);
  const conditionId = translateWeatherCondition(weather.condition);
  const tipId = isRain
    ? `Peluang hujan ${weather.precipitationProbabilityPct}% di ${hubName} — disarankan pakai mobil (SUV) agar tetap nyaman.`
    : `Cuaca ${hubName} bersahabat (${Math.round(weather.temperatureC)}°C) — aman naik motor maupun mobil.`;

  return (
    <View style={[styles.card, { borderColor }]}>
      <View style={styles.topRow}>
        <View style={styles.leftHero}>
          <View style={[styles.iconCircle, { backgroundColor: softBg, borderColor }]}>
            <Ionicons name={isRain ? 'rainy' : 'sunny'} size={22} color={accentColor} />
          </View>
          <View style={styles.heroTextWrap}>
            <View style={styles.tempRow}>
              <Text style={styles.tempText}>{Math.round(weather.temperatureC)}°C</Text>
              <Text style={styles.conditionText} numberOfLines={1}>
                {conditionId}
              </Text>
            </View>
            <Text style={styles.locationText}>{hubName}, Bali</Text>
          </View>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: badgeBg, borderColor }]}>
          <Ionicons name={isRain ? 'car-sport' : 'checkmark-circle'} size={12} color={badgeTextColor} />
          <Text style={[styles.statusBadgeText, { color: badgeTextColor }]}>
            {isRain ? 'Pakai Mobil' : 'Cuaca Cerah'}
          </Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Ionicons name="water-outline" size={14} color={accentColor} />
          <View>
            <Text style={styles.statValue}>{weather.precipitationProbabilityPct}%</Text>
            <Text style={styles.statLabel}>Peluang Hujan</Text>
          </View>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statBox}>
          <Ionicons name="speedometer-outline" size={14} color={Theme.colors.textSecondary} />
          <View>
            <Text style={styles.statValue}>{Math.round(weather.windSpeedKmh)} km/jam</Text>
            <Text style={styles.statLabel}>Angin</Text>
          </View>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statBox}>
          <Ionicons name={isRain ? 'car-outline' : 'bicycle-outline'} size={14} color={Theme.colors.primaryBright} />
          <View>
            <Text style={styles.statValue}>{isRain ? 'SUV / Mobil' : 'Motor / Mobil'}</Text>
            <Text style={styles.statLabel}>Saran Unit</Text>
          </View>
        </View>
      </View>

      <Text style={styles.tipText}>{tipId}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    padding: 14,
    marginTop: 8,
    marginBottom: 4
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10
  },
  leftHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  heroTextWrap: {
    flex: 1
  },
  tempRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    flexWrap: 'wrap'
  },
  tempText: {
    color: Theme.colors.textPrimary,
    fontSize: 22,
    fontWeight: '800'
  },
  conditionText: {
    color: Theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '600'
  },
  locationText: {
    color: Theme.colors.textSecondary,
    fontSize: 12,
    marginTop: 2
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: Theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700'
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.canvas,
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginTop: 12
  },
  statBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    justifyContent: 'center'
  },
  statDivider: {
    width: 1,
    height: 22,
    backgroundColor: Theme.colors.border
  },
  statValue: {
    color: Theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: '700'
  },
  statLabel: {
    color: Theme.colors.textMuted,
    fontSize: 10,
    marginTop: 1
  },
  tipText: {
    color: Theme.colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10
  }
});
