import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { BookingsDatabase } from './db/sqlite.js';

const db = new BookingsDatabase();

const server = new McpServer({
  name: 'easy-rent-bali-mcp-b-bookings-sqlite',
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
  'create_booking',
  {
    title: 'Create & Persist Vehicle Booking (SQLite)',
    description:
      'Persist a new Easy Rent Bali reservation to the SQLite ledger using vehicle details and rates retrieved from MCP A.',
    inputSchema: {
      customerName: z.string().min(1).describe('Customer full name'),
      customerPhone: z.string().optional().describe('Optional phone or WhatsApp number'),
      vehicleId: z.string().min(1).describe('Vehicle ID from MCP A (e.g., TOY-RAZ-04)'),
      vehicleName: z.string().min(1).describe('Vehicle model name from MCP A'),
      vehicleCategory: z.string().optional().describe('Category (SUV, MPV, Compact, EV, Scooter)'),
      pickupHub: z.string().min(1).describe('Pickup hub code or area (CANGGU, KUTA, AIRPORT_DPS, UBUD, SEMINYAK, ULUWATU)'),
      startDate: z.string().min(4).describe('ISO start date YYYY-MM-DD'),
      days: z.number().int().min(1).max(90).describe('Rental duration in days'),
      dailyRateIdr: z.number().int().positive().describe('Daily rate in IDR obtained from MCP A'),
      deliveryFeeIdr: z.number().int().min(0).optional().describe('Optional hub delivery fee in IDR'),
      addons: z.array(z.string()).optional().describe('Optional add-ons like surf_rack, child_seat, extra_helmet'),
      notes: z.string().optional().describe('Special pickup instructions')
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false
    }
  },
  async (args) => {
    const { booking, rowId } = db.createBooking(args);
    return jsonResult({
      server: 'MCP-B (bookings_sqlite_server)',
      operation: 'WRITE_PERSIST',
      persisted: true,
      sqliteRowId: rowId,
      dbPath: db.dbPath,
      booking
    });
  }
);

server.registerTool(
  'update_booking',
  {
    title: 'Modify Persisted Booking (SQLite)',
    description:
      'Update an existing booking in SQLite (pickup hub, start date, duration days, add-ons, notes, or status) and recalculate total IDR.',
    inputSchema: {
      bookingId: z.string().min(1).describe('Existing booking ID, e.g., ERB-2026-102'),
      pickupHub: z.string().optional().describe('New pickup hub code'),
      startDate: z.string().optional().describe('New start date YYYY-MM-DD'),
      days: z.number().int().min(1).max(90).optional().describe('Updated rental duration in days'),
      addons: z.array(z.string()).optional().describe('Updated list of add-ons'),
      notes: z.string().optional().describe('Updated notes'),
      status: z.enum(['confirmed', 'active', 'cancelled', 'completed']).optional().describe('Updated booking status')
    },
    annotations: {
      readOnlyHint: false,
      idempotentHint: true
    }
  },
  async (args) => {
    const updated = db.updateBooking(args);
    if (!updated) {
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ error: `Booking '${args.bookingId}' not found in SQLite ledger.` })
          }
        ]
      };
    }

    return jsonResult({
      server: 'MCP-B (bookings_sqlite_server)',
      operation: 'WRITE_MODIFY',
      persisted: true,
      booking: updated
    });
  }
);

server.registerTool(
  'cancel_booking',
  {
    title: 'Cancel Booking (SQLite)',
    description: 'Mark an existing reservation as cancelled in SQLite with a timestamped reason.',
    inputSchema: {
      bookingId: z.string().min(1).describe('Booking ID to cancel, e.g., ERB-2026-103'),
      reason: z.string().optional().describe('Cancellation reason')
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: true
    }
  },
  async ({ bookingId, reason }) => {
    const cancelled = db.cancelBooking(bookingId, reason);
    if (!cancelled) {
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ error: `Booking '${bookingId}' not found in SQLite ledger.` })
          }
        ]
      };
    }

    return jsonResult({
      server: 'MCP-B (bookings_sqlite_server)',
      operation: 'WRITE_CANCEL',
      persisted: true,
      booking: cancelled
    });
  }
);

server.registerTool(
  'list_bookings',
  {
    title: 'List Persisted Bookings (SQLite)',
    description: 'Query persisted reservations stored in the SQLite ledger, optionally filtered by customer name or status.',
    inputSchema: {
      customerName: z.string().optional().describe('Partial customer name match'),
      status: z.enum(['confirmed', 'active', 'cancelled', 'completed', 'all']).optional().describe('Booking status filter'),
      vehicleId: z.string().optional().describe('Optional vehicle ID filter')
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true
    }
  },
  async (filters) => {
    const bookings = db.listBookings(filters);
    return jsonResult({
      server: 'MCP-B (bookings_sqlite_server)',
      operation: 'READ_LEDGER',
      total: bookings.length,
      bookings
    });
  }
);

server.registerTool(
  'get_booking',
  {
    title: 'Get Single Booking (SQLite)',
    description: 'Fetch a single persisted booking record from SQLite by bookingId.',
    inputSchema: {
      bookingId: z.string().min(1).describe('Booking ID such as ERB-2026-101')
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true
    }
  },
  async ({ bookingId }) => {
    const booking = db.getBooking(bookingId);
    if (!booking) {
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ error: `Booking '${bookingId}' not found.` })
          }
        ]
      };
    }
    return jsonResult({
      server: 'MCP-B (bookings_sqlite_server)',
      operation: 'READ_LEDGER',
      booking
    });
  }
);

server.registerResource(
  'bookings-ledger',
  'bookings://ledger',
  {
    title: 'Easy Rent Bali SQLite Bookings Ledger',
    description: 'Live persisted SQLite reservations',
    mimeType: 'application/json'
  },
  async (uri) => ({
    contents: [
      {
        uri: uri.href,
        text: JSON.stringify({ dbPath: db.dbPath, bookings: db.listBookings() }, null, 2)
      }
    ]
  })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('[MCP-B] Fatal error:', err);
  process.exit(1);
});

process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});
process.on('SIGTERM', () => {
  db.close();
  process.exit(0);
});

