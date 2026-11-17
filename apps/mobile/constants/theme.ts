import { Platform } from 'react-native';

export const Theme = {
  layout: {
    maxWidth: 720
  },
  colors: {
    // Warm Linen & Roast Espresso Palette (matching requested warm concierge design)
    canvas: '#FAF7F2',
    surface: '#FFFFFF',
    surfaceElevated: '#F5ECE3',
    surfaceGlass: '#FFFFFF',
    border: '#EDE4DA',
    borderLight: '#F3EDE5',
    primary: '#4E3629',
    primaryBright: '#6D4C3D',
    primarySoft: '#F4ECE2',
    primaryBorder: '#DDCFC2',
    mcpA: '#9C6237',
    mcpASoft: 'rgba(156, 98, 55, 0.10)',
    mcpABorder: 'rgba(156, 98, 55, 0.25)',
    mcpB: '#B45309',
    mcpBSoft: 'rgba(180, 83, 9, 0.10)',
    mcpBBorder: 'rgba(180, 83, 9, 0.25)',
    mcpC: '#7C5295',
    mcpCSoft: 'rgba(124, 82, 149, 0.10)',
    mcpCBorder: 'rgba(124, 82, 149, 0.25)',
    danger: '#C53030',
    dangerSoft: '#FFF5F5',
    dangerBorder: '#FEB2B2',
    textPrimary: '#2D231C',
    textSecondary: '#7D6F64',
    textMuted: '#A89B8F',
    userBubble: '#4E3629',
    userBubbleBorder: '#3E2A1F',
    accentBanner: '#FCEFE3',
    accentBannerBorder: '#F3DEC9',
    accentBannerText: '#7D553A',
    circleBtn: '#F4EDE4',
    circleBtnText: '#4E3629'
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
    md: 14,
    lg: 20,
    xl: 24,
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
