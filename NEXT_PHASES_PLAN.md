# AgentLens Next Phases Plan — v2.0 Roadmap

> Strategic planning for AgentLens phases 3-6 (Package Publishing, Web Dashboard, Ecosystem Integration, and Database Persistence).
> This document outlines the implementation strategy for the next 6 months of development.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State](#current-state)
3. [Phase 3: Publishing & Distribution](#phase-3-publishing--distribution)
4. [Phase 4: Web Dashboard](#phase-4-web-dashboard)
5. [Phase 5: Ecosystem Integration](#phase-5-ecosystem-integration)
6. [Phase 6: Database Persistence](#phase-6-database-persistence)
7. [Success Metrics](#success-metrics)
8. [Risk Mitigation](#risk-mitigation)
9. [Timeline & Milestones](#timeline--milestones)

---

## Executive Summary

**AgentLens has successfully completed Phases 1-2:**
- ✅ TypeScript SDK (6 packages, 268 tests, production-ready)
- ✅ Python SDK (7 packages, 300+ tests, with LangChain integration)

**The next 4 phases focus on:**
1. **Phase 3: Publishing & Distribution** — Make packages installable via npm and PyPI
2. **Phase 4: Web Dashboard** — Visual interface for log analysis and monitoring
3. **Phase 5: Ecosystem Integration** — Expand framework support (LlamaIndex, AutoGPT, DSPy)
4. **Phase 6: Database Persistence** — Production storage backends (PostgreSQL, MongoDB, S3)

**Investment Required:** ~6 developer-months across all phases
**Expected Outcome:** Production-grade observability platform with ecosystem-wide reach
**Target Completion:** End of Q3 2025

---

## Current State

### What We Have (✅ Complete)

| Component | Status | Details |
|-----------|--------|---------|
| **TypeScript SDK** | ✅ Complete | 6 packages, 268 tests, npm-ready |
| **Python SDK** | ✅ Complete | 7 packages, 300+ tests, pip-ready |
| **CLI Tools** | ✅ Complete | init, trace, analyze (both TS & Python) |
| **Documentation** | ✅ Complete | README, PYTHON_SDK.md, ARLS_SPEC.md |
| **Examples** | ✅ Complete | Anthropic, OpenAI, tool-calling |
| **ARLS Schema** | ✅ Complete | v1.0, versioned, stable |

### What We Need (⏳ Next)

| Need | Priority | Phase |
|------|----------|-------|
| **npm/PyPI Publishing** | 🔴 CRITICAL | Phase 3 |
| **Web Dashboard** | 🔴 HIGH | Phase 4 |
| **LlamaIndex Integration** | 🟠 HIGH | Phase 5 |
| **Database Backends** | 🟠 MEDIUM | Phase 6 |
| **Rust SDK** | 🟡 MEDIUM | Future |
| **Go SDK** | 🟡 MEDIUM | Future |

---

## Phase 3: Publishing & Distribution

**Duration:** 1-2 weeks
**Goal:** Make AgentLens installable via npm and PyPI for real-world adoption
**Success:** 50+ downloads in first week post-launch

### 3.1 npm Publishing

#### 3.1.1 Pre-Publishing Checklist

- [ ] Update `packages/*/package.json` with correct versions (v1.0.0)
- [ ] Ensure `@agentlens/core` has zero runtime dependencies
- [ ] Run full test suite: `pnpm test` (expect 268 tests passing)
- [ ] Run TypeScript strict mode: `pnpm typecheck` (zero errors)
- [ ] Update CHANGELOG.md with features and breaking changes
- [ ] Create npm organization `@agentlens` (if not exists)
- [ ] Verify all examples run successfully
- [ ] Create GitHub release notes
- [ ] Set up npm authentication tokens in CI/CD

#### 3.1.2 Publishing Strategy

**Package Publishing Order:**

1. Publish core package first:
```bash
cd packages/core
npm publish --access public
# Creates @agentlens/core@1.0.0
```

2. Publish dependent packages in order:
```bash
npm publish packages/privacy
npm publish packages/renderer
npm publish packages/transport
npm publish packages/interceptors
npm publish packages/cli
```

3. Create meta-package for convenience:
```bash
npm publish packages/agentlens  # (if exists, or create one)
```

**Version Strategy:**
- Core: `@agentlens/core@1.0.0`
- All packages: `@agentlens/*@1.0.0` (synchronized versions)
- Tag releases: `git tag v1.0.0-npm` and `git push --tags`

#### 3.1.3 Post-Publishing

- [ ] Verify packages are visible on npm.com
- [ ] Test installation in fresh project:
  ```bash
  mkdir test-install && cd test-install
  npm init -y
  npm install @agentlens/core @agentlens/interceptors
  npx agentlens --version
  ```
- [ ] Create installation guide in README
- [ ] Update CDN/unpkg links if applicable
- [ ] Announce on Twitter, GitHub Discussions, HN (optional)

**Files to Update:**
- `packages/*/package.json` — version, keywords, homepage URLs
- `README.md` — add npm install instructions
- `CHANGELOG.md` — document v1.0.0 release

---

### 3.2 PyPI Publishing

#### 3.2.1 Pre-Publishing Checklist

- [ ] Update `python/*/pyproject.toml` with version 1.0.0
- [ ] Run full test suite: `poetry run pytest` (expect 300+ tests passing)
- [ ] Run type checking: `poetry run mypy --strict` (zero errors)
- [ ] Run coverage: `poetry run pytest --cov` (expect 80%+)
- [ ] Update CHANGELOG with Python features
- [ ] Build distributions: `poetry build` (for all packages)
- [ ] Verify `py.typed` markers in all packages
- [ ] Set up PyPI account and API tokens
- [ ] Test on test.pypi.org first

#### 3.2.2 Publishing Strategy

**Test PyPI First (Safe):**

```bash
cd python/agentlens-core
poetry config repositories.testpypi https://test.pypi.org/legacy/
poetry publish -r testpypi

# Test installation from test PyPI
pip install -i https://test.pypi.org/simple/ agentlens-core==1.0.0
```

**Production PyPI:**

```bash
# Publish in dependency order
poetry publish  # agentlens-core
cd ../agentlens-privacy && poetry publish
cd ../agentlens-renderer && poetry publish
cd ../agentlens-transport && poetry publish
cd ../agentlens-interceptors && poetry publish
cd ../agentlens-cli && poetry publish
cd ../agentlens && poetry publish  # Meta-package
```

**Version Strategy:**
- All packages: `1.0.0` (synchronized across all 7 packages)
- Tag releases: `git tag v1.0.0-pypi` and `git push --tags`

#### 3.2.3 Post-Publishing

- [ ] Verify packages on PyPI.org
- [ ] Test fresh installation:
  ```bash
  python -m venv test-env
  source test-env/bin/activate
  pip install agentlens
  agentlens --version
  python -c "from agentlens import AgentLens; print(AgentLens)"
  ```
- [ ] Create PyPI installation guide
- [ ] Update README with pip instructions
- [ ] Test with actual Anthropic/OpenAI APIs (optional)
- [ ] Announce on Twitter, Reddit r/Python, etc.

**Files to Update:**
- `python/*/pyproject.toml` — version, description, keywords
- `README.md` — add pip install instructions (already partially done)
- `CHANGELOG.md` — document v1.0.0-python

---

### 3.3 Documentation for Distribution

**Create new file: `docs/INSTALLATION.md`**

```markdown
# Installation Guide

## TypeScript / Node.js

### npm
\`\`\`bash
npm install @agentlens/core @agentlens/interceptors @agentlens/renderer
\`\`\`

### Or with all packages
\`\`\`bash
npm install @agentlens/*
\`\`\`

## Python 3.11+

### Basic
\`\`\`bash
pip install agentlens
\`\`\`

### With SDK Support
\`\`\`bash
pip install agentlens anthropic  # For Anthropic
pip install agentlens openai     # For OpenAI
pip install agentlens langchain  # For LangChain
\`\`\`

## Verification

### TypeScript
\`\`\`bash
npx agentlens --version
\`\`\`

### Python
\`\`\`bash
agentlens --version
python -c "from agentlens import AgentLens; print('AgentLens ready')"
\`\`\`
```

**Phase 3 Success Criteria:**
- ✅ All packages published to npm.com
- ✅ All packages published to PyPI.org
- ✅ Fresh installation works for both platforms
- ✅ CLI works with `--version` flag
- ✅ Examples run successfully with published packages
- ✅ Installation documentation complete

---

## Phase 4: Web Dashboard

**Duration:** 3-4 weeks
**Goal:** Visual UI for exploring and analyzing agent logs
**Success:** Dashboard loads logs and displays run timeline

### 4.1 Architecture

```
┌─────────────────────────────────────────────┐
│          AgentLens Web Dashboard            │
├─────────────────────────────────────────────┤
│                                             │
│  Frontend (React/Vue)                       │
│  ├── Runs Table                             │
│  ├── Timeline Visualization                 │
│  ├── Cost Breakdown                         │
│  ├── Error Analysis                         │
│  └── Search & Filter                        │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  Backend (Node.js Express or Python Flask)  │
│  ├── JSONL File Parser                      │
│  ├── Log Indexer                            │
│  ├── Query Handler                          │
│  └── Statistics Computer                    │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  Data Sources                               │
│  ├── File uploads (.log files)              │
│  ├── Real-time streaming (future)           │
│  └── Database backends (Phase 6)            │
│                                             │
└─────────────────────────────────────────────┘
```

### 4.2 Frontend Components

**Technology Choice:** React (or Vue, your preference)
- **Framework:** React 18+ with TypeScript
- **Styling:** Tailwind CSS (or styled-components)
- **State Management:** Zustand (lightweight) or Redux
- **Charts:** Recharts (lightweight, React-native)
- **Table:** TanStack Table (React Table v8+)

**Components to Build:**

1. **Runs Dashboard** (`RunsTable.tsx`)
   - Display all loaded runs
   - Columns: run_id, agent, start_time, duration, cost, status
   - Sort by duration/cost/status
   - Click to view details

2. **Run Details** (`RunDetail.tsx`)
   - Timeline view of all steps
   - Step tree (PLAN → TOOL_CALL → LLM_CALL → etc.)
   - Cost breakdown per step
   - Token breakdown (input vs output)

3. **Step Inspector** (`StepInspector.tsx`)
   - View detailed event data
   - Show input/output for tools
   - Display error details
   - Copy JSON to clipboard

4. **Cost Analysis** (`CostAnalysis.tsx`)
   - Bar chart: cost per run
   - Pie chart: cost by LLM model
   - Stats: total cost, avg cost, most expensive run

5. **Error Analysis** (`ErrorAnalysis.tsx`)
   - Error frequency chart
   - List of recent errors
   - Error trends over time

6. **Search & Filter** (`SearchBar.tsx` + `FilterPanel.tsx`)
   - Search by run_id, agent, status
   - Filter by date range
   - Filter by agent name
   - Filter by error presence

### 4.3 Backend API

**Technology Choice:** Express.js (Node.js) or Flask (Python)
**Recommend:** Express.js for simplicity

**Endpoints to Implement:**

```
GET  /api/health
     Response: { status: "ok", version: "1.0.0" }

POST /api/logs/upload
     Accepts: multipart/form-data with .log file
     Response: { success: true, runs_count: 42 }

GET  /api/runs
     Query: ?limit=100&offset=0&sort_by=cost
     Response: { runs: [...], total: 42 }

GET  /api/runs/:run_id
     Response: { run: {...}, events: [...] }

GET  /api/runs/:run_id/timeline
     Response: { events: [...] (ordered by step_index) }

GET  /api/stats
     Response: {
       total_runs: 42,
       total_cost: 1.23,
       total_tokens: 50000,
       most_used_tool: "web_search",
       avg_cost: 0.029,
       success_rate: 0.976
     }

GET  /api/errors
     Response: {
       total_errors: 3,
       errors: [
         { code: "TIMEOUT", count: 2, last_seen: "..." },
         ...
       ]
     }
```

### 4.4 File Structure

```
dashboard/                          # New directory at root
├── frontend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── components/
│   │   │   ├── RunsTable.tsx
│   │   │   ├── RunDetail.tsx
│   │   │   ├── StepInspector.tsx
│   │   │   ├── CostAnalysis.tsx
│   │   │   ├── ErrorAnalysis.tsx
│   │   │   └── SearchBar.tsx
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   └── RunDetail.tsx
│   │   ├── hooks/
│   │   │   ├── useRuns.ts
│   │   │   ├── useRunDetail.ts
│   │   │   └── useStats.ts
│   │   ├── types/
│   │   │   └── index.ts         # Reuse ARLS types
│   │   ├── App.tsx
│   │   └── index.tsx
│   └── public/
│
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── routes/
│   │   │   ├── logs.ts          # POST /api/logs/upload
│   │   │   ├── runs.ts          # GET /api/runs, GET /api/runs/:id
│   │   │   ├── stats.ts         # GET /api/stats
│   │   │   └── errors.ts        # GET /api/errors
│   │   ├── services/
│   │   │   ├── logParser.ts     # Parse JSONL files
│   │   │   ├── logIndexer.ts    # Index for fast querying
│   │   │   └── statsComputer.ts # Calculate aggregates
│   │   ├── middleware/
│   │   │   ├── errorHandler.ts
│   │   │   └── cors.ts
│   │   └── index.ts             # Express app entry
│   └── __tests__/
│
└── README.md                      # Dashboard setup instructions
```

### 4.5 Implementation Steps

**Step 4.5.1: Backend Setup**
1. Create `dashboard/backend/` with Express server
2. Implement JSONL parser in `logParser.ts`
3. Add `/api/logs/upload` endpoint
4. Test with example log file from Phase 2
5. Implement `/api/runs` endpoint with filtering

**Step 4.5.2: Frontend Setup**
1. Create `dashboard/frontend/` with React + TypeScript
2. Add Tailwind CSS for styling
3. Build RunsTable component (fetch from backend)
4. Build RunDetail component (fetch single run)
5. Add routing between pages

**Step 4.5.3: Integration**
1. Connect all components
2. Add search and filtering
3. Add cost analysis charts
4. Test with real agent logs
5. Deploy to Vercel (frontend) + Heroku/Railway (backend)

### 4.6 Deployment

**Frontend Deployment (Vercel):**
```bash
cd dashboard/frontend
npm install -g vercel
vercel deploy
# Output: https://agentlens-dashboard.vercel.app
```

**Backend Deployment (Railway or Heroku):**
```bash
cd dashboard/backend
# Create railway.json or Procfile
# Push to GitHub, connect to Railway/Heroku
# Backend URL: https://agentlens-api.railway.app
```

**Phase 4 Success Criteria:**
- ✅ Dashboard loads JSONL files via file upload
- ✅ Runs table displays all loaded runs
- ✅ Run details show timeline of steps
- ✅ Cost analysis charts render correctly
- ✅ Search/filter functionality works
- ✅ Dashboard deployed publicly
- ✅ Example logs load successfully

---

## Phase 5: Ecosystem Integration

**Duration:** 2-3 weeks
**Goal:** Support major AI agent frameworks (LlamaIndex, AutoGPT, DSPy)
**Success:** 3+ framework integrations working with examples

### 5.1 LlamaIndex Integration

**Why LlamaIndex?**
- 30k+ GitHub stars (second most popular agent framework after LangChain)
- Production use in enterprise
- Complements AgentLens well (indexing + observability)

**Implementation Path:**

1. **Create callback handler** (similar to LangChain)
   - File: `packages/interceptors/src/llamaindex.ts` (TS) or `agentlens-interceptors/agentlens_interceptors/llamaindex.py` (Python)
   - Implement LlamaIndex callback interface
   - Log: query events, retrieval events, synthesis events

2. **Create example** (TS + Python)
   - Query document index
   - View full trace in AgentLens
   - Show cost breakdown

3. **Documentation**
   - Add to README under "Integration Patterns"
   - Create `docs/LLAMAINDEX_INTEGRATION.md`

**LlamaIndex Event Mapping:**

| LlamaIndex Event | ARLS Type | Details |
|---|---|---|
| `on_retrieve` | TOOL_CALL | Document retrieval as tool |
| `on_synthesize` | LLM_CALL | Synthesis LLM call |
| `on_query` | AGENT_START | Root query event |
| `on_chat` | REASONING_STEP | Chat message |

### 5.2 AutoGPT / AgentGPT Integration

**Why?**
- 150k+ GitHub stars (demonstration of autonomous agents)
- Growing production usage
- Clear need for observability

**Implementation Path:**

1. **Analyze AutoGPT codebase**
   - Identify hook points for logging
   - Look for callback/event system

2. **Create wrapper or middleware**
   - File: `packages/interceptors/src/autogpt.ts`
   - Log: agent loop, tool calls, thoughts, actions

3. **Create example**
   - Run AutoGPT with AgentLens
   - Show full agent trace

4. **Documentation**

### 5.3 DSPy Integration

**Why DSPy?**
- Modern structured prompting framework
- Growing adoption in research labs
- Complementary to AgentLens (optimization + observability)

**Implementation Path:**

1. **Create DSPy tracer**
   - File: `packages/interceptors/src/dspy.ts`
   - Trace prompt construction, LLM calls, parsing

2. **Create example**
   - Optimize DSPy program with AgentLens visibility
   - Show improvement metrics

3. **Documentation**

### 5.4 General Framework Integration Template

**For future frameworks, follow this pattern:**

```typescript
// packages/interceptors/src/[framework].ts

export interface FrameworkConfig {
  // Framework-specific options
}

/**
 * Create a callback/hook for [Framework] that logs to AgentLens
 */
export function createAgentLensCallback(config: FrameworkConfig) {
  return {
    // Implement callback interface
    // Log relevant events to AgentLens
  }
}
```

**Phase 5 Success Criteria:**
- ✅ LlamaIndex callback handler working
- ✅ Example running with LlamaIndex
- ✅ AutoGPT integration documented
- ✅ DSPy integration documented
- ✅ Each integration has working example
- ✅ README updated with integrations table

---

## Phase 6: Database Persistence

**Duration:** 3-4 weeks
**Goal:** Enable production log storage in databases
**Success:** Logs persist to PostgreSQL, MongoDB, and S3

### 6.1 Architecture Decision

**Current Architecture:**
```
Agent → Transport (file or console) → JSONL file
```

**With Database Persistence:**
```
Agent → Transport → Database Driver → Database
                  ↓
                JSONL file (optional local copy)
```

**Database Options:**

| Database | Pros | Cons | Phase |
|----------|------|------|-------|
| **PostgreSQL** | Relational, JSONB support, queryable | Schema overhead | 6.1 |
| **MongoDB** | Flexible schema, native JSON | Less queryable | 6.2 |
| **S3 / Cloud Storage** | Cheap, scalable, simple | Slow queries | 6.3 |
| **SQLite** | Lightweight, file-based | Single-process limit | Future |

### 6.2 PostgreSQL Transport (Phase 6.1)

**Database Schema:**

```sql
CREATE TABLE arls_events (
  id BIGSERIAL PRIMARY KEY,
  run_id VARCHAR(255) NOT NULL,
  trace_id VARCHAR(255) NOT NULL,
  step_index INT NOT NULL,
  schema_type VARCHAR(50) NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  agent_name VARCHAR(255),
  agent_phase VARCHAR(50),
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  INDEX idx_run_id (run_id),
  INDEX idx_trace_id (trace_id),
  INDEX idx_timestamp (timestamp),
  INDEX idx_schema_type (schema_type)
);

CREATE TABLE arls_runs (
  id SERIAL PRIMARY KEY,
  run_id VARCHAR(255) UNIQUE NOT NULL,
  agent_name VARCHAR(255) NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ended_at TIMESTAMP WITH TIME ZONE,
  total_cost DECIMAL(10, 4),
  total_tokens INT,
  status VARCHAR(50),

  INDEX idx_run_id (run_id),
  INDEX idx_started_at (started_at)
);
```

**Implementation:**

**TypeScript:**
```typescript
// packages/transport/src/postgres.ts

import pg from 'pg'

export interface PostgresTransportConfig {
  host: string
  port: number
  database: string
  user: string
  password: string
  maxConnections?: number
}

export class PostgresTransport extends BaseTransport {
  private pool: pg.Pool

  constructor(config: PostgresTransportConfig) {
    super()
    this.pool = new pg.Pool(config)
  }

  async write(event: ARLSEvent, rendered: string): Promise<void> {
    const query = `
      INSERT INTO arls_events (
        run_id, trace_id, step_index, schema_type,
        timestamp, agent_name, agent_phase, data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `

    await this.pool.query(query, [
      event.run_id,
      event.trace_id,
      event.step_index,
      event.schema_type,
      event.timestamp,
      event.agent.name,
      event.agent.phase,
      JSON.stringify(event) // JSONB column
    ])
  }

  async close(): Promise<void> {
    await this.flush()
    await this.pool.end()
  }
}
```

**Python:**
```python
# python/agentlens-transport/agentlens_transport/postgres.py

import asyncpg
from agentlens_core import ARLSEvent
from agentlens_transport.base import BaseTransport

class PostgresTransport(BaseTransport):
    def __init__(self, config: PostgresConfig):
        super().__init__()
        self.config = config
        self.pool: Optional[asyncpg.Pool] = None

    async def connect(self) -> None:
        self.pool = await asyncpg.create_pool(
            host=self.config.host,
            port=self.config.port,
            database=self.config.database,
            user=self.config.user,
            password=self.config.password,
        )

    async def write(self, event: ARLSEvent, rendered: str) -> None:
        await self.queue.put((event, rendered))

    async def _drain(self) -> None:
        while not self.queue.empty():
            event, rendered = await self.queue.get()
            await self.pool.execute(
                """INSERT INTO arls_events (...) VALUES (...)""",
                event.run_id,
                event.trace_id,
                # ... etc
            )
```

### 6.3 MongoDB Transport (Phase 6.2)

**Collection Schema:**

```javascript
db.createCollection("events", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["run_id", "trace_id", "step_index", "schema_type", "timestamp"],
      properties: {
        run_id: { bsonType: "string" },
        trace_id: { bsonType: "string" },
        step_index: { bsonType: "int" },
        schema_type: { bsonType: "string" },
        timestamp: { bsonType: "date" },
        data: { bsonType: "object" }
      }
    }
  }
})

db.events.createIndex({ run_id: 1 })
db.events.createIndex({ trace_id: 1 })
db.events.createIndex({ timestamp: 1 })
```

**Implementation:**

```typescript
// packages/transport/src/mongodb.ts

import { MongoClient, Collection } from 'mongodb'

export class MongoDBTransport extends BaseTransport {
  private client: MongoClient
  private collection: Collection

  async connect(config: MongoDBConfig): Promise<void> {
    this.client = new MongoClient(config.uri)
    await this.client.connect()
    const db = this.client.db(config.database)
    this.collection = db.collection('arls_events')
  }

  async write(event: ARLSEvent, rendered: string): Promise<void> {
    await this.collection.insertOne({
      ...event,
      _rendered: rendered,
      _inserted_at: new Date()
    })
  }
}
```

### 6.4 S3 Transport (Phase 6.3)

**Storage Format:** Partitioned by date and run_id

```
s3://agentlens-logs/
├── 2025/04/
│   ├── 04/
│   │   ├── run_1712282400000_a3c2e5.jsonl
│   │   ├── run_1712282400001_b4d3f6.jsonl
│   │   └── ...
```

**Implementation:**

```typescript
// packages/transport/src/s3.ts

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

export class S3Transport extends BaseTransport {
  private s3: S3Client
  private bucket: string
  private buffer: ARLSEvent[] = []

  async write(event: ARLSEvent, rendered: string): Promise<void> {
    this.buffer.push(event)

    // Flush every 100 events or 5 seconds
    if (this.buffer.length >= 100) {
      await this.flush()
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return

    const key = this.getS3Key()
    const jsonl = this.buffer
      .map(e => JSON.stringify(e))
      .join('\n')

    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: jsonl,
      ContentType: 'application/x-ndjson'
    }))

    this.buffer = []
  }

  private getS3Key(): string {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const timestamp = now.getTime()

    return `agentlens/${year}/${month}/${day}/${timestamp}.jsonl`
  }
}
```

### 6.5 Usage Example

**TypeScript:**

```typescript
const lens = new AgentLens({
  agent: 'ProductionAgent',
  transport: new PostgresTransport({
    host: 'localhost',
    port: 5432,
    database: 'agentlens',
    user: 'postgres',
    password: 'password'
  })
})
```

**Python:**

```python
transport = PostgresTransport(config={
    "host": "localhost",
    "port": 5432,
    "database": "agentlens",
    "user": "postgres",
    "password": "password"
})

lens = AgentLens(
    agent="ProductionAgent",
    transport=transport
)
```

### 6.6 Querying Logs from Database

**Example: Find all errors in a time range**

```sql
SELECT * FROM arls_events
WHERE schema_type = 'ERROR'
  AND timestamp BETWEEN '2025-04-01' AND '2025-04-30'
ORDER BY timestamp DESC
LIMIT 50
```

**Example: Calculate cost by agent**

```sql
SELECT
  agent_name,
  COUNT(*) as event_count,
  SUM((data->>'cost_usd')::decimal) as total_cost
FROM arls_events
WHERE schema_type = 'LLM_CALL'
GROUP BY agent_name
ORDER BY total_cost DESC
```

### 6.7 Migration Path

**From File to Database:**

```bash
# Export existing JSONL to PostgreSQL
agentlens export agentlens.log --to-postgres --uri postgresql://...

# Or programmatically:
# Read .log file → Parse JSONL → Insert into database
```

**Phase 6 Success Criteria:**
- ✅ PostgreSQL transport working
- ✅ Events inserted correctly into database
- ✅ Querying events works (by run_id, timestamp, etc.)
- ✅ MongoDB transport working (Phase 6.2)
- ✅ S3 transport working (Phase 6.3)
- ✅ Migration tool from file to database
- ✅ Dashboard updated to query from database
- ✅ Examples showing database persistence

---

## Success Metrics

### Phase 3: Publishing (After 1 week)

| Metric | Target | Definition |
|--------|--------|-----------|
| **npm downloads** | 50+ | Weekly downloads of @agentlens/* packages |
| **PyPI downloads** | 50+ | Weekly downloads of agentlens* packages |
| **GitHub stars** | 200+ | Net new stars (currently ~150) |
| **Installation success** | 95%+ | Fresh installs that work without errors |

### Phase 4: Web Dashboard (After 3 weeks)

| Metric | Target | Definition |
|--------|--------|-----------|
| **Dashboard load time** | <2s | Time to load with 50 runs |
| **Runs per second displayed** | 1000+ | Can handle large log files |
| **Search latency** | <100ms | Time to search 1000 events |
| **User feedback** | 4.5/5 stars | UX quality rating |

### Phase 5: Ecosystem (After 2 weeks)

| Metric | Target | Definition |
|--------|--------|-----------|
| **Framework integrations** | 3+ | Working integrations (LlamaIndex, AutoGPT, DSPy) |
| **Integration examples** | 3+ | Working code examples per framework |
| **Documentation coverage** | 100% | All integrations documented |
| **Community feedback** | Positive | Issues and discussions on GitHub |

### Phase 6: Database (After 3 weeks)

| Metric | Target | Definition |
|--------|--------|-----------|
| **Query performance** | <500ms | Search 100k events by filters |
| **Storage efficiency** | 80%+ | Space savings vs file storage |
| **Write throughput** | 1000+ events/sec | Concurrent writes |
| **Uptime** | 99.9% | Database availability |

### Overall (End of Q3 2025)

| Metric | Target |
|--------|--------|
| **Total npm downloads (monthly)** | 500+ |
| **Total PyPI downloads (monthly)** | 500+ |
| **GitHub stars** | 300+ |
| **Production users (self-reported)** | 10+ |
| **External integrations** | 3+ |

---

## Risk Mitigation

### Risk 1: Package Publishing Conflicts

**Risk:** Name conflicts on npm/PyPI, version mismanagement

**Mitigation:**
- Reserve package names early (@agentlens organization on npm)
- Use scoped packages (@agentlens/core, not agentlens-core on npm)
- Test on test.pypi.org first
- Synchronized versioning across all packages

**Action:** Before Phase 3 starts, verify name availability

---

### Risk 2: Web Dashboard Complexity

**Risk:** Dashboard takes longer than expected, becomes unmaintainable

**Mitigation:**
- Use established libraries (React, Recharts, TanStack Table)
- Keep backend simple (Express, no ORM initially)
- MVP first (runs table + timeline), features later
- Use component libraries (Headless UI, Radix)

**Action:** Create dashboard mockups first, get feedback before coding

---

### Risk 3: Framework Integration Brittleness

**Risk:** Framework APIs change, integrations break

**Mitigation:**
- Pin framework versions in peer dependencies
- Version integrations separately from core
- Test against framework minor versions
- Document supported versions

**Example `pyproject.toml`:**
```toml
[tool.poetry.extras]
langchain = ["langchain-core>=0.1.0,<0.2.0"]
llamaindex = ["llama-index>=0.9.0,<0.10.0"]
```

---

### Risk 4: Database Schema Evolution

**Risk:** Schema changes break existing data, queries become slow

**Mitigation:**
- Use migrations (Alembic for Python, Knex for Node.js)
- Support multiple schema versions
- Index all commonly-queried fields
- Archive old data to S3

**Action:** Plan schema migration strategy for ARLS v1.1

---

### Risk 5: Storage Cost Explosion (S3)

**Risk:** S3 becomes expensive as logs grow

**Mitigation:**
- Set object lifecycle policies (delete after 1 year)
- Use S3 Intelligent-Tiering
- Compress JSONL before upload
- Document cost estimates

---

## Timeline & Milestones

### Q2 2025 (Weeks 1-6)

```
Week 1 (Apr 7-11):   Phase 3 Start
  ├─ npm publishing
  └─ PyPI publishing

Week 2-3 (Apr 14-25): Phase 3 Complete + Phase 4 Start
  ├─ Package verification
  ├─ Installation testing
  ├─ Dashboard backend setup
  └─ Dashboard frontend components

Week 4-6 (Apr 28-Jun 8): Phase 4 Continue
  ├─ Dashboard integration
  ├─ Deploy frontend
  ├─ Deploy backend
  └─ Documentation
```

### Q3 2025 (Weeks 7-12)

```
Week 7-8 (Jun 9-22): Phase 5 Start
  ├─ LlamaIndex integration
  ├─ AutoGPT integration
  ├─ DSPy integration
  └─ Examples & docs

Week 9-12 (Jun 23-Jul 20): Phase 6 Start
  ├─ PostgreSQL transport
  ├─ MongoDB transport
  ├─ S3 transport
  ├─ Migration tools
  └─ Database querying
```

### Cumulative Deliverables

| Phase | Deliverable | Owner | Status |
|-------|-------------|-------|--------|
| 3 | npm + PyPI packages | DevOps | 📅 Week 1-2 |
| 4 | Web dashboard | Frontend + Backend | 📅 Week 3-6 |
| 5 | 3+ integrations | Integrations | 📅 Week 7-8 |
| 6 | Database layer | Backend | 📅 Week 9-12 |

---

## Implementation Checklist

### Phase 3: Publishing

- [ ] Verify all tests passing (pnpm test, poetry run pytest)
- [ ] Run TypeScript strict mode (pnpm typecheck)
- [ ] Update versions in all package.json/pyproject.toml
- [ ] Create CHANGELOG.md entries
- [ ] Create GitHub releases
- [ ] Publish to npm test registry
- [ ] Publish to PyPI test registry
- [ ] Test fresh installations
- [ ] Publish to production npm
- [ ] Publish to production PyPI
- [ ] Announce on social media
- [ ] Create installation guide
- [ ] Close Phase 3 issue

### Phase 4: Web Dashboard

- [ ] Create `dashboard/` directory
- [ ] Set up Express.js backend
- [ ] Implement JSONL parser
- [ ] Create `/api/logs/upload` endpoint
- [ ] Create `/api/runs` endpoint
- [ ] Create React frontend
- [ ] Build RunsTable component
- [ ] Build RunDetail component
- [ ] Build CostAnalysis charts
- [ ] Add search/filter functionality
- [ ] Deploy frontend to Vercel
- [ ] Deploy backend to Railway
- [ ] Test with example logs
- [ ] Write dashboard documentation
- [ ] Close Phase 4 issue

### Phase 5: Ecosystem

- [ ] Research LlamaIndex callback API
- [ ] Implement LlamaIndex integration
- [ ] Create LlamaIndex example
- [ ] Research AutoGPT codebase
- [ ] Implement AutoGPT integration
- [ ] Create AutoGPT example
- [ ] Research DSPy framework
- [ ] Implement DSPy integration
- [ ] Create DSPy example
- [ ] Update README integrations table
- [ ] Write integration guides
- [ ] Close Phase 5 issue

### Phase 6: Database

- [ ] Design PostgreSQL schema
- [ ] Implement PostgresTransport (TS)
- [ ] Implement PostgresTransport (Python)
- [ ] Test insert/query performance
- [ ] Design MongoDB schema
- [ ] Implement MongoDBTransport
- [ ] Test insert/query performance
- [ ] Implement S3Transport
- [ ] Create migration tool (file → DB)
- [ ] Update dashboard to query database
- [ ] Load test (1M events)
- [ ] Write database documentation
- [ ] Close Phase 6 issue

---

## Conclusion

These four phases position AgentLens as a **production-grade observability platform** with:

✅ **Easy Installation** (npm/PyPI)
✅ **Visual Analytics** (web dashboard)
✅ **Ecosystem Support** (major frameworks)
✅ **Enterprise Storage** (databases)

**Expected Outcome:** 500+ monthly downloads, 10+ production users, featured in industry discussions

**Next Steps:**
1. Review this plan with stakeholders
2. Adjust priorities based on feedback
3. Assign team members to phases
4. Create GitHub issues for each phase
5. Start Phase 3 immediately

---

**Document Version:** 1.0
**Last Updated:** 2025-04-04
**Next Review:** After Phase 3 completion
