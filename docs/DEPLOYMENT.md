# Sentinel 2.0 — Deployment Guide

> **Status:** Production-ready. All 131 automated tests passing. Production builds verified.

---

## Deployment Sequence

```
STEP 1  Configure Supabase — run SQL migrations, copy URL + service role key
STEP 2  Push the repository and create both services from the Render Blueprint
STEP 3  Set backend secrets and verify the API and frontend service URLs
STEP 4  Verify backend health — https://<render-url>/api/health
STEP 5  Verify Gemini API configuration — check /api/v1/system/agent-connection
STEP 6  Run the complete production E2E checklist (docs/PRODUCTION_E2E_CHECKLIST.md)
```

## Deploy Both Services on Render

The root `render.yaml` defines both the API web service and the frontend static site. To deploy both from Render:

1. Push this repository to a Git provider supported by Render.
2. In the Render Dashboard, select **New** → **Blueprint**, connect the repository, and select its deployment branch.
3. Review the two services (`sentinel-api` and `sentinel-frontend`) and apply the Blueprint.
4. In each service's **Settings**, copy its assigned `onrender.com` URL. If Render added a suffix, update `VITE_API_URL` on `sentinel-frontend` to `https://<API-URL>/api` and `CORS_ORIGIN` on `sentinel-api` to the frontend's `https://<FRONTEND-URL>`, then redeploy both services.
5. Set the backend secrets and storage configuration described below. Never put backend secrets on the static frontend service.
6. Verify `https://<API-URL>/api/health`, then open the frontend URL.

The Blueprint defaults assume the service URLs are `https://sentinel-api.onrender.com` and `https://sentinel-frontend.onrender.com`. Confirm the actual URLs before relying on them. The API's CORS origin and the frontend's API URL must match the deployed service domains.

> **Gemini 503 note:** Google's free-tier Gemini API occasionally returns 503 (model overloaded) under spike load.
> Sentinel automatically falls back to the deterministic mock agent in this case — all security
> decisions (ALLOW / MONITOR / CONFIRM / BLOCK) remain fully enforced. Set `DEMO_MODE=true` to
> always use the mock provider without hitting the API.

---

## Table of Contents

