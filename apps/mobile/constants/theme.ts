import { Platform } from 'react-native';

export const Theme = {
  layout: {
    maxWidth: 720
  },
  colors: {
    canvas: '#0E151E',
    surface: '#161F2A',
    surfaceElevated: '#1D2836',
    surfaceGlass: '#18222E',
    border: '#243142',
    borderLight: '#314258',
    primary: '#10B981',
    primaryBright: '#4EDEA3',
    primarySoft: 'rgba(16, 185, 129, 0.13)',
    primaryBorder: 'rgba(16, 185, 129, 0.30)',
    mcpA: '#38BDF8',
    mcpASoft: 'rgba(56, 189, 248, 0.10)',
    mcpABorder: 'rgba(56, 189, 248, 0.28)',
    mcpB: '#F59E0B',
    mcpBSoft: 'rgba(245, 158, 11, 0.10)',
    mcpBBorder: 'rgba(245, 158, 11, 0.28)',
    mcpC: '#A78BFA',
    mcpCSoft: 'rgba(167, 139, 250, 0.10)',
    mcpCBorder: 'rgba(167, 139, 250, 0.28)',
    danger: '#F87171',
    dangerSoft: 'rgba(248, 113, 113, 0.10)',
    dangerBorder: 'rgba(248, 113, 113, 0.28)',
    textPrimary: '#F1F5F9',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    userBubble: '#1D3347',
    userBubbleBorder: '#2C4963'
  },
  fonts: {
    mono: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'monospace'
    })
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    pill: 999
  }
} as const;

export function formatIdr(amount: number): string {
  if (!Number.isFinite(amount)) return 'Rp 0';
  return `Rp ${Math.round(amount).toLocaleString('id-ID')}`;
}

export function formatCompactIdr(amount: number): string {
  if (!Number.isFinite(amount)) return '0 rb';
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(2).replace(/\.00$/, '')} jt`;
  }
  return `${Math.round(amount / 1000)} rb`;
}

export function formatHubLabel(code?: string): string {
  switch (code) {
    case 'CANGGU':
      return 'Canggu';
    case 'KUTA':
      return 'Kuta';
    case 'AIRPORT_DPS':
      return 'Bandara Ngurah Rai';
    case 'UBUD':
      return 'Ubud';
    case 'SEMINYAK':
      return 'Seminyak';
    case 'ULUWATU':
      return 'Uluwatu';
    default:
      return code || 'Bali';
  }
}

export function translateWeatherCondition(condition: string): string {
  const lower = condition.toLowerCase();
  if (lower.includes('thunderstorm')) return 'Hujan Petir';
  if (lower.includes('heavy') && (lower.includes('rain') || lower.includes('downpour') || lower.includes('shower') || lower.includes('squall'))) {
    return 'Hujan Deras';
  }
  if (lower.includes('moderate') && lower.includes('rain')) return 'Hujan Sedang';
  if (lower.includes('light') && (lower.includes('rain') || lower.includes('shower'))) return 'Hujan Ringan';
  if (lower.includes('shower') || lower.includes('squall')) return 'Hujan Lokal';
  if (lower.includes('steady drizzle')) return 'Gerimis Merata';
  if (lower.includes('moderate drizzle')) return 'Gerimis Sedang';
  if (lower.includes('drizzle')) return 'Gerimis Ringan';
  if (lower.includes('mist') || lower.includes('haze')) return 'Berkabut Tipis';
  if (lower.includes('overcast') || lower.includes('cloudy')) return 'Berawan';
  if (lower.includes('partly')) return 'Cerah Berawan';
  if (lower.includes('mostly sunny') || lower.includes('mainly clear')) return 'Cerah';
  if (lower.includes('clear')) return 'Cerah Terik';
  return 'Cerah Hangat';
}

export function formatDateIndo(isoDate?: string): string {
  if (!isoDate) return '-';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const m = Number(parts[1]) - 1;
  return `${Number(parts[2])} ${months[m] ?? parts[1]} ${parts[0]}`;
}
