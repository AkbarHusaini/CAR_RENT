# AI Coding Agent Session Logs & Steering Audit (Track A)

## AI-First Toolchain Used
- **Primary Coding Agent:** Google Antigravity
- **UI/UX Design Agent (MCP):** Google Stitch (`stitch` MCP server — project `projects/10921819372038516110`, design system *"Obsidian Tropical AI Concierge"*)
- **Local Model Benchmarked:** Ollama `qwen2.5:3b` (local runtime tested during development)

---

## Session Workflow & Candidate Steering Milestones

### 1. Environment & Toolchain Discovery
- Inspected local workspace `D:\projet\carrent` and read `tech_test/Technical Assessment - Easy Rent Bali.pdf` (Track A requirements: Expo chatbot mobile app + minimum 2x MCP where system queries from MCP A and modifies/persists to MCP B).
- Audited local runtime capabilities:
  - Node.js `v24.14.1` with native `node:sqlite` (`DatabaseSync`) available—eliminating native C++ `better-sqlite3` build issues on Windows.
  - Python not installed on host—steered all MCP servers to pure TypeScript + Node.js (`@modelcontextprotocol/sdk` v1.x and official `@modelcontextprotocol/server-memory` v2.1.0).
  - Ollama `0.30.10` with `qwen2.5:3b` present locally.

### 2. Google Stitch UI Design Generation (via Stitch MCP)
- Created Stitch project `Easy Rent Bali AI Concierge (Expo MCP Chatbot)` (`projects/10921819372038516110`).
- Generated two high-fidelity mobile screens via `stitch.generate_screen_from_text` (`GEMINI_3_8_FLASH`):
  1. **Chat Concierge Screen** (`docs/design/stitch_chat_screen.png`) — Established the *Obsidian Tropical AI Concierge* palette (`#0B1117` canvas, `#131C24` cards, `#10B981` emerald primary, `#38BDF8` sky-blue MCP-A Query badges, `#F59E0B` amber MCP-B Write badges).
  2. **Bookings & MCP Ledger Screen** (`docs/design/stitch_bookings_screen.png`) — Defined persisted booking cards, mutation triggers, and chronological JSON-RPC tool stream.

### 3. Technical Issues Discovered & Steering Decisions

1. **Local Ollama CPU Memory Bottleneck (`qwen2.5:3b` Benchmark):**
   - *Observation:* Running `ollama serve` on the host machine showed only ~1.8–2.6 GiB free physical RAM out of 16 GiB (`AMD Radeon` iGPU dropped, CPU-only inference). Tool-calling benchmarks against `qwen2.5:3b` exceeded 60s and 180s timeouts due to CPU memory paging.
   - *Steering Decision:* Rather than hard-coupling the mobile app solely to local Ollama (which would stall demos on low-RAM laptops or cloud deployments), engineered a **Multi-Engine Orchestrator** supporting:
     - **Ollama** (`/api/chat` with tool calling)
     - **Google Gemini** (`generateContent` with `functionDeclarations`, stripping unsupported JSON Schema `$schema` / `additionalProperties` fields)
     - **OpenAI-Compatible** (`/v1/chat/completions` tools)
     - **Direct MCP Intent Router** (`direct-mcp-router`, deterministic EN/ID natural-language parser invoking the exact same real `McpClientManager` tools over MCP A, B, and C with zero LLM timeout risk, clearly tagged in every trace card).

2. **`@modelcontextprotocol/server-memory` Persistence Path Behavior:**
   - *Observation:* Inspected `@modelcontextprotocol/server-memory/dist/index.js` and observed `MEMORY_FILE_PATH` writes JSONL (`memory.jsonl`) and throws on invalid migration paths.
   - *Steering Decision:* Explicitly configured `MEMORY_FILE_PATH` per orchestrator instance (`data/memory.jsonl` in production, isolated temp dirs in automated tests) and spawned via `process.execPath` directly rather than `npx` to avoid Windows `.cmd` shell spawning overhead.

