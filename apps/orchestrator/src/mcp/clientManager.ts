import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  McpOperationDirection,
  McpServerId,
  McpServerInfo,
  McpToolDescriptor,
  McpToolTraceEntry
} from '../agent/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve monorepo root regardless of running via tsx (src/) or node (dist/)
function resolveRepoRoot(): string {
  const candidates = [
    path.resolve(__dirname, '..', '..', '..', '..'),
    path.resolve(process.cwd(), '..', '..'),
    process.cwd()
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'apps', 'mcp-fleet-weather'))) {
      return dir;
    }
  }
  return path.resolve(__dirname, '..', '..', '..', '..');
}

interface ManagedServer {
  info: McpServerInfo;
  client: Client;
  transport: StdioClientTransport;
  tools: McpToolDescriptor[];
}

export interface McpManagerConfig {
  bookingsDbPath?: string;
  memoryFilePath?: string;
}

export class McpClientManager {
  private servers = new Map<McpServerId, ManagedServer>();
  private toolLookup = new Map<string, McpToolDescriptor>();
  private traceLog: McpToolTraceEntry[] = [];
  private repoRoot = resolveRepoRoot();
  private config: McpManagerConfig;

  constructor(config: McpManagerConfig = {}) {
    this.config = config;
  }

  public async connectAll(): Promise<void> {
    if (this.servers.size > 0) return;

    const dataDir = path.join(this.repoRoot, 'data');
    fs.mkdirSync(dataDir, { recursive: true });

    const bookingsDbPath =
      this.config.bookingsDbPath ||
      process.env.BOOKINGS_DB_PATH ||
      path.join(dataDir, 'easyrent_bookings.db');

    const memoryFilePath =
      this.config.memoryFilePath ||
      process.env.MEMORY_FILE_PATH ||
      path.join(dataDir, 'memory.jsonl');

    const mcpAScript = path.join(this.repoRoot, 'apps', 'mcp-fleet-weather', 'dist', 'index.js');
    const mcpBScript = path.join(this.repoRoot, 'apps', 'mcp-bookings-sqlite', 'dist', 'index.js');
    const mcpCScript = path.join(
      this.repoRoot,
      'apps',
      'orchestrator',
      'node_modules',
      '@modelcontextprotocol',
      'server-memory',
      'dist',
      'index.js'
    );

    await this.connectServer({
      id: 'mcp-a',
      name: 'fleet_weather_server',
      label: 'MCP A · Fleet & Weather (READ)',
      role: 'Query vehicle catalog, pricing quotes & live Open-Meteo Bali weather',
      direction: 'READ',
      packageRef: '@easyrentbali/mcp-fleet-weather (custom @modelcontextprotocol/sdk)',
      scriptPath: mcpAScript,
      env: {}
    });

    await this.connectServer({
      id: 'mcp-b',
      name: 'bookings_sqlite_server',
      label: 'MCP B · Bookings SQLite (WRITE)',
      role: 'Create, modify, cancel & persist reservations in SQLite ledger',
      direction: 'WRITE',
      packageRef: '@easyrentbali/mcp-bookings-sqlite (custom @modelcontextprotocol/sdk + node:sqlite)',
      scriptPath: mcpBScript,
      env: {
        BOOKINGS_DB_PATH: bookingsDbPath
      }
    });

    await this.connectServer({
      id: 'mcp-c',
      name: 'memory_knowledge_graph',
      label: 'MCP C · Customer Memory (GRAPH)',
      role: 'Persist customer preferences & travel notes across sessions',
      direction: 'MEMORY',
      packageRef: '@modelcontextprotocol/server-memory (official public MCP)',
      scriptPath: mcpCScript,
      env: {
        MEMORY_FILE_PATH: memoryFilePath
      }
    });
  }

