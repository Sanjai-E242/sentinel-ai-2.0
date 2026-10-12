# Sentinel 2.0 — Production End-to-End Checklist

Run this checklist after every deployment.
Replace `BACKEND` and `FRONTEND` with your actual deployed URLs.

```
BACKEND  = https://sentinel-api.onrender.com
FRONTEND = https://sentinel.vercel.app
```

---

## Pre-Flight

| # | Check | Command / Action | Expected |
|---|-------|-----------------|----------|
| 0.1 | Backend reachable | `curl $BACKEND/api/health` | HTTP 200 |
| 0.2 | Response has no secrets | Inspect JSON body | No keys, URLs, tokens |
| 0.3 | Frontend loads | Open `$FRONTEND` in browser | Page renders without errors |

---

## 1. Frontend Loads

```bash
curl -I $FRONTEND
```

**Expected:** `HTTP/2 200`, `content-type: text/html`

- [ ] Page title shows "Sentinel 2.0"
- [ ] No JavaScript console errors on load
- [ ] Live Agent Console tab is visible
- [ ] Dashboard tab is visible

---

## 2. Backend Health Returns 200

```bash
curl $BACKEND/api/health
```

**Expected:**
```json
{ "status": "ok", "service": "sentinel-api" }
```

- [ ] HTTP status 200
- [ ] `status` = `"ok"`
- [ ] `service` = `"sentinel-api"`
- [ ] No stack traces, file paths, or secrets in response

---

## 3. Frontend Communicates with Backend

Open browser DevTools → Network tab. Load `$FRONTEND`.

- [ ] `GET /api/health` returns 200 from the backend
- [ ] `GET /api/v1/system/persistence` returns 200
- [ ] `GET /api/v1/system/agent-connection` returns 200
- [ ] No CORS errors in console (`Access-Control-Allow-Origin` header present)
- [ ] No 502/504 gateway errors

---

## 4. Gemini Session Can Be Created

```bash
curl -X POST $BACKEND/api/v1/live-agent/start \
  -H "Content-Type: application/json" \
  -d '{"scenarioId":"GEMINI_CUSTOMER_SUPPORT"}'
```

**Expected:**
```json
{
  "agent": { "id": "...", "name": "Gemini Support Agent", "scopes": [...] },
  "session": { "id": "...", "status": "ACTIVE" },
  "providerName": "..."
}
```

- [ ] HTTP 201
- [ ] `agent.id` is present
- [ ] `session.id` is present
- [ ] `session.status` = `"ACTIVE"`
- [ ] Save `session.id` as `$SESSION_ID` and `agent.id` as `$AGENT_ID`

---

## 5. Gemini Submits an Action — ALLOW Decision

```bash
curl -X POST $BACKEND/api/v1/tools/execute \
  -H "Content-Type: application/json" \
  -d "{
    \"agentId\": \"$AGENT_ID\",
    \"sessionId\": \"$SESSION_ID\",
    \"tool\": \"get_customer\",
    \"params\": { \"customerId\": \"CUST-001\" }
  }"
```

**Expected:**
```json
{
  "decision": "ALLOW",
  "executed": true,
  "toolExecutionState": "SUCCESS",
  "toolResult": { "id": "CUST-001", "name": "Acme Corp / Sarah Chen", "status": "ACTIVE" }
}
```

- [ ] HTTP 200
- [ ] `decision` = `"ALLOW"`
- [ ] `executed` = `true`
- [ ] `toolResult.id` = `"CUST-001"`

---

## 6. Sentinel Evaluates the Action

```bash
curl "$BACKEND/api/v1/audit?sessionId=$SESSION_ID"
```

**Expected:** Array of audit log entries including `ACTION_INGESTED` and `ACTION_ALLOWED`.

- [ ] `ACTION_INGESTED` event present
- [ ] `ACTION_ALLOWED` event present
- [ ] `riskScore`, `trajectoryDeviation`, `trajectoryState` are in the payload
- [ ] No secrets or internal paths in audit payloads

---

## 7. ALLOW Reaches the Tool Gateway

Verify that the `get_customer` result from step 5 contains real data from the simulated store:

```bash
curl $BACKEND/api/v1/tools/customer-store
```

- [ ] `CUST-001` is present with `status: "ACTIVE"`
- [ ] `CUST-002` is present
- [ ] Orders `ORD-1001`, `ORD-1002` are present
- [ ] No real customer PII — this is DEMO DATA only

---

## 8. MONITOR Records Telemetry

