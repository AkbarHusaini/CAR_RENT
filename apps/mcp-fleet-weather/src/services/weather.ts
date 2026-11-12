import { BALI_HUBS, BaliHubCode, normalizeHub } from '../data/fleet.js';

export interface BaliWeatherReport {
  hub: BaliHubCode;
  hubName: string;
  area: string;
  temperatureC: number;
  condition: string;
  precipitationProbabilityPct: number;
  windSpeedKmh: number;
  isRainRisk: boolean;
  ridingAdvisory: string;
  recommendedCategories: ('SUV' | 'MPV' | 'Compact' | 'EV' | 'Scooter')[];
  source: 'open-meteo-live' | 'offline-baseline';
  observedAt: string;
}

const WEATHER_CODE_MAP: Record<number, string> = {
  0: 'Clear & Sunny',
  1: 'Mostly Sunny',
  2: 'Partly Cloudy',
  3: 'Cloudy Skies',
  45: 'Morning Mist',
  48: 'Coastal Haze',
  51: 'Light Drizzle',
  53: 'Moderate Drizzle',
  55: 'Steady Drizzle',
  61: 'Light Rain',
  63: 'Moderate Rain',
  65: 'Heavy Rain',
  80: 'Passing Showers',
  81: 'Rain Showers',
  82: 'Heavy Showers',
  95: 'Thunderstorm'
};

export async function fetchBaliWeather(hubInput?: string): Promise<BaliWeatherReport> {
  const hubCode: BaliHubCode = normalizeHub(hubInput) ?? 'CANGGU';
  const hub = BALI_HUBS[hubCode];
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${hub.latitude}&longitude=${hub.longitude}` +
    `&current=temperature_2m,weather_code,wind_speed_10m` +
    `&hourly=precipitation_probability` +
    `&forecast_days=1&timezone=Asia%2FMakassar`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4500) });
    if (!res.ok) {
      throw new Error(`Open-Meteo HTTP ${res.status}`);
    }
    const data = (await res.json()) as {
      current?: {
        temperature_2m?: number;
        weather_code?: number;
        wind_speed_10m?: number;
        time?: string;
      };
      hourly?: {
        precipitation_probability?: number[];
      };
    };

    const temp = Math.round((data.current?.temperature_2m ?? 28.5) * 10) / 10;
    const code = data.current?.weather_code ?? 1;
    const wind = Math.round((data.current?.wind_speed_10m ?? 12) * 10) / 10;
    const probs = data.hourly?.precipitation_probability ?? [15];
    const maxRainProb = Math.max(...probs.slice(0, 12), 0);
    const condition = WEATHER_CODE_MAP[code] ?? 'Warm Breeze';
    const isRainRisk = code >= 51 || maxRainProb >= 55;

    return {
      hub: hubCode,
      hubName: hub.name,
      area: hub.area,
      temperatureC: temp,
      condition,
      precipitationProbabilityPct: maxRainProb,
      windSpeedKmh: wind,
      isRainRisk,
      ridingAdvisory: isRainRisk
        ? `Rain likely (${maxRainProb}%) in ${hub.area} — an enclosed car (SUV or Compact) will keep you dry.`
        : `Clear and warm in ${hub.area} (${maxRainProb}% rain chance) — great for both scooters and cars.`,
      recommendedCategories: isRainRisk
        ? ['SUV', 'Compact', 'MPV', 'EV']
        : ['SUV', 'Scooter', 'EV', 'Compact'],
      source: 'open-meteo-live',
      observedAt: data.current?.time ?? new Date().toISOString()
    };
  } catch {
    return {
      hub: hubCode,
      hubName: hub.name,
      area: hub.area,
      temperatureC: 29.0,
      condition: 'Mostly Sunny',
      precipitationProbabilityPct: 20,
      windSpeedKmh: 14,
      isRainRisk: false,
      ridingAdvisory: `Warm coastal breeze in ${hub.area} — comfortable weather for scooters or cars.`,
      recommendedCategories: ['SUV', 'Scooter', 'Compact', 'MPV'],
      source: 'offline-baseline',
      observedAt: new Date().toISOString()
    };
  }
}

