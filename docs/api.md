# Sentinel 2.0 — Phase 1 REST API Specification

This document details all Phase 1 endpoints implemented in Sentinel 2.0 for Agent Registration, Session Management, and Action Ingestion.

Base Gateway URL: `/api/v1`

---

## Standard Response Contracts

### Success Response
```json
{
  "data": { ... },
  "requestId": "req_8afc716d0978e3be"
}
```

### Error Response
```json
{
  "status": "error",
  "statusCode": 400,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable explanation of error",
    "details": { ... }
  },
  "requestId": "req_8afc716d0978e3be",
  "timestamp": "2026-09-25T08:39:15.000Z"
}
```

---

## 1. Agent Management

### 1.1 Register Agent
* **Endpoint**: `POST /api/v1/agents`
* **Content-Type**: `application/json`
* **Description**: Registers an external AI agent identity with its granted scopes.

#### Request Body
| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | Yes | Human-readable agent name |
| `type` | string | No | Agent category (default: `'external-ai-agent'`) |
| `scopes` | string[] | Yes | Array of granted permission scopes |
| `metadata` | object | No | Optional key-value metadata |

```json
{
  "name": "Research Agent",
  "type": "external-ai-agent",
  "scopes": [
    "project.read",
    "project.write"
  ]
}
```

#### Response (`201 Created`)
```json
{
  "data": {
    "agent": {
      "id": "research-agent-704e457b",
      "name": "Research Agent",
      "type": "external-ai-agent",
      "status": "ACTIVE",
      "scopes": [
        "project.read",
        "project.write"
      ],
      "createdAt": "2026-09-25T08:39:15.000Z"
    }
  },
  "agent": {
    "id": "research-agent-704e457b",
    "name": "Research Agent",
    "type": "external-ai-agent",
    "status": "ACTIVE",
    "scopes": [
      "project.read",
      "project.write"
    ],
    "createdAt": "2026-09-25T08:39:15.000Z"
  },
  "requestId": "req_445a03994f2e0ef2"
}
```

---

### 1.2 List Agents
* **Endpoint**: `GET /api/v1/agents`
* **Response (`200 OK`)**:
```json
{
  "data": {
    "agents": [ ... ]
  },
  "agents": [ ... ],
  "requestId": "req_123"
}
```

---

### 1.3 Get Agent by ID
* **Endpoint**: `GET /api/v1/agents/:id`
* **Response (`200 OK`)**:
```json
{
  "data": {
    "agent": {
      "id": "research-agent-704e457b",
      "name": "Research Agent",
      "status": "ACTIVE",
      ...
    }
  },
  "requestId": "req_123"
}
```

---

## 2. Session Management

### 2.1 Create Session
* **Endpoint**: `POST /api/v1/sessions`
* **Content-Type**: `application/json`
* **Description**: Starts an active work session for a registered agent. Rejects nonexistent or revoked agents.

#### Request Body
```json
{
  "agentId": "research-agent-704e457b"
}
```

#### Response (`201 Created`)
```json
{
  "data": {
    "session": {
      "id": "sess_bd57e3472052",
      "agentId": "research-agent-704e457b",
      "status": "ACTIVE",
      "startedAt": "2026-09-25T08:39:15.093Z",
      "currentRisk": 0,
      "trajectoryDeviation": 0
    }
  },
  "session": {
    "id": "sess_bd57e3472052",
    "agentId": "research-agent-704e457b",
    "status": "ACTIVE",
    "startedAt": "2026-09-25T08:39:15.093Z",
    "currentRisk": 0,
    "trajectoryDeviation": 0
  },
  "requestId": "req_96bbd32915ab4d74"
}
```

---

### 2.2 List Sessions
* **Endpoint**: `GET /api/v1/sessions`
* **Query Parameters**:
  * `agentId` *(optional)*: Filter sessions by agent ID.
* **Response (`200 OK`)**:
```json
{
  "data": {
    "sessions": [ ... ]
  },
  "sessions": [ ... ],
  "requestId": "req_123"
}
```

---

### 2.3 Get Session by ID
* **Endpoint**: `GET /api/v1/sessions/:id`
* **Response (`200 OK`)**:
```json
{
  "data": {
    "session": { ... }
  },
  "requestId": "req_123"
}
```

---

### 2.4 End Session
* **Endpoint**: `POST /api/v1/sessions/:id/end`
* **Description**: Concludes a session. Subsequent actions for this session will be rejected with `SESSION_ALREADY_COMPLETED`.
* **Response (`200 OK`)**:
```json
{
  "data": {
    "session": {
      "id": "sess_bd57e3472052",
      "status": "COMPLETED",
      "endedAt": "2026-09-25T08:39:15.147Z"
    }
  },
  "requestId": "req_7911e44039bb008d"
}
```

---

