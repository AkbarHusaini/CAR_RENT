import { Router } from 'express';
import { z } from 'zod';
import { executeChatTurn, getEngineStatus, testLlmConnectivity } from '../agent/orchestrator.js';
import { McpClientManager } from '../mcp/clientManager.js';

const llmConfigSchema = z
  .object({
    geminiApiKey: z.string().optional(),
    geminiModel: z.string().optional(),
    openaiApiKey: z.string().optional(),
    openaiBaseUrl: z.string().optional(),
    openaiModel: z.string().optional(),
    ollamaBaseUrl: z.string().optional(),
    ollamaModel: z.string().optional()
  })
  .optional();

const chatSchema = z.object({
  message: z.string().trim().min(1, 'Message cannot be empty'),
  sessionId: z.string().optional(),
  customerName: z.string().optional(),
  preferredHub: z.string().optional(),
  engine: z.enum(['auto', 'direct', 'ollama', 'gemini', 'openai']).optional(),
  llmConfig: llmConfigSchema,
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string()
      })
    )
    .optional()
});

const testLlmSchema = z.object({
  engine: z.enum(['gemini', 'openai', 'ollama']),
  llmConfig: llmConfigSchema
});

const createBookingSchema = z.object({
  customerName: z.string().trim().min(1),
  customerPhone: z.string().optional(),
  vehicleId: z.string().trim().min(1),
  pickupHub: z.string().trim().min(1),
  startDate: z.string().trim().min(4),
  days: z.number().int().min(1).max(90),
  addons: z.array(z.string()).optional(),
  notes: z.string().optional()
});

const updateBookingSchema = z.object({
  pickupHub: z.string().optional(),
  startDate: z.string().optional(),
  days: z.number().int().min(1).max(90).optional(),
  addons: z.array(z.string()).optional(),
  notes: z.string().optional(),
  status: z.enum(['confirmed', 'active', 'cancelled', 'completed']).optional()
});