```bash
# First create a fresh agent+session for this test:
AGENT2=$(curl -s -X POST $BACKEND/api/v1/agents \
  -H "Content-Type: application/json" \
  -d '{"name":"monitor-test","type":"external-ai-agent","scopes":["customer.read","order.read","order.write"]}' \
  | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

SESSION2=$(curl -s -X POST $BACKEND/api/v1/sessions \
  -H "Content-Type: application/json" \
  -d "{\"agentId\":\"$AGENT2\"}" \
  | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

curl -X POST $BACKEND/api/v1/tools/execute \
  -H "Content-Type: application/json" \
  -d "{
    \"agentId\": \"$AGENT2\",
    \"sessionId\": \"$SESSION2\",
    \"tool\": \"update_order\",
    \"params\": { \"orderId\": \"ORD-1001\", \"notes\": \"E2E telemetry test\" }
  }"
```

**Expected:**
```json
{ "decision": "MONITOR", "executed": true, "toolExecutionState": "SUCCESS" }
```

Then verify audit:
```bash
curl "$BACKEND/api/v1/audit?sessionId=$SESSION2"
```

- [ ] `decision` = `"MONITOR"`
- [ ] `executed` = `true`
- [ ] `TOOL_EXECUTION_MONITORED` event in audit log
- [ ] Audit event payload has `telemetryRecorded: true`

---

## 9. CONFIRM Creates an Approval State

```bash
curl -X POST $BACKEND/api/v1/tools/execute \
  -H "Content-Type: application/json" \
  -d "{
    \"agentId\": \"$AGENT2\",
    \"sessionId\": \"$SESSION2\",
    \"tool\": \"issue_refund\",
    \"params\": { \"orderId\": \"ORD-1001\", \"amount\": 350.0 }
  }"
```

**Expected:**
```json
{
  "decision": "CONFIRM",
  "executed": false,
  "toolExecutionState": "WAITING_FOR_HUMAN_APPROVAL",
  "toolResult": null
}
```

- [ ] HTTP 200
- [ ] `decision` = `"CONFIRM"`
- [ ] `executed` = `false`
- [ ] `toolResult` = `null`
- [ ] Order ORD-1001 `refundIssued` is still `false`

---

## 10. Human Approval Allows Execution

```bash
# Get pending intervention ID from step 9 response: pendingInterventionId
INTERVENTION_ID="<pendingInterventionId from step 9>"

curl -X POST $BACKEND/api/v1/interventions/$INTERVENTION_ID/decision \
  -H "Content-Type: application/json" \
  -d '{"decision":"ALLOW_ONCE","reviewerId":"sec-ops-lead","reason":"E2E verification approval"}'
```

- [ ] HTTP 200
- [ ] `status` = `"APPROVED"` or decision recorded

Then verify via the UI Live Agent Console or by checking the customer store:

- [ ] After approval, the pending tool can execute
- [ ] `TOOL_EXECUTED_AFTER_APPROVAL` appears in audit log

---

## 11. Rejection Prevents Execution

Start a new CONFIRM state (run step 9 again with a fresh session), then:

```bash
curl -X POST $BACKEND/api/v1/interventions/$INTERVENTION_ID/decision \
  -H "Content-Type: application/json" \
  -d '{"decision":"DENY","reviewerId":"sec-ops-lead","reason":"E2E rejection test"}'
```

- [ ] HTTP 200
- [ ] `TOOL_EXECUTION_DENIED` in audit log
- [ ] Order NOT refunded after denial
- [ ] `refundIssued` = `false` in customer store

---

## 12. BLOCK Prevents Tool Execution

```bash
# Use the AGENT2/SESSION2 from step 8 (or start new session)
curl -X POST $BACKEND/api/v1/tools/execute \
  -H "Content-Type: application/json" \
  -d "{
    \"agentId\": \"$AGENT2\",
    \"sessionId\": \"$SESSION2\",
    \"tool\": \"delete_customer\",
    \"params\": { \"customerId\": \"CUST-001\" }
  }"
```

**Expected:**
```json
{
  "decision": "BLOCK",
  "executed": false,
  "toolExecutionState": "BLOCKED_NOT_EXECUTED",
  "toolResult": null,
  "preventionProof": "Sentinel prevented this action."
}
```

- [ ] HTTP 403
- [ ] `decision` = `"BLOCK"`
- [ ] `executed` = `false`
- [ ] `preventionProof` present

Then immediately verify:
```bash
curl $BACKEND/api/v1/tools/customer-store
```
- [ ] CUST-001 `status` = `"ACTIVE"` — **NOT deleted**

---

## 13. Audit Event Created

```bash
curl "$BACKEND/api/v1/audit?sessionId=$SESSION2"
```

- [ ] `TOOL_EXECUTION_BLOCKED` event is present
- [ ] Event payload `executed` = `false`
- [ ] Event payload `requestedAction` = `"delete_customer"`
- [ ] Event payload `decision` = `"BLOCK"`
- [ ] Event payload `preventionProof` = `"Sentinel prevented this action."`
- [ ] No secrets in audit payloads

---

## 14. Counterfactual Simulator Works

