import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpClientManager } from './mcp/clientManager.js';
import { createApiRouter } from './routes/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from both apps/orchestrator/.env and monorepo root .env regardless of cwd
for (const envCandidate of [
  path.resolve(__dirname, '..', '.env'),
  path.resolve(__dirname, '..', '..', '..', '.env'),
  path.resolve(process.cwd(), '.env')
]) {
  if (fs.existsSync(envCandidate)) {
    dotenv.config({ path: envCandidate, override: false });
  }
}

const PORT = Number(process.env.PORT || 3001);

async function bootstrap() {
  const manager = new McpClientManager();
  await manager.connectAll();

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/', (_req, res) => {
    res.json({
      name: 'Easy Rent Bali AI Concierge — MCP Orchestrator',
      status: 'running',
      endpoints: [
        '/api/health',
        '/api/chat',
        '/api/llm/test',
        '/api/fleet',
        '/api/bookings',
        '/api/memory',
        '/api/mcp/tools',
        '/api/mcp/logs'
      ]
    });
  });

  app.use('/api', createApiRouter(manager));

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🌴 Easy Rent Bali MCP Orchestrator listening on http://0.0.0.0:${PORT}`);
    for (const s of manager.getServersInfo()) {
      console.log(`   ✅ ${s.label} — ${s.toolCount} tools (${s.lastLatencyMs}ms)`);
    }
    console.log('');
  });

  const shutdown = async () => {
    server.close();
    await manager.closeAll();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((err) => {
  console.error('Failed to start orchestrator:', err);
  process.exit(1);
});