  private async connectServer(opts: {
    id: McpServerId;
    name: string;
    label: string;
    role: string;
    direction: McpOperationDirection;
    packageRef: string;
    scriptPath: string;
    env: Record<string, string>;
  }): Promise<void> {
    if (!fs.existsSync(opts.scriptPath)) {
      throw new Error(`MCP entrypoint missing for ${opts.id}: ${opts.scriptPath}`);
    }

    const start = performance.now();
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [opts.scriptPath],
      env: {
        ...process.env,
        ...opts.env
      } as Record<string, string>,
      stderr: 'pipe'
    });

    const client = new Client({
      name: 'easy-rent-bali-orchestrator',
      version: '1.0.0'
    });

    await client.connect(transport);
    const listRes = await client.listTools();
    const prefix = opts.id.replace('-', '_'); // mcp_a, mcp_b, mcp_c

    const tools: McpToolDescriptor[] = listRes.tools.map((tool) => {
      const namespacedName = `${prefix}__${tool.name}`;
      const desc: McpToolDescriptor = {
        serverId: opts.id,
        serverLabel: opts.label,
        direction: opts.direction,
        name: tool.name,
        namespacedName,
        description: tool.description ?? '',
        inputSchema: (tool.inputSchema as Record<string, unknown>) ?? {
          type: 'object',
          properties: {}
        }
      };
      this.toolLookup.set(namespacedName, desc);
      return desc;
    });

    const elapsed = Math.max(1, Math.round(performance.now() - start));
    this.servers.set(opts.id, {
      info: {
        id: opts.id,
        name: opts.name,
        label: opts.label,
        role: opts.role,
        direction: opts.direction,
        transport: 'stdio',
        packageRef: opts.packageRef,
        connected: true,
        toolCount: tools.length,
        lastLatencyMs: elapsed
      },
      client,
      transport,
      tools
    });
  }

  public getServersInfo(): McpServerInfo[] {
    return Array.from(this.servers.values()).map((s) => s.info);
  }

  public getAllTools(): McpToolDescriptor[] {
    return Array.from(this.toolLookup.values());
  }

  public getRecentLogs(limit = 50): McpToolTraceEntry[] {
    return this.traceLog.slice(-limit).reverse();
  }

  public async callTool(
    serverId: McpServerId,
    toolName: string,
    args: Record<string, unknown> = {}
  ): Promise<McpToolTraceEntry> {
    const managed = this.servers.get(serverId);
    if (!managed) {
      throw new Error(`MCP server '${serverId}' is not connected.`);
    }

    const prefix = serverId.replace('-', '_');
    const namespacedName = `${prefix}__${toolName}`;
    const start = performance.now();

    let parsedResult: unknown = null;
    let isError = false;

    try {
      const response = await managed.client.callTool({
        name: toolName,
        arguments: args
      });
      isError = Boolean(response.isError);
      const rawContent = Array.isArray(response.content) ? response.content : [];
      const textParts = rawContent
        .filter((c): c is { type: 'text'; text: string } => c.type === 'text' && typeof c.text === 'string')
        .map((c) => c.text);

      const joined = textParts.join('\n').trim();
      if (joined) {
        try {
          parsedResult = JSON.parse(joined);
        } catch {
          parsedResult = { text: joined };
        }
      } else {
        parsedResult = response.structuredContent ?? response;
      }
    } catch (err) {
      isError = true;
      parsedResult = { error: err instanceof Error ? err.message : String(err) };
    }

    const durationMs = Math.max(1, Math.round(performance.now() - start));
    managed.info.lastLatencyMs = durationMs;

    const entry: McpToolTraceEntry = {
      id: `tr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      serverId,
      serverLabel: managed.info.label,
      direction: managed.info.direction,
      toolName,
      namespacedName,
      arguments: args,
      result: parsedResult,
      isError,
      durationMs
    };

    this.traceLog.push(entry);
    if (this.traceLog.length > 200) {
      this.traceLog.splice(0, this.traceLog.length - 200);
    }
    return entry;
  }

  public async callNamespacedTool(
    namespacedName: string,
    args: Record<string, unknown> = {}
  ): Promise<McpToolTraceEntry> {
    const desc = this.toolLookup.get(namespacedName);
    if (!desc) {
      // Allow matching un-prefixed name if unique
      const byPlain = Array.from(this.toolLookup.values()).find((t) => t.name === namespacedName);
      if (byPlain) {
        return this.callTool(byPlain.serverId, byPlain.name, args);
      }
      throw new Error(`Unknown MCP tool: '${namespacedName}'`);
    }
    return this.callTool(desc.serverId, desc.name, args);
  }

  public async closeAll(): Promise<void> {
    for (const managed of this.servers.values()) {
      try {
        await managed.client.close();
      } catch {
        // Ignore shutdown close errors
      }
    }
    this.servers.clear();
    this.toolLookup.clear();
  }
}

