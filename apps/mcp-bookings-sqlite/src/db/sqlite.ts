import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

export type BookingStatus = 'confirmed' | 'active' | 'cancelled' | 'completed';

export interface BookingRecord {
  booking_id: string;
  customer_name: string;
  customer_phone: string | null;
  vehicle_id: string;
  vehicle_name: string;
  vehicle_category: string;
  pickup_hub: string;
  start_date: string;
  days: number;
  daily_rate_idr: number;
  delivery_fee_idr: number;
  addons_json: string;
  total_idr: number;
  status: BookingStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateBookingInput {
  customerName: string;
  customerPhone?: string;
  vehicleId: string;
  vehicleName: string;
  vehicleCategory?: string;
  pickupHub: string;
  startDate: string;
  days: number;
  dailyRateIdr: number;
  deliveryFeeIdr?: number;
  addons?: string[];
  notes?: string;
}

export interface UpdateBookingInput {
  bookingId: string;
  pickupHub?: string;
  startDate?: string;
  days?: number;
  addons?: string[];
  notes?: string;
  status?: BookingStatus;
}

const ADDON_DAILY_PRICING_IDR: Record<string, number> = {
  surf_rack: 35000,
  child_seat: 40000,
  full_insurance_plus: 60000,
  extra_helmet: 15000
};

export function computeAddonsTotalIdr(addons: string[], days: number): number {
  return addons.reduce((sum, addon) => {
    const key = addon.toLowerCase().trim().replace(/\s+/g, '_');
    const daily = ADDON_DAILY_PRICING_IDR[key] ?? 25000;
    return sum + daily * days;
  }, 0);
}

export class BookingsDatabase {
  private db: DatabaseSync;
  public readonly dbPath: string;

