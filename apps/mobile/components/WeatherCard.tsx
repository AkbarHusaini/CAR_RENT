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
  const accentColor = isRain ? '#9C6237' : '#D97706';
  const softBg = isRain ? '#F7ECE1' : '#FEF3C7';
  const borderColor = isRain ? '#E8D4C2' : '#FDE68A';
  const badgeBg = isRain ? '#FCEFE3' : '#ECFDF5';
  const badgeTextColor = isRain ? '#7D553A' : '#047857';

  const hubName = formatHubLabel(weather.hub);
  const conditionId = translateWeatherCondition(weather.condition);
  const tipId = isRain
    ? `Peluang hujan ${weather.precipitationProbabilityPct}% di ${hubName} — disarankan pakai mobil (SUV) agar tetap nyaman.`
    : `Cuaca ${hubName} bersahabat (${Math.round(weather.temperatureC)}°C) — aman naik motor maupun mobil.`;

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.leftHero}>
          <View style={[styles.iconCircle, { backgroundColor: softBg, borderColor }]}>
            <Ionicons name={isRain ? 'rainy' : 'sunny'} size={20} color={accentColor} />
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
          <Ionicons name={isRain ? 'car-outline' : 'bicycle-outline'} size={14} color={Theme.colors.primary} />
          <View>
            <Text style={styles.statValue}>{isRain ? 'SUV / Mobil' : 'Motor / Mobil'}</Text>
            <Text style={styles.statLabel}>Saran Unit</Text>
          </View>
        </View>
      </View>

      <View style={styles.tipBanner}>
        <Ionicons name={isRain ? 'rainy-outline' : 'sunny-outline'} size={14} color="#7D553A" />
        <Text style={styles.tipText}>{tipId}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#EDE4DA',
    padding: 14,
    marginTop: 8,
    marginBottom: 4,
    shadowColor: '#4E3629',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2
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
    gap: 10,
    flex: 1
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
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
    gap: 6
  },
  tempText: {
    color: '#2D231C',
    fontSize: 20,
    fontWeight: '800'
  },
  conditionText: {
    color: '#7D6F64',
    fontSize: 13,
    fontWeight: '600'
  },
  locationText: {
    color: '#A89B8F',
    fontSize: 11,
    marginTop: 1
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Theme.radius.pill,
    borderWidth: 1
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700'
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAF7F2',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12
  },
  statBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1
  },
  statValue: {
    color: '#2D231C',
    fontSize: 12,
    fontWeight: '700'
  },
  statLabel: {
    color: '#7D6F64',
    fontSize: 10,
    marginTop: 1
  },
  statDivider: {
    width: 1,
    height: 22,
    backgroundColor: '#EDE4DA',
    marginHorizontal: 4
  },
  tipBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FCEFE3',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F3DEC9',
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 10
  },
  tipText: {
    color: '#7D553A',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
    flex: 1
  }
});