3. **React Native 0.88 / Expo SDK 58 Strict Type Compatibility:**
   - *Observation:* Running `npx tsc --noEmit` on `create-expo-app` (`tabs@sdk-58`, React 19.3, RN 0.88.1) flagged `DefaultText['props']`, `ScrollView` ref type changes (`React.ComponentRef<typeof ScrollView>`), `StatusBar` `backgroundColor` removal, and `tabBarIcon` `ColorValue` narrowing.
   - *Steering Decision:* Updated `app/_layout.tsx`, `app/(tabs)/_layout.tsx`, `app/(tabs)/index.tsx`, `components/Themed.tsx`, and `components/ExternalLink.tsx` (for strict Expo Router `typedRoutes` `Href` checking after `.expo/types/router.d.ts` generation) until `npx tsc --noEmit` passed with 0 errors.

4. **Gemini API Schema Compatibility, `.env` Resolution & In-App Provider Configuration:**
   - *Observation:* Inspecting live JSON Schemas emitted across MCP A/B/C revealed Zod/MCP keywords (`minLength`, `maxLength`, `minimum`, `maximum`, `minItems`, `exclusiveMinimum`, `$schema`, `additionalProperties`) that trigger HTTP 400 validation errors on Gemini `v1beta` `functionDeclarations`. In addition, `import 'dotenv/config'` only resolved `.env` from `process.cwd()` (ignoring `apps/orchestrator/.env` when run from monorepo root), and users had no in-app UI fields to test or supply API keys.
   - *Steering Decision:* Replaced the blacklist sanitizer with a strict whitelist [`sanitizeSchemaForGemini`](apps/orchestrator/src/agent/llmAgent.ts), added multi-path `.env` loading in `apps/orchestrator/src/index.ts`, added `/api/llm/test` live validation, and built a collapsible **API Keys & Provider Config** section in the Expo **Pengaturan** tab with `AsyncStorage` persistence and per-provider test buttons.

5. **Gemini `gemini-3.8-flash` Migration, Latency Optimization & Resilient Fallback:**
   - *Observation:* `gemini-2.5-flash` returned HTTP 404 (`no longer available to new users`), while default `gemini-3.8-flash` deep thinking caused >60s response times, and transient `503 UNAVAILABLE` / offline `Ollama` surfaced raw JSON errors to the chat UI.
   - *Steering Decision:* Upgraded default Gemini model to `gemini-3.8-flash` with `thinkingConfig: { thinkingLevel: 'LOW' }` and compact vehicle tool summaries (`compactResultForLlm`), added an elapsed timer + `AbortController` cancel button in the chat UI, and added automatic graceful fallback (`formatFallbackNote`) in `orchestrator.ts` to `runDirectMcpRouter` so users always receive working vehicle/weather/booking results.

6. **Human-First UI/UX Simplification & Bahasa Indonesia Localization:**
   - *Observation:* Candidate review of the live web UI highlighted stretched desktop cards, raw `**` markdown asterisks, expanded developer JSON trace clutter above answers, a plural `\bsuv\b` regex bug recommending scooters during 69% rain risk, and overly technical English UI copy.
   - *Steering Decision:* Built [`WeatherCard.tsx`](apps/mobile/components/WeatherCard.tsx) and [`FormattedText.tsx`](apps/mobile/components/FormattedText.tsx), collapsed [`McpTraceCard.tsx`](apps/mobile/components/McpTraceCard.tsx) by default below replies, constrained layouts to centered `maxWidth: 720`, localized all 4 Expo tabs (`Chat`, `Armada`, `Pesanan`, `Pengaturan`) and [`README.md`](README.md) into natural Indonesian, and updated [`directRouter.ts`](apps/orchestrator/src/agent/directRouter.ts) so `"SUVs or scooters"` prioritizes `SUV` when `isRainRisk` is true and `"saya mau rental mobil"` filters cars accurately without misreading `"mau"` as a guest name.

---

## Verifiable Test & Build Artifacts
- `apps/orchestrator/src/test/mcp-flow.test.ts` — End-to-end integration test verifying real stdio connections to MCP A, MCP B (SQLite), and MCP C (`@modelcontextprotocol/server-memory`), cross-MCP booking creation, modification, restart persistence, and cancellation.
- **Full Antigravity Conversation Transcript:** Available in the host Antigravity session brain folder under `.system_generated/logs/transcript.jsonl` for candidate verification/export upon submission.