  constructor(dbPath?: string) {
    const resolved =
      dbPath ||
      process.env.BOOKINGS_DB_PATH ||
      path.resolve(process.cwd(), 'data', 'easyrent_bookings.db');

    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    this.dbPath = resolved;
    this.db = new DatabaseSync(resolved);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.migrate();
    this.seedIfEmpty();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        booking_id TEXT NOT NULL UNIQUE,
        customer_name TEXT NOT NULL,
        customer_phone TEXT,
        vehicle_id TEXT NOT NULL,
        vehicle_name TEXT NOT NULL,
        vehicle_category TEXT NOT NULL DEFAULT 'SUV',
        pickup_hub TEXT NOT NULL,
        start_date TEXT NOT NULL,
        days INTEGER NOT NULL CHECK(days > 0),
        daily_rate_idr INTEGER NOT NULL CHECK(daily_rate_idr > 0),
        delivery_fee_idr INTEGER NOT NULL DEFAULT 0,
        addons_json TEXT NOT NULL DEFAULT '[]',
        total_idr INTEGER NOT NULL CHECK(total_idr > 0),
        status TEXT NOT NULL DEFAULT 'confirmed',
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
      CREATE INDEX IF NOT EXISTS idx_bookings_vehicle ON bookings(vehicle_id);
      CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings(customer_name);
    `);
  }

  private seedIfEmpty(): void {
    const row = this.db.prepare('SELECT COUNT(*) AS cnt FROM bookings').get() as { cnt: number };
    if (row.cnt > 0) return;

    const now = new Date().toISOString();
    const tomorrow = new Date(Date.now() + 86400_000).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);

    const insert = this.db.prepare(`
      INSERT INTO bookings (
        booking_id, customer_name, customer_phone, vehicle_id, vehicle_name,
        vehicle_category, pickup_hub, start_date, days, daily_rate_idr,
        delivery_fee_idr, addons_json, total_idr, status, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insert.run(
      'ERB-2026-101',
      'Kadek Putra',
      '+62 812-3800-4411',
      'YAM-NMX-05',
      'Yamaha NMAX 155 Connected',
      'Scooter',
      'UBUD',
      today,
      2,
      150000,
      50000,
      JSON.stringify(['extra_helmet']),
      380000,
      'active',
      '2 SNI helmets + phone mount ready at Ubud Hub',
      now,
      now
    );

    insert.run(
      'ERB-2026-102',
      'Sienna Laurent',
      '+61 412-908-221',
      'MIT-XPN-02',
      'Mitsubishi Xpander Cross',
      'MPV',
      'AIRPORT_DPS',
      tomorrow,
      4,
      480000,
      75000,
      JSON.stringify(['child_seat']),
      2155000,
      'confirmed',
      'Flight SQ944 arrival gate B pickup',
      now,
      now
    );
  }

  private nextBookingId(): string {
    const row = this.db.prepare('SELECT COALESCE(MAX(id), 0) AS maxId FROM bookings').get() as {
      maxId: number;
    };
    const num = 100 + row.maxId + 1;
    return `ERB-2026-${num}`;
  }

  public createBooking(input: CreateBookingInput): {
    booking: BookingRecord;
    rowId: number;
  } {
    const addons = input.addons ?? [];
    const deliveryFee = input.deliveryFeeIdr ?? 0;
    const addonsTotal = computeAddonsTotalIdr(addons, input.days);
    const totalIdr = input.dailyRateIdr * input.days + deliveryFee + addonsTotal;
    const bookingId = this.nextBookingId();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO bookings (
        booking_id, customer_name, customer_phone, vehicle_id, vehicle_name,
        vehicle_category, pickup_hub, start_date, days, daily_rate_idr,
        delivery_fee_idr, addons_json, total_idr, status, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, ?)
    `);

    const info = stmt.run(
      bookingId,
      input.customerName.trim(),
      input.customerPhone?.trim() ?? null,
      input.vehicleId.trim(),
      input.vehicleName.trim(),
      input.vehicleCategory?.trim() || 'SUV',
      input.pickupHub.trim().toUpperCase(),
      input.startDate.trim(),
      input.days,
      input.dailyRateIdr,
      deliveryFee,
      JSON.stringify(addons),
      totalIdr,
      input.notes?.trim() ?? null,
      now,
      now
    );

    const created = this.getBooking(bookingId)!;
    return {
      booking: created,
      rowId: Number(info.lastInsertRowid)
    };
  }

  public getBooking(bookingId: string): BookingRecord | null {
    const row = this.db
      .prepare('SELECT * FROM bookings WHERE UPPER(booking_id) = UPPER(?)')
      .get(bookingId.trim()) as BookingRecord | undefined;
    return row ?? null;
  }

  public listBookings(filters?: {
    customerName?: string;
    status?: BookingStatus | 'all';
    vehicleId?: string;
  }): BookingRecord[] {
    const clauses: string[] = [];
    const params: (string | number)[] = [];

    if (filters?.customerName) {
      clauses.push('LOWER(customer_name) LIKE LOWER(?)');
      params.push(`%${filters.customerName.trim()}%`);
    }
    if (filters?.status && filters.status !== 'all') {
      clauses.push('status = ?');
      params.push(filters.status);
    }
    if (filters?.vehicleId) {
      clauses.push('UPPER(vehicle_id) = UPPER(?)');
      params.push(filters.vehicleId.trim());
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const sql = `SELECT * FROM bookings ${where} ORDER BY id DESC`;
    return this.db.prepare(sql).all(...params) as unknown as BookingRecord[];
  }

  public updateBooking(input: UpdateBookingInput): BookingRecord | null {
    const existing = this.getBooking(input.bookingId);
    if (!existing) return null;

    const pickupHub = input.pickupHub ? input.pickupHub.trim().toUpperCase() : existing.pickup_hub;
    const startDate = input.startDate ? input.startDate.trim() : existing.start_date;
    const days = input.days ?? existing.days;
    const addons: string[] = input.addons ?? JSON.parse(existing.addons_json || '[]');
    const notes = input.notes !== undefined ? input.notes : existing.notes;
    const status = input.status ?? existing.status;

    const addonsTotal = computeAddonsTotalIdr(addons, days);
    const totalIdr = existing.daily_rate_idr * days + existing.delivery_fee_idr + addonsTotal;
    const now = new Date().toISOString();

    this.db
      .prepare(
        `UPDATE bookings
         SET pickup_hub = ?, start_date = ?, days = ?, addons_json = ?,
             total_idr = ?, status = ?, notes = ?, updated_at = ?
         WHERE booking_id = ?`
      )
      .run(
        pickupHub,
        startDate,
        days,
        JSON.stringify(addons),
        totalIdr,
        status,
        notes,
        now,
        existing.booking_id
      );

    return this.getBooking(existing.booking_id);
  }

  public cancelBooking(bookingId: string, reason?: string): BookingRecord | null {
    const existing = this.getBooking(bookingId);
    if (!existing) return null;

    const now = new Date().toISOString();
    const cancelNote = reason ? `Cancelled: ${reason}` : 'Cancelled by customer via AI Concierge';
    const mergedNotes = existing.notes ? `${existing.notes} | ${cancelNote}` : cancelNote;

    this.db
      .prepare(`UPDATE bookings SET status = 'cancelled', notes = ?, updated_at = ? WHERE booking_id = ?`)
      .run(mergedNotes, now, existing.booking_id);

    return this.getBooking(existing.booking_id);
  }

  public countActiveForVehicle(vehicleId: string): number {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS cnt FROM bookings
         WHERE UPPER(vehicle_id) = UPPER(?) AND status IN ('confirmed', 'active')`
      )
      .get(vehicleId.trim()) as { cnt: number };
    return row.cnt;
  }

  public close(): void {
    this.db.close();
  }
}