export function createApiRouter(manager: McpClientManager): Router {
  const router = Router();

  router.get('/health', async (_req, res) => {
    const engines = await getEngineStatus();
    res.json({
      ok: true,
      service: 'Easy Rent Bali MCP Orchestrator',
      timestamp: new Date().toISOString(),
      servers: manager.getServersInfo(),
      engines
    });
  });

  router.post('/llm/test', async (req, res) => {
    const parsed = testLlmSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    try {
      const result = await testLlmConnectivity(parsed.data.engine, parsed.data.llmConfig);
      res.status(result.ok ? 200 : 400).json(result);
    } catch (err) {
      res.status(500).json({
        ok: false,
        engine: parsed.data.engine,
        detail: err instanceof Error ? err.message : String(err)
      });
    }
  });

  router.post('/chat', async (req, res) => {
    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      const response = await executeChatTurn(manager, parsed.data);
      res.json(response);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  router.get('/fleet', async (req, res) => {
    try {
      const category = typeof req.query.category === 'string' ? req.query.category : undefined;
      const hub = typeof req.query.hub === 'string' ? req.query.hub : 'CANGGU';
      const transmission =
        req.query.transmission === 'Automatic' || req.query.transmission === 'Manual'
          ? req.query.transmission
          : undefined;

      const [fleetTrace, weatherTrace, hubsTrace] = await Promise.all([
        manager.callTool('mcp-a', 'search_fleet', {
          category: category || 'ALL',
          hub: req.query.hub ? String(req.query.hub) : undefined,
          transmission
        }),
        manager.callTool('mcp-a', 'get_bali_weather', { hub }),
        manager.callTool('mcp-a', 'get_hub_info', {})
      ]);

      res.json({
        fleet: (fleetTrace.result as { vehicles?: unknown[] })?.vehicles ?? [],
        weather: (weatherTrace.result as { weather?: unknown })?.weather ?? null,
        hubs: (hubsTrace.result as { hubs?: unknown[] })?.hubs ?? [],
        trace: [fleetTrace, weatherTrace, hubsTrace]
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.get('/bookings', async (req, res) => {
    try {
      const status = typeof req.query.status === 'string' ? req.query.status : 'all';
      const customerName =
        typeof req.query.customerName === 'string' ? req.query.customerName : undefined;
      const entry = await manager.callTool('mcp-b', 'list_bookings', {
        status,
        customerName
      });
      res.json({
        bookings: (entry.result as { bookings?: unknown[] })?.bookings ?? [],
        trace: entry
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.post('/bookings', async (req, res) => {
    const parsed = createBookingSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      const { customerName, customerPhone, vehicleId, pickupHub, startDate, days, addons = [], notes } =
        parsed.data;

      const detailsTrace = await manager.callTool('mcp-a', 'get_vehicle_details', { vehicleId });
      if (detailsTrace.isError) {
        res.status(404).json({ error: 'Vehicle not found via MCP A', trace: [detailsTrace] });
        return;
      }
      const vehicle = (detailsTrace.result as { vehicle: Record<string, unknown> }).vehicle;

      const quoteTrace = await manager.callTool('mcp-a', 'calculate_quote', {
        vehicleId,
        days,
        hub: pickupHub,
        addons
      });
      const quote = quoteTrace.result as { deliveryFeeIdr?: number; hub?: string };

      const persistTrace = await manager.callTool('mcp-b', 'create_booking', {
        customerName,
        customerPhone,
        vehicleId: String(vehicle.id),
        vehicleName: String(vehicle.name),
        vehicleCategory: String(vehicle.category),
        pickupHub: quote.hub || pickupHub,
        startDate,
        days,
        dailyRateIdr: Number(vehicle.dailyRateIdr),
        deliveryFeeIdr: Number(quote.deliveryFeeIdr ?? 0),
        addons,
        notes
      });

      const memTrace = await manager.callTool('mcp-c', 'create_entities', {
        entities: [
          {
            name: customerName,
            entityType: 'Customer',
            observations: [`Booked ${vehicle.name} at ${quote.hub || pickupHub} for ${days} days`]
          }
        ]
      });

      res.status(201).json({
        booking: (persistTrace.result as { booking?: unknown })?.booking ?? null,
        trace: [detailsTrace, quoteTrace, persistTrace, memTrace]
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.patch('/bookings/:id', async (req, res) => {
    const parsed = updateBookingSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      const entry = await manager.callTool('mcp-b', 'update_booking', {
        bookingId: req.params.id,
        ...parsed.data
      });
      if (entry.isError) {
        res.status(404).json({ error: entry.result, trace: entry });
        return;
      }
      res.json({
        booking: (entry.result as { booking?: unknown })?.booking ?? null,
        trace: entry
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.post('/bookings/:id/cancel', async (req, res) => {
    try {
      const reason = typeof req.body?.reason === 'string' ? req.body.reason : 'Cancelled from Bookings tab';
      const entry = await manager.callTool('mcp-b', 'cancel_booking', {
        bookingId: req.params.id,
        reason
      });
      if (entry.isError) {
        res.status(404).json({ error: entry.result, trace: entry });
        return;
      }
      res.json({
        booking: (entry.result as { booking?: unknown })?.booking ?? null,
        trace: entry
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.get('/memory', async (_req, res) => {
    try {
      const entry = await manager.callTool('mcp-c', 'read_graph', {});
      res.json({
        graph: entry.result,
        trace: entry
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.get('/mcp/tools', (_req, res) => {
    res.json({
      servers: manager.getServersInfo(),
      tools: manager.getAllTools()
    });
  });

  router.get('/mcp/logs', (req, res) => {
    const limit = Math.min(150, Math.max(1, Number(req.query.limit || 50)));
    res.json({
      logs: manager.getRecentLogs(limit)
    });
  });

  router.post('/mcp/invoke', async (req, res) => {
    const tool = typeof req.body?.tool === 'string' ? req.body.tool : '';
    const args =
      req.body?.arguments && typeof req.body.arguments === 'object'
        ? (req.body.arguments as Record<string, unknown>)
        : {};
    if (!tool) {
      res.status(400).json({ error: 'Missing required field: tool' });
      return;
    }

    try {
      const trace = await manager.callNamespacedTool(tool, args);
      res.json({ trace });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  return router;
}
