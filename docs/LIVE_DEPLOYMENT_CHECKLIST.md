# Sentinel 2.0 — Live Deployment Checklist

> **Target Architecture:** Frontend (Vercel) | Backend (Render) | Database (Supabase) | AI (Google Gemini API)  
> **Status:** Ready for manual deployment. All 143 automated regression tests passing.

---

## Pre-Deployment Requirements

Ensure you have active accounts for:
- [Supabase](https://supabase.com)
- [Render](https://render.com)
- [Vercel](https://vercel.com)
- [Google AI Studio](https://aistudio.google.com) (for `GEMINI_API_KEY`)

---

## 1. Supabase Setup

- [ ] Create a new project in Supabase (e.g. `sentinel-prod`).
- [ ] Open the **SQL Editor** in the Supabase Dashboard.
- [ ] Execute `backend/src/database/migrations/001_phase2_schema.sql` (Creates `agents`, `sessions`, `action_events`, `audit_logs`, indexes, and RLS policies).
- [ ] Execute `backend/src/database/migrations/002_phase4_schema.sql` (Creates `interventions`, `human_decisions`, `counterfactuals`, and indexes).
- [ ] Verify all 7 tables exist under **Table Editor**:
  - `agents`
  - `sessions`
  - `action_events`
  - `audit_logs`
  - `interventions`
  - `human_decisions`
  - `counterfactuals`
- [ ] In **Project Settings** → **API**, copy:
  - **Project URL** (`https://<project-ref>.supabase.co`)
  - **service_role secret key** (`eyJ...` — NEVER share or expose this key).

---

## 2. Render Backend Deployment

- [ ] Log in to [Render Dashboard](https://dashboard.render.com).
- [ ] Click **New +** → **Web Service** and connect the `sentinal` GitHub repository.
- [ ] Configure the Web Service:
  - **Name:** `sentinel-api`
  - **Environment:** `Node`
  - **Region:** Close to your Supabase region
  - **Branch:** `master` (or deployment branch)
  - **Root Directory:** *(leave blank — repository root)*
  - **Build Command:** `npm ci && npm run build:shared && npm run build:backend`
  - **Start Command:** `node backend/dist/server.js`
  - **Health Check Path:** `/api/health`
  - **Plan:** Free or Starter

---

## 3. Render Environment Variables

In Render Web Service → **Environment**, add the following server-only variables:

| Variable | Recommended Production Value | Notes |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables production error sanitizer (no stack traces) |
| `STORAGE_DRIVER` | `supabase` | Enables Supabase PostgreSQL persistence |
| `SUPABASE_URL` | `https://<ref>.supabase.co` | Copied from Supabase Project Settings |
| `SUPABASE_SERVICE_ROLE_KEY` | `<service_role_key>` | Secret key with full database access |
| `GEMINI_API_KEY` | `<your_gemini_api_key>` | Google AI Studio API key |
| `GEMINI_MODEL` | `gemini-1.5-flash` | Production model |
| `DEMO_MODE` | `false` | Set `true` if falling back to deterministic mock agent |
| `CORS_ORIGIN` | `http://localhost:5173` | Temporary until Vercel URL is known (Step 7) |
| `SPAM_RATE_LIMIT_WINDOW_MS` | `60000` | 1 minute rate limit window |
| `SPAM_RATE_LIMIT_MAX_REQUESTS` | `100` | Max requests per agent/session |
| `SPAM_BURST_WINDOW_MS` | `5000` | 5 second burst detection window |
| `SPAM_BURST_MAX_REQUESTS` | `15` | Burst threshold |
| `SPAM_DUPLICATE_WINDOW_MS` | `30000` | 30 second duplicate fingerprint window |

*Click **Save Changes** and allow the service to deploy.*

---

## 4. Backend Health Verification

- [ ] Obtain the Render URL: `https://<service-name>.onrender.com`.
- [ ] Verify the health endpoint using `curl`:
  ```bash
  curl -i https://<service-name>.onrender.com/api/health
  ```
- [ ] Confirm:
  - HTTP Status: `200 OK`
  - Body: `{"status":"ok","service":"sentinel-api",...}`
  - No database error warnings.

---

## 5. Vercel Frontend Deployment

- [ ] Log in to [Vercel](https://vercel.com/new).
- [ ] Import the `sentinal` GitHub repository.
- [ ] Set **Framework Preset:** `Vite`.
- [ ] Set **Root Directory:** `frontend`.
- [ ] Set **Build Command:** `npm run build` (or leave default Vite detection).
- [ ] Set **Output Directory:** `dist`.

---

## 6. VITE_API_URL Configuration

- [ ] In Vercel Project Setup → **Environment Variables**, add:
  - **Key:** `VITE_API_URL`
  - **Value:** `https://<service-name>.onrender.com/api`
- [ ] **SECURITY CHECK:** Confirm that `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `JWT_SECRET` are **NOT** added to Vercel.
- [ ] Click **Deploy**.
- [ ] Note the production Vercel URL (e.g. `https://sentinel-frontend.vercel.app`).

---

## 7. CORS Update on Render

- [ ] Return to **Render Dashboard** → `sentinel-api` → **Environment**.
- [ ] Update `CORS_ORIGIN`:
  - **Value:** `https://sentinel-frontend.vercel.app` *(or comma-separated `https://sentinel-frontend.vercel.app,http://localhost:5173`)*
- [ ] Click **Save Changes** to trigger an automatic redeploy with the updated CORS policy.

---

## 8. Gemini API Configuration

- [ ] Verify live agent connection by curling the diagnostics route:
  ```bash
  curl -i https://<service-name>.onrender.com/api/v1/system/agent-connection
  ```
- [ ] Confirm response indicates valid provider status (`live` or fallback mode without errors).

---

## 9. Live Frontend Test

- [ ] Open `https://sentinel-frontend.vercel.app` in a browser.
- [ ] Verify dashboard renders without CORS errors or unhandled JavaScript exceptions in Developer Console.
- [ ] Confirm tabs are accessible: **Live Agent**, **Audit Trail**, **Counterfactuals**.
- [ ] Confirm Abuse Guard status badge displays `NORMAL` and request rate is 0/100.

---

## 10. Live Gemini Scenario Test

- [ ] Run the external agent script pointing to the live Render deployment:
  ```bash
  SENTINEL_GATEWAY_URL=https://<service-name>.onrender.com/api/v1 npx tsx scripts/gemini-agent.ts
  ```
- [ ] Verify Step 1 (`project/docs`) and Step 2 (`project/source`) complete with `ALLOW`.
- [ ] Verify Step 3 (`project/report`) transitions to `MONITOR`.

---

## 11. Live CONFIRM Test (Human-in-the-Loop)

- [ ] In Step 4 (`finance/data`), observe the Sentinel intervention gate:
  - Telemetry: Risk 58/100, `OPTIMAL_WINDOW`.
  - Sentinel Decision: `CONFIRM REQUIRED`.
- [ ] In the frontend dashboard or CLI prompt, click **"Approve Action"** (`ALLOW_ONCE`).
- [ ] Confirm session resumes cleanly and tool execution state updates to executed.
- [ ] In another test session, test the rejection branch: click **"Deny Action"** (`DENY`) and verify tool remains unexecuted.

---

## 12. Live BLOCK Test (Destructive Action Prevention)

- [ ] In Step 7, agent attempts `DELETE production/resource` (`delete_customer`).
- [ ] Confirm Sentinel decision is `BLOCK`.
- [ ] Confirm the tool is strictly **NOT** executed.
- [ ] Confirm simulated customer `CUST-001` remains intact (`status: ACTIVE`).
- [ ] Confirm the agent session is immediately terminated.

---

## 13. Live Audit Trail Test

- [ ] Navigate to the **Audit Trail** tab on the live frontend.
- [ ] Verify audit log entries exist for:
  - `AGENT_REGISTERED`
  - `SESSION_STARTED`
  - `ACTION_INGESTED`
  - `INTERVENTION_TRIGGERED`
  - `HUMAN_DECISION_RECORDED`
  - `TOOL_EXECUTION_BLOCKED`
- [ ] Verify `preventionProof` is recorded on the blocked destructive event.

---

## 14. Abuse Guard Test

- [ ] Submit rapid consecutive requests to verify rate-limiting and burst detection:
  ```bash
  # Rapid requests test
  for i in {1..20}; do curl -s -X POST https://<service-name>.onrender.com/api/v1/tools/execute ... ; done
  ```
- [ ] Verify:
  - **Burst Detection:** `burstDetected = true` recorded in audit telemetry.
  - **Duplicate Detection:** `duplicateDetected = true` recorded when identical action payload is replayed.
  - **Rate Limit Trigger:** HTTP 429 `RATE_LIMIT_EXCEEDED` returned if limit is exceeded, strictly stopping tool execution.