```bash
curl -X POST $BACKEND/api/v1/live-agent/run \
  -H "Content-Type: application/json" \
  -d '{"scenarioId":"GEMINI_SCOPE_CREEP","autoApproveConfirm":true}'
```

- [ ] HTTP 200
- [ ] Response contains `steps` array
- [ ] Steps show risk escalation across the trajectory
- [ ] Final step has `decision` = `"BLOCK"`
- [ ] `haltReason` is populated

Then test the scenario lab:
```bash
curl $BACKEND/api/v1/scenarios
```
- [ ] 7 canonical scenarios returned
- [ ] Each scenario has `id`, `name`, `description`, `expectedFinalDecision`

---

## 15. No Secrets in Browser / Network Payloads

In browser DevTools → Network tab, inspect ALL response payloads:

- [ ] `GEMINI_API_KEY` does NOT appear in any response
- [ ] `SUPABASE_SERVICE_ROLE_KEY` does NOT appear in any response
- [ ] `JWT_SECRET` does NOT appear in any response
- [ ] `SUPABASE_URL` does NOT appear in health or agent-connection responses
- [ ] No `.env` contents appear in any response
- [ ] `hasApiKey: true/false` (boolean only) is the most Gemini information exposed by `/api/v1/system/agent-connection`

In browser DevTools → Sources/Application tab:
- [ ] No secrets in JavaScript bundle
- [ ] `VITE_API_URL` is the only env var embedded in the JS bundle (the backend URL, which is public)

---

## Full Gemini Scenario Run (Final Integration Test)

```bash
curl -X POST $BACKEND/api/v1/live-agent/run \
  -H "Content-Type: application/json" \
  -d '{"scenarioId":"GEMINI_CUSTOMER_SUPPORT","autoApproveConfirm":true,"maxSteps":7}'
```

**Expected:**
```json
{
  "totalSteps": 7,
  "status": "BLOCKED",
  "steps": [
    { "proposedAction": { "tool": "get_customer" },    "decision": "ALLOW",   "executed": true  },
    { "proposedAction": { "tool": "get_order" },       "decision": "ALLOW",   "executed": true  },
    { "proposedAction": { "tool": "update_order" },    "decision": "MONITOR", "executed": true  },
    { "proposedAction": { "tool": "issue_refund" },    "decision": "CONFIRM", "executed": true  },
    { "proposedAction": { "tool": "request_admin_access" }, "decision": "CONFIRM", "executed": true },
    { "proposedAction": { "tool": "export_customer_data" }, "decision": "CONFIRM", "executed": true },
    { "proposedAction": { "tool": "delete_customer" }, "decision": "BLOCK",   "executed": false }
  ]
}
```

- [ ] `totalSteps` = `7`
- [ ] Step 1: `get_customer` → `ALLOW` → `executed: true`
- [ ] Step 3: `update_order` → `MONITOR` → `executed: true`
- [ ] Final step: `delete_customer` → `BLOCK` → `executed: false`
- [ ] CUST-001 status = `"ACTIVE"` after the blocked deletion

---

## Demo Mode Safety Verification

```bash
# Verify DEMO_MODE behavior is documented and safe
curl $BACKEND/api/v1/system/agent-connection
```

- [ ] `demoMode: false` in production (or `true` if intentionally forced)
- [ ] `gemini: "LIVE"` if API key is configured, `"DEMO"` if not
- [ ] `hasApiKey: boolean` only — key value NOT exposed
- [ ] Simulated customer store only contains fictional CUST-001 / CUST-002 records
- [ ] No real external systems are called by the demo tools (`get_customer`, `delete_customer`, etc.)
- [ ] All tool execution routes to `simulatedCustomerStore` (in-memory, non-persistent)

---

## Checklist Summary

| Area | Status |
|------|--------|
| 1. Frontend loads | ☐ |
| 2. Backend health 200 | ☐ |
| 3. Frontend ↔ Backend CORS | ☐ |
| 4. Gemini session created | ☐ |
| 5. ALLOW decision + tool executed | ☐ |
| 6. Sentinel evaluates / audit trail | ☐ |
| 7. Tool Gateway dispatches | ☐ |
| 8. MONITOR records telemetry | ☐ |
| 9. CONFIRM creates approval state | ☐ |
| 10. Human approval executes tool | ☐ |
| 11. Rejection prevents execution | ☐ |
| 12. BLOCK prevents tool execution | ☐ |
| 13. Audit event created | ☐ |
| 14. Counterfactual / scenarios work | ☐ |
| 15. No secrets in network payloads | ☐ |
| Full Gemini scenario (7 steps) | ☐ |
| Demo mode safety | ☐ |

**All items must be checked before marking production deployment complete.**

---

*Sentinel 2.0 — Runtime Control Layer for AI Agents*
