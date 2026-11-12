import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { BALI_HUBS, FLEET_CATALOG, normalizeHub } from './data/fleet.js';
import { fetchBaliWeather } from './services/weather.js';

const server = new McpServer({
  name: 'easy-rent-bali-mcp-a-fleet-weather',
  version: '1.0.0'
});

function jsonResult(data: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(data, null, 2)
      }
    ]
  };
}

server.registerTool(
  'search_fleet',
  {
    title: 'Search Easy Rent Bali Fleet',
    description:
      'Query available cars, EVs, and scooters in Easy Rent Bali catalog by category, transmission, pickup hub, seats, budget, or surf-rack support.',
    inputSchema: {
      category: z
        .enum(['SUV', 'MPV', 'Compact', 'EV', 'Scooter', 'ALL'])
        .optional()
        .describe('Vehicle category filter'),
      transmission: z
        .enum(['Automatic', 'Manual'])
        .optional()
        .describe('Transmission type'),
      hub: z
        .string()
        .optional()
        .describe('Bali pickup hub or area (Canggu, Kuta, Airport DPS, Ubud, Seminyak, Uluwatu)'),
      minSeats: z.number().int().min(1).max(12).optional().describe('Minimum seating capacity'),
      maxDailyRateIdr: z.number().int().positive().optional().describe('Max daily rental rate in IDR'),
      surfRackOnly: z.boolean().optional().describe('Only return vehicles with surf-rack compatibility'),
      query: z.string().optional().describe('Free-text keyword match against name, brand, features, or tagline')
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true
    }
  },
  async ({ category, transmission, hub, minSeats, maxDailyRateIdr, surfRackOnly, query }) => {
    const normalizedHub = normalizeHub(hub);
    const q = query?.trim().toLowerCase();

    const matches = FLEET_CATALOG.filter((v) => {
      if (category && category !== 'ALL' && v.category !== category) return false;
      if (transmission && v.transmission !== transmission) return false;
      if (normalizedHub && !v.hubs.includes(normalizedHub)) return false;
      if (minSeats && v.seats < minSeats) return false;
      if (maxDailyRateIdr && v.dailyRateIdr > maxDailyRateIdr) return false;
      if (surfRackOnly && !v.surfRackReady) return false;
      if (q) {
        const hay = `${v.id} ${v.name} ${v.brand} ${v.category} ${v.tagline} ${v.features.join(' ')} ${v.recommendedFor.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return jsonResult({
      server: 'MCP-A (fleet_weather_server)',
      operation: 'READ_QUERY',
      appliedFilters: {
        category: category ?? 'ALL',
        transmission: transmission ?? null,
        hub: normalizedHub ?? hub ?? null,
        minSeats: minSeats ?? null,
        maxDailyRateIdr: maxDailyRateIdr ?? null,
        surfRackOnly: surfRackOnly ?? false,
        query: query ?? null
      },
      totalMatched: matches.length,
      vehicles: matches
    });
  }
);

server.registerTool(
  'get_vehicle_details',
  {
    title: 'Get Vehicle Details',
    description: 'Fetch full specifications, hub availability, and pricing details for a specific vehicle ID.',
    inputSchema: {
      vehicleId: z.string().describe('Vehicle ID such as TOY-RAZ-04 or YAM-NMX-05')
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true
    }
  },
  async ({ vehicleId }) => {
    const found = FLEET_CATALOG.find((v) => v.id.toUpperCase() === vehicleId.trim().toUpperCase());
    if (!found) {
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ error: `Vehicle '${vehicleId}' not found in Easy Rent Bali catalog.` })
          }
        ]
      };
    }

    return jsonResult({
      server: 'MCP-A (fleet_weather_server)',
      operation: 'READ_QUERY',
      vehicle: found,
      hubDetails: found.hubs.map((code) => BALI_HUBS[code])
    });
  }
);

server.registerTool(
  'calculate_quote',
  {
    title: 'Calculate Rental Quote',
    description:
      'Compute itemized Easy Rent Bali rental quote in IDR including multi-day discounts, hub delivery fee, and optional add-ons.',
    inputSchema: {
      vehicleId: z.string().describe('Vehicle ID from fleet catalog'),
      days: z.number().int().min(1).max(90).describe('Rental duration in days'),
      hub: z.string().optional().describe('Pickup hub (Canggu, Kuta, Airport DPS, Ubud, Seminyak, Uluwatu)'),
      addons: z
        .array(z.enum(['surf_rack', 'child_seat', 'full_insurance_plus', 'extra_helmet']))
        .optional()
        .describe('Optional daily add-ons')
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true
    }
  },
  async ({ vehicleId, days, hub, addons = [] }) => {
    const vehicle = FLEET_CATALOG.find((v) => v.id.toUpperCase() === vehicleId.trim().toUpperCase());
    if (!vehicle) {
      return {
        isError: true,
        content: [{ type: 'text' as const, text: JSON.stringify({ error: `Unknown vehicleId: ${vehicleId}` }) }]
      };
    }

    const hubCode = normalizeHub(hub) ?? vehicle.hubs[0];
    const hubInfo = BALI_HUBS[hubCode];
    const baseSubtotal = vehicle.dailyRateIdr * days;
    const discountRate = days >= 7 ? 0.15 : days >= 5 ? 0.1 : 0;
    const discountIdr = Math.round(baseSubtotal * discountRate);

    const addonDailyRates: Record<string, number> = {
      surf_rack: 35000,
      child_seat: 40000,
      full_insurance_plus: 60000,
      extra_helmet: 15000
    };
    const addonsBreakdown = addons.map((addon) => ({
      addon,
      dailyRateIdr: addonDailyRates[addon] ?? 25000,
      totalIdr: (addonDailyRates[addon] ?? 25000) * days
    }));
    const addonsTotalIdr = addonsBreakdown.reduce((acc, item) => acc + item.totalIdr, 0);
    const totalIdr = baseSubtotal - discountIdr + hubInfo.deliveryFeeIdr + addonsTotalIdr;

    return jsonResult({
      server: 'MCP-A (fleet_weather_server)',
      operation: 'READ_QUERY',
      vehicleId: vehicle.id,
      vehicleName: vehicle.name,
      category: vehicle.category,
      hub: hubCode,
      hubName: hubInfo.name,
      days,
      dailyRateIdr: vehicle.dailyRateIdr,
      baseSubtotalIdr: baseSubtotal,
      multiDayDiscountPct: discountRate * 100,
      multiDayDiscountIdr: discountIdr,
      deliveryFeeIdr: hubInfo.deliveryFeeIdr,
      addons: addonsBreakdown,
      addonsTotalIdr,
      totalIdr,
      depositWaivableNote: 'Security deposit waived for confirmed MCP Concierge bookings'
    });
  }
);

server.registerTool(
  'get_bali_weather',
  {
    title: 'Get Live Bali Weather & Road Advisory',
    description:
      'Query real-time weather conditions and rain probability in Bali (via Open-Meteo API) to advise whether a car or scooter is best.',
    inputSchema: {
      hub: z
        .string()
        .optional()
        .describe('Bali hub or area name (e.g., Canggu, Ubud, Uluwatu, Seminyak, Kuta, Airport DPS)')
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true
    }
  },
  async ({ hub }) => {
    const report = await fetchBaliWeather(hub);
    return jsonResult({
      server: 'MCP-A (fleet_weather_server)',
      operation: 'READ_QUERY',
      weather: report
    });
  }
);

server.registerTool(
  'get_hub_info',
  {
    title: 'Get Easy Rent Bali Pickup Hubs',
    description: 'Query Easy Rent Bali branch hubs, operating hours, addresses, and delivery fees.',
    inputSchema: {
      hub: z.string().optional().describe('Optional hub filter')
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true
    }
  },
  async ({ hub }) => {
    const code = normalizeHub(hub);
    const hubs = code ? [BALI_HUBS[code]] : Object.values(BALI_HUBS);
    return jsonResult({
      server: 'MCP-A (fleet_weather_server)',
      operation: 'READ_QUERY',
      hubs
    });
  }
);

server.registerResource(
  'fleet-catalog',
  'fleet://catalog',
  {
    title: 'Easy Rent Bali Fleet Catalog',
    description: 'Complete live vehicle inventory and pickup hubs',
    mimeType: 'application/json'
  },
  async (uri) => ({
    contents: [
      {
        uri: uri.href,
        text: JSON.stringify({ hubs: BALI_HUBS, fleet: FLEET_CATALOG }, null, 2)
      }
    ]
  })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('[MCP-A] Fatal error:', err);
  process.exit(1);
});