1. [Required Accounts & Services](#1-required-accounts--services)
2. [Environment Variables Reference](#2-environment-variables-reference)
3. [Frontend Deployment — Render](#3-frontend-deployment--render)
4. [Backend Deployment — Render](#4-backend-deployment--render)
5. [Supabase Configuration](#5-supabase-configuration)
6. [Gemini Configuration](#6-gemini-configuration)
7. [CORS Configuration](#7-cors-configuration)
8. [Health-Check Verification](#8-health-check-verification)
9. [End-to-End Verification](#9-end-to-end-verification)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Required Accounts & Services

| Service | Purpose | Free Tier |
|---------|---------|-----------|
| [Render](https://render.com) | Frontend hosting (static site) and backend hosting (Node.js/Express) | Yes (web service sleeps after inactivity) |
| [Supabase](https://supabase.com) | PostgreSQL database + RLS | Yes |
| [Google AI Studio](https://aistudio.google.com) | Gemini API key | Yes (rate-limited) |

> **Note:** Render's free tier sleeps after 15 min of inactivity. For always-on production, use Render Starter ($7/mo) or Railway.

---

## 2. Environment Variables Reference

### Backend Variables — SERVER-ONLY (never expose to browser)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `4000` | HTTP server port (Render sets this automatically) |
| `NODE_ENV` | Yes | `development` | Set to `production` for deployment |
| `CORS_ORIGIN` | Yes | `http://localhost:5173` | Deployed frontend URL |
| `STORAGE_DRIVER` | No | `local` | `supabase` / `local` / `memory` |
| `SUPABASE_URL` | For Supabase | — | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | For Supabase | — | Service role key (full DB access) |
| `GEMINI_API_KEY` | For live AI | — | Google Gemini API key |
| `GEMINI_MODEL` | No | `gemini-1.5-flash` | Model name |
| `DEMO_MODE` | No | `false` | `true` forces deterministic mock agent |
| `JWT_SECRET` | No | — | Reserved for future auth middleware |
| `SPAM_RATE_LIMIT_WINDOW_MS` | No | `60000` | Rate limit sliding window (ms) |
| `SPAM_RATE_LIMIT_MAX_REQUESTS` | No | `100` | Max requests per agent/session per window |
| `SPAM_BURST_WINDOW_MS` | No | `5000` | Burst detection window (ms) |
| `SPAM_BURST_MAX_REQUESTS` | No | `15` | Max requests within burst window |
| `SPAM_DUPLICATE_WINDOW_MS` | No | `30000` | Duplicate action replay detection window (ms) |

### Frontend Variables — PUBLIC (VITE_ prefix, safe for browser bundle)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | No | `/api` | Backend API base URL |

> **Security invariant:** `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `JWT_SECRET`
> are NEVER prefixed with `VITE_` and are NEVER present in the frontend source or bundle.

---

## 3. Frontend Deployment — Render

### Build command
```
npm run build --workspace=@sentinel/frontend
```
Output directory: `frontend/dist/`

### Steps (Render Dashboard)

The root `render.yaml` Blueprint creates this static site alongside the backend. Use **New** → **Blueprint** to create both services together. The frontend build settings are:

- **Root Directory:** repository root
- **Build Command:** `npm ci --include=dev && npm run build:shared && npm run build:frontend`
- **Publish Directory:** `frontend/dist`
- **Environment variable:** `VITE_API_URL` = `https://<your-api-service>.onrender.com/api`

Confirm the actual service URLs in Render. If they differ from the Blueprint defaults, update `VITE_API_URL` and the backend's `CORS_ORIGIN`, then redeploy both services.

### SPA fallback (in `render.yaml`)

The Render static-site rewrite sends client-side routes to `/index.html`.

This ensures React Router handles all client-side routes.

---

## 4. Backend Deployment — Render

### Build & Start Commands (Monorepo Root)
```bash
# Build Command
npm ci --include=dev && npm run build:shared && npm run build:backend

# Start Command
node backend/dist/server.js
```

### Steps (Render Dashboard)

1. Go to [dashboard.render.com/new/web](https://dashboard.render.com/new/web)
2. Connect your GitHub repository
3. Configure the service:
   - **Name:** `sentinel-api`
   - **Root Directory:** *(leave blank — repository root)*
  - **Build Command:** `npm ci --include=dev && npm run build:shared && npm run build:backend`
   - **Start Command:** `node backend/dist/server.js`
   - **Node Version:** `20.x` or later
   - **Health Check Path:** `/api/health`
4. Add all backend environment variables (Section 2)
5. Deploy

### render.yaml (Infrastructure as Code — located at repo root)

```yaml
services:
  - type: web
    name: sentinel-api
    runtime: node
    buildCommand: npm ci --include=dev && npm run build:shared && npm run build:backend
    startCommand: node backend/dist/server.js
    healthCheckPath: /api/health
    autoDeploy: false
    envVars:
      - key: NODE_ENV
        value: production
      - key: STORAGE_DRIVER
        value: supabase
      - key: GEMINI_MODEL
        value: gemini-1.5-flash
      - key: DEMO_MODE
        value: "false"
```

---

## 5. Supabase Configuration

### Create Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → New Project
2. Choose a region close to your backend server
3. Save the database password securely

### Run Migrations

Apply schema migrations in order using the Supabase SQL Editor:

**Migration 1:** `backend/src/database/migrations/001_phase2_schema.sql`
**Migration 2:** `backend/src/database/migrations/002_phase4_schema.sql`

### Database Schema

| Table | Purpose |
|-------|---------|
| `agents` | Registered AI agent registry |
| `sessions` | Governed agent sessions with risk telemetry |
| `action_events` | Immutable action ingestion log |
| `audit_logs` | Append-only security audit trail |
| `interventions` | Intervention intelligence queue |
| `human_decisions` | Operator review decisions |
| `counterfactuals` | Counterfactual timing analyses |

### Row Level Security

All tables have RLS enabled. The service role key bypasses RLS and is used exclusively
by the backend. The anon key is NOT used and should NOT be configured.

### Environment Variables

From your Supabase project Settings → API:

- `SUPABASE_URL` → Project URL (e.g. `https://abcdefgh.supabase.co`)
- `SUPABASE_SERVICE_ROLE_KEY` → Service role secret key

> WARNING: The service role key has full database access.
> It MUST remain server-side only. Never expose it to the browser.

### Demo Data Notice

The `simulatedCustomerStore` (`backend/src/modules/tools/customer-store.ts`) is
**DEMO DATA ONLY**:

- NOT persisted to Supabase or any database
- Resets on every server restart
- Contains fictional records (CUST-001, CUST-002) for demonstration only
- NOT production customer data

---

## 6. Gemini Configuration

1. Go to [aistudio.google.com](https://aistudio.google.com) → Get API key
2. Create an API key for your project
3. Set `GEMINI_API_KEY` in the backend environment (server-only)
4. Set `GEMINI_MODEL=gemini-1.5-flash`

### Fallback Behavior

If `GEMINI_API_KEY` is not set or `DEMO_MODE=true`, Sentinel automatically falls back
to the deterministic mock agent. All security guarantees (authorization, trajectory,
intervention, blocking) remain active regardless of which provider is active.

### Security Guarantee

Gemini CANNOT directly execute protected tools. The flow is strictly:

```
Gemini
  ↓
Sentinel REST API
  ↓
Authentication (agentId + sessionId validation)
  ↓
Authorization (scope check)
  ↓
Trajectory Analysis
  ↓
Risk Engine
  ↓
Intervention Intelligence
  ↓
Decision Engine (ALLOW / MONITOR / WARN / CONFIRM / BLOCK)
  ↓
Tool Gateway (execution gate)
  ↓
Simulated Customer Tool (only if ALLOW/MONITOR/WARN)
```

BLOCK → tool execution = false (strictly enforced, never bypassed)
CONFIRM → tool held, not executed until human ALLOW_ONCE

---

## 7. CORS Configuration

CORS is environment-driven via the `CORS_ORIGIN` variable in `backend/src/app.ts`:

```typescript
app.use(cors({
  origin: config.corsOrigin,  // read from CORS_ORIGIN env var
  credentials: true
}));
```

### Configuration by Environment

| Environment | CORS_ORIGIN value |
|-------------|-------------------|
| Local development | `http://localhost:5173` |
| Production | `https://your-app.vercel.app` |

Do NOT use wildcard `*` CORS in production for security-sensitive APIs.

---

## 8. Health-Check Verification

```
GET /api/health
```

Response (always safe, no secrets, no DB query):
```json
{
  "status": "ok",
  "service": "sentinel-api"
}
```

Configure this as the health check path in Render (`/api/health`).

Database connectivity (does not expose credentials):
```
GET /api/v1/system/persistence
```

---

## 9. End-to-End Verification

After deploying, verify the complete pipeline using curl:

### Step 1 — Health Check
```bash
curl https://your-backend.onrender.com/api/health
# Expected: {"status":"ok","service":"sentinel-api"}
```

### Step 2 — Register Agent
```bash
curl -X POST https://your-backend.onrender.com/api/v1/agents \
  -H "Content-Type: application/json" \
  -d '{"name":"test-agent","type":"external-ai-agent","scopes":["customer.read","order.read","order.write"]}'
# Save the agentId from the response
```

### Step 3 — Create Session
```bash
curl -X POST https://your-backend.onrender.com/api/v1/sessions \
  -H "Content-Type: application/json" \
  -d '{"agentId":"<agentId>"}'
# Save the sessionId from the response
```

### Step 4 — Authorized Action (expect ALLOW)
```bash
curl -X POST https://your-backend.onrender.com/api/v1/tools/execute \
  -H "Content-Type: application/json" \
  -d '{"agentId":"<agentId>","sessionId":"<sessionId>","tool":"get_customer","params":{"customerId":"CUST-001"}}'
# Expected: {"decision":"ALLOW","executed":true,"toolExecutionState":"SUCCESS"}
```

### Step 5 — Blocked Action (expect BLOCK, not executed)
```bash
curl -X POST https://your-backend.onrender.com/api/v1/tools/execute \
  -H "Content-Type: application/json" \
  -d '{"agentId":"<agentId>","sessionId":"<sessionId>","tool":"delete_customer","params":{"customerId":"CUST-001"}}'
# Expected: {"decision":"BLOCK","executed":false,"toolExecutionState":"BLOCKED_NOT_EXECUTED"}
```

### Step 6 — Verify Customer Not Deleted
```bash
curl https://your-backend.onrender.com/api/v1/tools/customer-store
# Verify: CUST-001 status = "ACTIVE" (not deleted)
```

### Step 7 — Full Gemini Demo
```bash
curl -X POST https://your-backend.onrender.com/api/v1/live-agent/run \
  -H "Content-Type: application/json" \
  -d '{"scenarioId":"GEMINI_CUSTOMER_SUPPORT","autoApproveConfirm":true}'
# Expected: 7 steps, final step = delete_customer with decision=BLOCK, executed=false
```

### Step 8 — Scenarios Available
```bash
curl https://your-backend.onrender.com/api/v1/scenarios
# Expected: 7 canonical scenario definitions
```

---

## 10. Troubleshooting

### Backend won't start

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Cannot find module` errors | Missing build output | Run `npm run build` in `backend/` |
| Port conflict | Port in use | Change `PORT` env var |
| Supabase errors at startup | Missing/invalid credentials | Set `STORAGE_DRIVER=local` as fallback |

### CORS errors in browser

| Symptom | Fix |
|---------|-----|
| `Access-Control-Allow-Origin` missing | Set `CORS_ORIGIN` to exact frontend URL (no trailing slash) |
| Works locally, fails in production | Ensure `CORS_ORIGIN` is the Vercel URL, not localhost |

### Gemini not responding

| Symptom | Fix |
|---------|-----|
| Mock provider running instead of Gemini | Set `GEMINI_API_KEY` and `DEMO_MODE=false` |
| Rate limit / quota errors | Use `DEMO_MODE=true` for demos |
| Model not found | Use `GEMINI_MODEL=gemini-1.5-flash` |

### Database issues

| Symptom | Fix |
|---------|-----|
| 503 Database Unavailable | Normal without Supabase config; use `STORAGE_DRIVER=local` |
| RLS policy rejection | Verify `SUPABASE_SERVICE_ROLE_KEY` is set (not anon key) |
| Tables don't exist | Run both SQL migrations in Supabase SQL Editor |

### Unexpected tool gateway decisions

The policy engine is deterministic. Decision depends on:
- Agent's registered `scopes` vs. action's required `scope`
- Action's `sensitivity` level (LOW/MEDIUM/HIGH/CRITICAL)
- Action's `reversibility` (REVERSIBLE/PARTIALLY_REVERSIBLE/IRREVERSIBLE)

Reference files:
- `backend/src/modules/tools/gateway.ts` — `mapToolToAction()`
- `backend/src/modules/decisions/policy.service.ts` — `evaluate()`

---

*Sentinel 2.0 — Runtime Control Layer for AI Agents*
*Apache-2.0 License*