## 3. Action Ingestion & Policy Decisions

### 3.1 Ingest Action
* **Endpoint**: `POST /api/v1/actions`
* **Content-Type**: `application/json`
* **Description**: Ingests an action requested by an external AI agent, independently verifies authorization, and issues an instantaneous deterministic policy decision.

#### Request Body
| Field | Type | Required | Values / Description |
|---|---|---|---|
| `agentId` | string | Yes | ID of registered agent |
| `sessionId` | string | Yes | Active session ID |
| `action` | string | Yes | `READ`, `WRITE`, `UPDATE`, `DELETE`, `EXECUTE`, `EXPORT`, `DOWNLOAD`, `PRIVILEGE_ESCALATION`, `EXTERNAL_REQUEST` |
| `resource` | string | Yes | Target resource identifier (e.g. `project-documents`) |
| `resourceType` | string | No | Target classification (default: `'resource'`) |
| `scope` | string | Yes | The scope required by this action (e.g. `project.read`) |
| `sensitivity` | string | Yes | `low`, `medium`, `high`, `critical` |
| `reversibility` | string | Yes | `reversible`, `partially_reversible`, `irreversible` |
| `timestamp` | string | No | Optional ISO timestamp (defaults to server time) |
| `metadata` | object | No | Optional key-value telemetry |

```json
{
  "agentId": "research-agent-704e457b",
  "sessionId": "sess_bd57e3472052",
  "action": "READ",
  "resource": "project-documents",
  "resourceType": "document",
  "scope": "project.read",
  "sensitivity": "low",
  "reversibility": "reversible"
}
```

#### Response (`200 OK`)
```json
{
  "data": {
    "event": {
      "eventId": "evt_7d83ea5f9993351a",
      "agentId": "research-agent-704e457b",
      "sessionId": "sess_bd57e3472052",
      "timestamp": "2026-09-25T08:39:15.102Z",
      "action": "READ",
      "resource": "project-documents",
      "resourceType": "document",
      "scope": "project.read",
      "sensitivity": "LOW",
      "reversibility": "REVERSIBLE",
      "authorization": "AUTHORIZED",
      "metadata": {}
    },
    "decision": {
      "action": "ALLOW",
      "reason": [
        "Agent is active",
        "Requested scope is authorized",
        "Resource sensitivity is low",
        "Action is reversible"
      ]
    }
  },
  "event": { ... },
  "decision": { ... },
  "requestId": "req_8afc716d0978e3be"
}
```

---

## 4. Policy Decision Matrix (Phase 1 Deterministic Rules)

| Condition | Decision | Explanation |
|---|---|---|
| `AUTHORIZED` + `LOW` sensitivity + `REVERSIBLE` | `ALLOW` | Benign operation within granted scope envelope. |
| `AUTHORIZED` + `MEDIUM` sensitivity | `MONITOR` | Allowed with enhanced behavioral telemetry. |
| `AUTHORIZED` + `HIGH` / `CRITICAL` sensitivity | `WARN` | High-sensitivity target; risk acceleration flagged. |
| `UNAUTHORIZED` + `REVERSIBLE` | `CONFIRM` | Action paused; agent requests explicit human authorization. |
| `UNAUTHORIZED` + `IRREVERSIBLE` | `BLOCK` | Stopped to prevent unrecoverable state modification. |
| `UNAUTHORIZED` + `DELETE` | `BLOCK` | Destructive action blocked due to missing permissions. |
| `UNAUTHORIZED` + `PRIVILEGE_ESCALATION` | `BLOCK` | Unauthorized privilege escalation halted immediately. |

---

## 5. Trajectory Intelligence & Risk Telemetry (Phase 3)

### 5.1 Get Session Trajectory
* **Endpoint**: `GET /api/v1/sessions/:id/trajectory`
* **Description**: Returns detailed behavioral trajectory analysis, 10 normalized features, weighted deviation components, explanation text, and chronological action replay timeline.

