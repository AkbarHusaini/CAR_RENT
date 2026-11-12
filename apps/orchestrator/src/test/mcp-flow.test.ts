import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { sanitizeSchemaForGemini } from '../agent/llmAgent.js';
import { executeChatTurn } from '../agent/orchestrator.js';
import { McpClientManager } from '../mcp/clientManager.js';
import { createApiRouter } from '../routes/api.js';

function createTempPaths() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'erb-mcp-test-'));
  return {
    dir,
    dbPath: path.join(dir, 'bookings.db'),
    memoryPath: path.join(dir, 'memory.jsonl')
  };
}

function assertNoForbiddenGeminiKeys(node: unknown, pathLabel = 'root') {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return;
  const obj = node as Record<string, unknown>;
  const forbidden = [
    '$schema',
    'additionalProperties',
    'minLength',
    'maxLength',
    'minimum',
    'maximum',
    'exclusiveMinimum',
    'exclusiveMaximum',
    'minItems',
    'maxItems'
  ];
  for (const key of forbidden) {
    assert.equal(key in obj, false, `Forbidden Gemini schema key "${key}" found at ${pathLabel}`);
  }
  if (obj.properties && typeof obj.properties === 'object') {
    for (const [k, v] of Object.entries(obj.properties as Record<string, unknown>)) {
      assertNoForbiddenGeminiKeys(v, `${pathLabel}.properties.${k}`);
    }
  }
  if (obj.items) {
    assertNoForbiddenGeminiKeys(obj.items, `${pathLabel}.items`);
  }
}

test('End-to-end 3-MCP flow + Gemini schema sanitization + Full HTTP API check', async () => {
  const { dir, dbPath, memoryPath } = createTempPaths();

  const manager1 = new McpClientManager({ bookingsDbPath: dbPath, memoryFilePath: memoryPath });
  await manager1.connectAll();

  const app = express();
  app.use(express.json());
  app.use('/api', createApiRouter(manager1));
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}/api`;

  try {
    // 1. Verify all 3 MCP servers connected and exposed tools
    const servers = manager1.getServersInfo();
    assert.equal(servers.length, 3);
    assert.ok(servers.every((s) => s.connected && s.toolCount > 0));

    const tools = manager1.getAllTools();
    assert.ok(tools.some((t) => t.namespacedName === 'mcp_a__search_fleet'));
    assert.ok(tools.some((t) => t.namespacedName === 'mcp_b__create_booking'));
    assert.ok(tools.some((t) => t.namespacedName === 'mcp_c__create_entities'));

    // 2. Verify Gemini schema sanitizer strips all unsupported JSON-Schema keywords across ALL MCP tools
    for (const tool of tools) {
      const sanitized = sanitizeSchemaForGemini(tool.inputSchema);
      assertNoForbiddenGeminiKeys(sanitized, tool.namespacedName);
    }

    // 3. Two-way flow via chat: Query MCP A -> Persist SQLite MCP B -> Save Memory MCP C
    const bookTurn = await executeChatTurn(manager1, {
      message: 'Find me an automatic SUV in Canggu for 3 days starting tomorrow and book it for Maya',
      engine: 'direct'
    });

    assert.equal(bookTurn.engineUsed, 'direct-mcp-router');
    assert.ok(bookTurn.trace.some((t) => t.serverId === 'mcp-a' && t.toolName === 'search_fleet' && !t.isError));
    assert.ok(bookTurn.trace.some((t) => t.serverId === 'mcp-a' && t.toolName === 'get_bali_weather' && !t.isError));
    assert.ok(bookTurn.trace.some((t) => t.serverId === 'mcp-b' && t.toolName === 'create_booking' && !t.isError));
    assert.ok(bookTurn.trace.some((t) => t.serverId === 'mcp-c' && t.toolName === 'create_entities' && !t.isError));

    assert.ok(bookTurn.booking, 'Booking card should be extracted from MCP B response');
    const createdBookingId = String(bookTurn.booking.booking_id);
    assert.equal(bookTurn.booking.customer_name, 'Maya');
    assert.equal(bookTurn.booking.pickup_hub, 'CANGGU');
    assert.equal(bookTurn.booking.days, 3);

    // 4. Verify HTTP API endpoints end-to-end (health, fleet, bookings, patch, invoke, memory, logs, llm/test)
    const healthRes = await fetch(`${baseUrl}/health`).then((r) => r.json() as Promise<{ ok: boolean; servers: unknown[] }>);
    assert.equal(healthRes.ok, true);
    assert.equal(healthRes.servers.length, 3);

    const fleetRes = await fetch(`${baseUrl}/fleet?hub=CANGGU&category=SUV`).then(
      (r) => r.json() as Promise<{ fleet: unknown[]; weather: { hub: string } }>
    );
    assert.ok(fleetRes.fleet.length >= 1);
    assert.equal(fleetRes.weather.hub, 'CANGGU');

    const patchRes = await fetch(`${baseUrl}/bookings/${createdBookingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pickupHub: 'UBUD', days: 5, addons: ['surf_rack'] })
    }).then((r) => r.json() as Promise<{ booking: { pickup_hub: string; days: number } }>);
    assert.equal(patchRes.booking.pickup_hub, 'UBUD');
    assert.equal(patchRes.booking.days, 5);

    const invokeRes = await fetch(`${baseUrl}/mcp/invoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool: 'mcp_c__search_nodes', arguments: { query: 'Maya' } })
    }).then((r) => r.json() as Promise<{ trace: { isError: boolean } }>);
    assert.equal(invokeRes.trace.isError, false);

    const logsRes = await fetch(`${baseUrl}/mcp/logs?limit=20`).then(
      (r) => r.json() as Promise<{ logs: unknown[] }>
    );
    assert.ok(logsRes.logs.length >= 5);

    // Explicit missing Gemini API key returns clear 400 diagnostic
    const llmTestRes = await fetch(`${baseUrl}/llm/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ engine: 'gemini', llmConfig: { geminiApiKey: '' } })
    });
    assert.equal(llmTestRes.status, 400);
  } finally {
    server.close();
    await manager1.closeAll();
  }

  // 5. Restart a fresh McpClientManager pointing at the exact same SQLite & Memory files to prove real persistence!
  const manager2 = new McpClientManager({ bookingsDbPath: dbPath, memoryFilePath: memoryPath });
  await manager2.connectAll();

  try {
    const listTrace = await manager2.callTool('mcp-b', 'list_bookings', { customerName: 'Maya' });
    assert.equal(listTrace.isError, false);
    const bookings = (listTrace.result as { bookings: Array<Record<string, unknown>> }).bookings;
    assert.equal(bookings.length, 1);
    assert.equal(bookings[0].pickup_hub, 'UBUD');
    assert.equal(bookings[0].days, 5);

    const memTrace = await manager2.callTool('mcp-c', 'search_nodes', { query: 'Maya' });
    assert.equal(memTrace.isError, false);
    const entities = (memTrace.result as { entities?: Array<{ name: string }> }).entities ?? [];
    assert.ok(entities.some((e) => e.name === 'Maya'));

    // 6. Cancel booking via chat
    const cancelTurn = await executeChatTurn(manager2, {
      message: `Cancel booking ${bookings[0].booking_id}`,
      engine: 'direct'
    });
    assert.equal(cancelTurn.booking?.status, 'cancelled');
  } finally {
    await manager2.closeAll();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
