import { McpClientManager } from '../mcp/clientManager.js';
import { ChatTurnRequest, McpToolTraceEntry } from './types.js';

interface ParsedIntent {
  hub?: string;
  category?: 'SUV' | 'MPV' | 'Compact' | 'EV' | 'Scooter';
  wantsMultiOption: boolean;
  isIndonesian: boolean;
  transmission?: 'Automatic' | 'Manual';
  days: number;
  customerName: string;
  bookingId?: string;
  addons: string[];
  wantsBook: boolean;
  wantsCancel: boolean;
  wantsUpdate: boolean;
  wantsListBookings: boolean;
  wantsWeather: boolean;
  wantsMemorySave: boolean;
  wantsMemoryRecall: boolean;
  vehicleKeyword?: string;
}

function formatHubName(code?: string): string {
  switch (code) {
    case 'CANGGU':
      return 'Canggu';
    case 'KUTA':
      return 'Kuta';
    case 'AIRPORT_DPS':
      return 'Ngurah Rai Airport (DPS)';
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

function formatIdr(value: number): string {
  return `Rp ${Math.round(value).toLocaleString('id-ID')}`;
}

function detectHub(text: string, fallback?: string): string | undefined {
  const lower = text.toLowerCase();
  if (lower.includes('canggu') || lower.includes('berawa') || lower.includes('pererenan')) return 'CANGGU';
  if (lower.includes('airport') || lower.includes('bandara') || lower.includes('dps') || lower.includes('ngurah rai'))
    return 'AIRPORT_DPS';
  if (lower.includes('ubud') || lower.includes('tegallalang') || lower.includes('gianyar')) return 'UBUD';
  if (lower.includes('seminyak') || lower.includes('oberoi') || lower.includes('petitenget')) return 'SEMINYAK';
  if (lower.includes('uluwatu') || lower.includes('pecatu') || lower.includes('bingin')) return 'ULUWATU';
  if (lower.includes('kuta') || lower.includes('legian')) return 'KUTA';
  return fallback;
}

function parseUserIntent(req: ChatTurnRequest): ParsedIntent {
  const msg = req.message;
  const lower = msg.toLowerCase();

  const daysMatch = lower.match(/(\d+)\s*(?:days?|hari)/i);
  const days = daysMatch ? Math.min(90, Math.max(1, Number(daysMatch[1]))) : 3;

  const bookingMatch = msg.match(/ERB-\d{4}-\d{2,5}/i);
  const bookingId = bookingMatch ? bookingMatch[0].toUpperCase() : undefined;

  let customerName = req.customerName?.trim() || 'Guest Traveler';
  const namePatterns = [
    /(?:for|atas nama|nama saya|nama|under)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/i,
    /(?:i am|i'm|my name is)\s+([A-Z][a-zA-Z]+)/i
  ];
  const stopWords = new Set([
    'tomorrow',
    'today',
    'canggu',
    'ubud',
    'kuta',
    'seminyak',
    'uluwatu',
    'bali',
    'mau',
    'ingin',
    'butuh',
    'sewa',
    'rental',
    'pesan',
    'cari',
    'mobil',
    'motor',
    'hari',
    'besok',
    'saya',
    'aya'
  ]);
  for (const pat of namePatterns) {
    const m = msg.match(pat);
    if (m && m[1]) {
      const candidate = m[1].trim();
      if (!stopWords.has(candidate.toLowerCase())) {
        customerName = candidate;
        break;
      }
    }
  }

  const isIndonesian =
    /\b(cuaca|hujan|cari|carikan|cariin|rekomendasi|pesan|sewa|rental|batal|batalkan|ubah|ganti|pindah|perpanjang|hari|atas nama|mobil|motor|besok|tolong|bagaimana|gimana|mau|saya|aya|lihat|daftar)\b/i.test(
      msg
    );

  const hasSuv = /\bsuvs?\b|fortuner|raize|jimny/i.test(msg);
  const hasScooter = /\b(?:scooters?|motors?|nmax|pcx|vespa)\b/i.test(msg);
  const hasCarGeneric = /\b(mobil|cars?)\b/i.test(msg);
  const wantsMultiOption = (hasSuv && hasScooter) || (hasCarGeneric && hasScooter);

  let category: ParsedIntent['category'];
  if (wantsMultiOption) {
    category = undefined;
  } else if (hasSuv) {
    category = 'SUV';
  } else if (/\bmpvs?\b|xpander|innova|zenix|family|keluarga|7.?seat/i.test(msg)) {
    category = 'MPV';
  } else if (/\bevs?\b|electric|ioniq|listrik/i.test(msg)) {
    category = 'EV';
  } else if (/compact|hatchback|brio|city car/i.test(msg)) {
    category = 'Compact';
  } else if (hasCarGeneric) {
    // User explicitly asked for a car ("mobil") without specifying SUV/MPV -> default to SUV or filter cars
    category = 'SUV';
  } else if (hasScooter || /\bmatic\b/i.test(msg)) {
    category = hasCarGeneric ? undefined : 'Scooter';
  }

  let vehicleKeyword: string | undefined;
  for (const kw of ['raize', 'fortuner', 'jimny', 'xpander', 'zenix', 'innova', 'ioniq', 'brio', 'nmax', 'pcx', 'vespa']) {
    if (lower.includes(kw)) {
      vehicleKeyword = kw;
      break;
    }
  }

  const addons: string[] = [];
  if (/surf\s*rack|surfboard|papan\s*surf/i.test(msg)) addons.push('surf_rack');
  if (/child\s*seat|baby\s*seat|kursi\s*anak/i.test(msg)) addons.push('child_seat');
  if (/helmet|helm/i.test(msg)) addons.push('extra_helmet');
  if (/full\s*insurance|asuransi/i.test(msg)) addons.push('full_insurance_plus');

  const wantsCancel = /\b(cancel|batal|batalkan|refund)\b/i.test(msg);
  const wantsUpdate = /\b(update|modify|change|reschedule|extend|switch|ubah|ganti|perpanjang|pindah|tambah)\b/i.test(msg);
  const wantsBook = !wantsCancel && !wantsUpdate && /\b(book|reserve|lock|pesan|sewa|checkout)\b/i.test(msg);
  const wantsListBookings =
    !wantsBook && !wantsCancel && !wantsUpdate && /\b(my booking|active booking|bookings|daftar booking|pesanan|riwayat)\b/i.test(msg);
  const wantsWeather = /\b(weather|cuaca|rain|hujan|forecast|suhu|panas|cerah|route|trip)\b/i.test(msg);
  const wantsMemorySave = /\b(remember|prefer|preference|ingat|favorit|simpan preferensi)\b/i.test(msg);
  const wantsMemoryRecall = /\b(what do you remember|recall|memory|profile|preferensi saya)\b/i.test(msg);

  return {
    hub: detectHub(msg, req.preferredHub),
    category,
    wantsMultiOption,
    isIndonesian,
    transmission: /manual/i.test(msg) ? 'Manual' : /auto|matic|automatic/i.test(msg) ? 'Automatic' : undefined,
    days,
    customerName,
    bookingId,
    addons,
    wantsBook,
    wantsCancel,
    wantsUpdate,
    wantsListBookings,
    wantsWeather,
    wantsMemorySave,
    wantsMemoryRecall,
    vehicleKeyword
  };
}

export async function runDirectMcpRouter(
  manager: McpClientManager,
  req: ChatTurnRequest
): Promise<{ reply: string; trace: McpToolTraceEntry[]; engineUsed: string }> {
  const intent = parseUserIntent(req);
  const trace: McpToolTraceEntry[] = [];
  const tomorrow = new Date(Date.now() + 86400_000).toISOString().slice(0, 10);

  // 1) Cancellation flow -> MCP B (read then mutate)
  if (intent.wantsCancel) {
    let targetId = intent.bookingId;
    if (!targetId) {
      const listEntry = await manager.callTool('mcp-b', 'list_bookings', { status: 'confirmed' });
      trace.push(listEntry);
      const list = ((listEntry.result as { bookings?: Array<{ booking_id: string }> })?.bookings ?? []);
      targetId = list[0]?.booking_id;
    }
    if (!targetId) {
      return {
        reply: intent.isIndonesian
          ? 'Saat ini belum ada booking aktif yang bisa dibatalkan.'
          : 'There is no active booking to cancel right now.',
        trace,
        engineUsed: 'direct-mcp-router'
      };
    }

    const cancelEntry = await manager.callTool('mcp-b', 'cancel_booking', {
      bookingId: targetId,
      reason: 'Cancelled via Easy Rent Bali Chat Concierge'
    });
    trace.push(cancelEntry);

    const booking = (cancelEntry.result as { booking?: Record<string, unknown> })?.booking;
    return {
      reply: booking
        ? intent.isIndonesian
          ? `Booking **#${booking.booking_id}** (${booking.vehicle_name}) sudah berhasil dibatalkan.`
          : `Booking **#${booking.booking_id}** (${booking.vehicle_name}) has been cancelled.`
        : intent.isIndonesian
        ? `Booking ${targetId} tidak ditemukan.`
        : `Could not find booking ${targetId}.`,
      trace,
      engineUsed: 'direct-mcp-router'
    };
  }

  // 2) Modify / Reschedule / Extend flow -> MCP A (hub/weather check) + MCP B (update_booking)
  if (intent.wantsUpdate) {
    let targetId = intent.bookingId;
    const listEntry = await manager.callTool('mcp-b', 'list_bookings', {});
    trace.push(listEntry);
    const allBookings = (listEntry.result as { bookings?: Array<Record<string, unknown>> })?.bookings ?? [];
    const activeBooking = targetId
      ? allBookings.find((b) => String(b.booking_id).toUpperCase() === targetId)
      : allBookings.find((b) => b.status === 'confirmed' || b.status === 'active');

    if (!activeBooking) {
      return {
        reply: intent.isIndonesian
          ? 'Belum ada booking aktif yang bisa diubah. Silakan buat booking terlebih dahulu!'
          : 'No active booking found to update. Create a reservation first!',
        trace,
        engineUsed: 'direct-mcp-router'
      };
    }

    targetId = String(activeBooking.booking_id);
    const newHub = intent.hub ?? String(activeBooking.pickup_hub);

    // Query MCP A to validate new hub & fetch weather for that hub
    const hubCheck = await manager.callTool('mcp-a', 'get_hub_info', { hub: newHub });
    trace.push(hubCheck);
    const weatherCheck = await manager.callTool('mcp-a', 'get_bali_weather', { hub: newHub });
    trace.push(weatherCheck);

    const existingAddons = JSON.parse(String(activeBooking.addons_json || '[]')) as string[];
    const mergedAddons = Array.from(new Set([...existingAddons, ...intent.addons]));
    const hasDaysMention = /(\d+)\s*(?:days?|hari)/i.test(req.message);
    const newDays = hasDaysMention ? intent.days : Number(activeBooking.days);

    const updateEntry = await manager.callTool('mcp-b', 'update_booking', {
      bookingId: targetId,
      pickupHub: newHub,
      days: newDays,
      addons: mergedAddons,
      notes: `Updated via AI Concierge (${new Date().toISOString().slice(0, 16)})`
    });
    trace.push(updateEntry);

    const updated = (updateEntry.result as { booking?: Record<string, unknown> })?.booking;
    return {
      reply: updated
        ? intent.isIndonesian
          ? `Booking **#${updated.booking_id}** berhasil diperbarui:\n• Kendaraan: **${updated.vehicle_name}**\n• Lokasi Jemput: **${formatHubName(String(updated.pickup_hub))}**\n• Durasi: **${updated.days} hari**\n• Total Baru: **${formatIdr(Number(updated.total_idr))}**`
          : `Booking **#${updated.booking_id}** is updated:\n• Vehicle: **${updated.vehicle_name}**\n• Pickup: **${formatHubName(String(updated.pickup_hub))}** (${updated.days} days)\n• Add-ons: ${mergedAddons.length ? mergedAddons.join(', ') : 'None'}\n• New Total: **${formatIdr(Number(updated.total_idr))}**`
        : 'Unable to update booking.',
      trace,
      engineUsed: 'direct-mcp-router'
    };
  }

  // 3) List bookings flow -> MCP B (list_bookings) + MCP C (read_graph)
  if (intent.wantsListBookings) {
    const listEntry = await manager.callTool('mcp-b', 'list_bookings', {});
    trace.push(listEntry);
    const memEntry = await manager.callTool('mcp-c', 'read_graph', {});
    trace.push(memEntry);

    const bookings = (listEntry.result as { bookings?: Array<Record<string, unknown>> })?.bookings ?? [];
    return {
      reply:
        bookings.length > 0
          ? intent.isIndonesian
            ? `Ditemukan **${bookings.length} reservasi** aktif/tersimpan milik Anda:`
            : `Here are your **${bookings.length} saved reservation(s)**:`
          : intent.isIndonesian
          ? 'Belum ada reservasi tersimpan saat ini.'
          : 'You have no saved reservations yet.',
      trace,
      engineUsed: 'direct-mcp-router'
    };
  }

  // 4) Memory recall/save only -> MCP C
  if (intent.wantsMemoryRecall) {
    const searchEntry = await manager.callTool('mcp-c', 'search_nodes', { query: intent.customerName });
    trace.push(searchEntry);
    const graph = (searchEntry.result as { entities?: Array<{ name: string; observations: string[] }> })?.entities ?? [];
    if (graph.length === 0) {
      return {
        reply: intent.isIndonesian
          ? `Belum ada preferensi tersimpan untuk **${intent.customerName}**. Beri tahu tipe kendaraan atau area favorit Anda untuk menyimpannya!`
          : `No saved preferences yet for **${intent.customerName}**. Tell me your favorite car type or Bali area to save it!`,
        trace,
        engineUsed: 'direct-mcp-router'
      };
    }
    const summary = graph.map((e) => `• **${e.name}**: ${e.observations.join('; ')}`).join('\n');
    return {
      reply: intent.isIndonesian ? `Preferensi tersimpan Anda:\n${summary}` : `Your saved travel preferences:\n${summary}`,
      trace,
      engineUsed: 'direct-mcp-router'
    };
  }

  if (intent.wantsMemorySave && !intent.wantsBook) {
    const obs = [
      intent.category ? `Prefers ${intent.category} vehicles` : null,
      intent.transmission ? `Prefers ${intent.transmission} transmission` : null,
      intent.hub ? `Preferred pickup hub: ${intent.hub}` : null,
      ...intent.addons.map((a) => `Preferred add-on: ${a}`)
    ].filter((x): x is string => Boolean(x));

    const createMem = await manager.callTool('mcp-c', 'create_entities', {
      entities: [
        {
          name: intent.customerName,
          entityType: 'Customer',
          observations: obs.length > 0 ? obs : [req.message]
        }
      ]
    });
    trace.push(createMem);

    // Also query MCP A matching vehicles so it's immediately helpful
    const searchEntry = await manager.callTool('mcp-a', 'search_fleet', {
      category: intent.category,
      transmission: intent.transmission,
      hub: intent.hub
    });
    trace.push(searchEntry);

    return {
      reply: intent.isIndonesian
        ? `Siap! Preferensi untuk **${intent.customerName}** sudah disimpan dan berikut kendaraan yang cocok:`
        : `Got it! Preferences saved for **${intent.customerName}** — here are matching vehicles:`,
      trace,
      engineUsed: 'direct-mcp-router'
    };
  }

  // 5) Default / Search & Book Flow:
  // Step A: Query MCP A (Weather first so recommendations can adapt to rain/sun!)
  const targetHub = intent.hub ?? 'CANGGU';
  const hubDisplay = formatHubName(targetHub);
  const weatherEntry = await manager.callTool('mcp-a', 'get_bali_weather', { hub: targetHub });
  trace.push(weatherEntry);

  const weatherObj = (weatherEntry.result as { weather?: Record<string, unknown> })?.weather;
  const isRainRisk = Boolean(weatherObj?.isRainRisk);
  const effectiveCategory = intent.wantsMultiOption ? (isRainRisk ? 'SUV' : undefined) : intent.category;

  const fleetEntry = await manager.callTool('mcp-a', 'search_fleet', {
    category: effectiveCategory,
    transmission: intent.transmission,
    hub: intent.hub,
    surfRackOnly: intent.addons.includes('surf_rack') ? true : undefined,
    query: intent.vehicleKeyword
  });
  trace.push(fleetEntry);

  const vehicles = (fleetEntry.result as { vehicles?: Array<Record<string, unknown>> })?.vehicles ?? [];
  const chosen = vehicles[0];

  const weatherLine = weatherObj
    ? `${weatherObj.temperatureC}°C ${weatherObj.condition} in ${hubDisplay} (${weatherObj.precipitationProbabilityPct}% rain)`
    : `${hubDisplay} tropical weather`;

  if (!chosen) {
    const fallbackSearch = await manager.callTool('mcp-a', 'search_fleet', {
      category: effectiveCategory
    });
    trace.push(fallbackSearch);
    const fallbackVehicles = (fallbackSearch.result as { vehicles?: Array<Record<string, unknown>> })?.vehicles ?? [];
    return {
      reply: intent.isIndonesian
        ? `Tidak ditemukan unit persis di **${hubDisplay}**, berikut **${fallbackVehicles.length} alternatif** terdekat di Bali:`
        : `No exact match in **${hubDisplay}**, so here are **${fallbackVehicles.length} nearby options** across Bali:`,
      trace,
      engineUsed: 'direct-mcp-router'
    };
  }

  const quoteEntry = await manager.callTool('mcp-a', 'calculate_quote', {
    vehicleId: String(chosen.id),
    days: intent.days,
    hub: targetHub,
    addons: intent.addons
  });
  trace.push(quoteEntry);

  const quote = quoteEntry.result as { totalIdr?: number; deliveryFeeIdr?: number };
  const estTotal = Number(quote.totalIdr ?? Number(chosen.dailyRateIdr) * intent.days);

  // Step B: If booking requested, persist to MCP B (SQLite) + store profile in MCP C (Memory)!
  if (intent.wantsBook) {
    const createEntry = await manager.callTool('mcp-b', 'create_booking', {
      customerName: intent.customerName,
      vehicleId: String(chosen.id),
      vehicleName: String(chosen.name),
      vehicleCategory: String(chosen.category),
      pickupHub: targetHub,
      startDate: tomorrow,
      days: intent.days,
      dailyRateIdr: Number(chosen.dailyRateIdr),
      deliveryFeeIdr: Number(quote.deliveryFeeIdr ?? 0),
      addons: intent.addons,
      notes: `Booked via AI Concierge · ${weatherLine}`
    });
    trace.push(createEntry);

    const memEntry = await manager.callTool('mcp-c', 'create_entities', {
      entities: [
        {
          name: intent.customerName,
          entityType: 'Customer',
          observations: [
            `Booked ${chosen.name} (${chosen.category}) at ${targetHub} for ${intent.days} days`,
            ...(intent.addons.length ? [`Requested add-ons: ${intent.addons.join(', ')}`] : [])
          ]
        }
      ]
    });
    trace.push(memEntry);

    const booking = (createEntry.result as { booking?: Record<string, unknown> })?.booking;
    return {
      reply: booking
        ? intent.isIndonesian
          ? `Om Swastiastu, **${intent.customerName}**! Reservasi Anda sudah terkonfirmasi:\n• Kode Booking: **#${booking.booking_id}**\n• Kendaraan: **${booking.vehicle_name}**\n• Jemput di **${formatHubName(String(booking.pickup_hub))}** · ${booking.start_date} (${booking.days} hari)\n• Total: **${formatIdr(Number(booking.total_idr))}**`
          : `Om Swastiastu, **${intent.customerName}**! Your reservation is confirmed:\n• Booking ID: **#${booking.booking_id}**\n• Vehicle: **${booking.vehicle_name}**\n• Pickup: **${formatHubName(String(booking.pickup_hub))}** on ${booking.start_date} (${booking.days} days)\n• Total: **${formatIdr(Number(booking.total_idr))}**`
        : 'Attempted to create booking, please check your reservations tab.',
      trace,
      engineUsed: 'direct-mcp-router'
    };
  }

  // Concise, warm human recommendation synced with the Weather Card displayed alongside
  const recHeadline = intent.isIndonesian
    ? intent.wantsWeather
      ? isRainRisk
        ? `Karena berpotensi hujan di **${hubDisplay}**, mobil tertutup seperti **SUV** jauh lebih aman dan nyaman dibanding motor.`
        : `Cuaca di **${hubDisplay}** bersahabat — cocok untuk naik motor maupun keliling pakai mobil.`
      : `Siap! Berikut pilihan unit yang tersedia di **${hubDisplay}** untuk Anda:`
    : intent.wantsWeather
    ? isRainRisk
      ? `With rain in the forecast for **${hubDisplay}**, an enclosed **SUV** is much safer and drier than a scooter today.`
      : `Great weather in **${hubDisplay}** right now — ideal for either a scooter or an SUV cruise.`
    : `Here are available vehicles ready for pickup in **${hubDisplay}**:`;

  const pickLine = intent.isIndonesian
    ? `Pilihan populer: **${chosen.name}** (**${formatIdr(Number(chosen.dailyRateIdr))}/hari**, estimasi ${intent.days} hari **${formatIdr(estTotal)}**). Tekan **Pesan** di bawah untuk langsung reservasi!`
    : `Top pick: **${chosen.name}** at **${formatIdr(Number(chosen.dailyRateIdr))}/day** (${intent.days}-day total: **${formatIdr(estTotal)}**). Tap **Book Now** below to reserve!`;

  return {
    reply: `${recHeadline}\n\n${pickLine}`,
    trace,
    engineUsed: 'direct-mcp-router'
  };
}