#### Response (`200 OK`)
```json
{
  "sessionId": "sess_551ea40d8113",
  "agentId": "gemini-research-assistant",
  "actionCount": 5,
  "currentRisk": 100,
  "trajectoryDeviation": 87,
  "riskDelta": 51,
  "riskVelocity": "EXTREME",
  "riskAcceleration": "SURGING",
  "state": "CRITICAL",
  "features": {
    "resourceNovelty": 100,
    "scopeExpansion": 90,
    "sensitivityEscalation": 100,
    "actionTypeChange": 90,
    "authorizationFailures": 40,
    "actionVelocity": 42,
    "resourceDiversity": 36,
    "crossBoundaryAccess": 90,
    "destructiveActionPresence": 100,
    "sequenceDeviation": 70
  },
  "components": {
    "scopeExpansion": 18,
    "resourceNovelty": 15,
    "sequenceDeviation": 11,
    "sensitivityEscalation": 15,
    "crossBoundaryAccess": 14,
    "destructiveBehavior": 10,
    "authorizationFailures": 2,
    "velocityChange": 2
  },
  "actions": [
    {
      "eventId": "evt_5d8f8b60a1cb3d42",
      "timestamp": "2026-09-25T10:04:13.510Z",
      "action": "READ",
      "resource": "project-documents",
      "resourceType": "document",
      "risk": 12,
      "trajectoryDeviation": 16,
      "state": "NORMAL",
      "decision": "ALLOW",
      "reasons": ["accessing newly encountered resources outside the workflow"]
    }
  ],
  "explanation": {
    "simpleText": "Agent behavior is severely deviating from its expected task baseline.",
    "plainReasons": [
      "attempting to access sensitive or restricted system domains",
      "requesting permissions beyond the initial task baseline",
      "executing irreversible or destructive data modifications"
    ]
  },
  "requestId": "req_e05da5b9639d6484"
}
```

### 5.2 Get Session Risk Telemetry (Compact Polling)
* **Endpoint**: `GET /api/v1/sessions/:id/risk`
* **Description**: Returns lightweight risk telemetry for dashboard polling.

#### Response (`200 OK`)
```json
{
  "sessionId": "sess_551ea40d8113",
  "agentId": "gemini-research-assistant",
  "currentRisk": 100,
  "trajectoryDeviation": 87,
  "riskDelta": 51,
  "riskVelocity": "EXTREME",
  "riskAcceleration": "SURGING",
  "state": "CRITICAL",
  "actionCount": 5,
  "lastUpdated": "2026-09-25T10:04:13.593Z",
  "requestId": "req_d9c10f6aa7dc76dc"
}
```

---

## 6. Deterministic Behavioral Scenarios

### 6.1 List Scenarios
* **Endpoint**: `GET /api/v1/scenarios`
* **Description**: Returns all 7 deterministic behavioral test scenarios.

### 6.2 Execute Scenario
* **Endpoint**: `POST /api/v1/scenarios/:id/run`
* **Description**: Executes a scenario end-to-end and returns live step-by-step telemetry, trajectory, forecast, and counterfactual analysis.

Available Scenarios:
1. `NORMAL_RESEARCH`
2. `GRADUAL_SCOPE_CREEP`
3. `SENSITIVE_DATA_ACCESS`
4. `PRIVILEGE_ESCALATION`
5. `DESTRUCTIVE_SEQUENCE`
6. `LEGITIMATE_UNUSUAL_BEHAVIOR`
7. `RIGHT_MOMENT_TO_INTERVENE` (Phase 4 flagship demo scenario)

---

## 7. Intervention Intelligence & Human Review Endpoints

### 7.1 List Interventions / Pending Reviews
* **Endpoint**: `GET /api/v1/interventions`
* **Query Parameters**:
  * `status`: Optional filter (`PENDING` | `APPROVED` | `DENIED` | `EXPIRED`)
  * `sessionId`: Optional session filter
* **Description**: Lists recorded interventions and pending human review queue items.

### 7.2 Get Single Intervention
* **Endpoint**: `GET /api/v1/interventions/:id`
* **Description**: Retrieves full intervention record including action details, reasons, forecast, and counterfactual analysis.

### 7.3 Submit Human Review Decision
* **Endpoint**: `POST /api/v1/interventions/:id/decision`
* **Content-Type**: `application/json`
* **Payload**:
```json
{
  "decision": "ALLOW_ONCE",
  "reviewerId": "sec-analyst-1",
  "reason": "Legitimate maintenance window approved"
}
```
* **Supported Decisions**: `ALLOW_ONCE`, `DENY`, `REVOKE_SESSION`
* **Description**: Resolves a pending review alert and persists the decision into the audit trail.

### 7.4 Session Intervention Telemetry
* **Endpoint**: `GET /api/v1/sessions/:id/intervention`
* **Description**: Returns real-time intervention analysis, resolved window (`TOO_EARLY` | `OPTIMAL_WINDOW` | `TOO_LATE`), urgency, and recommendation for the specified session.

### 7.5 Session Risk Forecast
* **Endpoint**: `GET /api/v1/sessions/:id/forecast`
* **Description**: Returns 3-step projected trajectory risk horizon (+1, +2, +3 actions) and horizon classification.

### 7.6 Session Counterfactual Analysis
* **Endpoint**: `GET /api/v1/sessions/:id/counterfactual`
* **Description**: Evaluates trade-offs across `EARLY`, `RECOMMENDED`, and `LATE` intervention paths.

---

## 8. Health Check Endpoint
* **Endpoint**: `GET /api/health`
* **Response (`200 OK`)**:
```json
{
  "status": "ok",
  "service": "sentinel-api"
}
```
