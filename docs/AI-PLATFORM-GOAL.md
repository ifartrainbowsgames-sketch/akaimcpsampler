# Autonomous Multi-Agent Coding AI — Project Goal

## Mission

Build a **self-learning, self-hosted AI coding platform** — comparable in *capability* to **Claude Code** and **Cursor** — powered by **50+ autonomous agents** that plan, code, verify, **and get smarter over time without you hand-feeding every answer**.

**Self-learning is the whole point.** The system must:

1. **Learn from the world** — public GitHub, YouTube, docs, search (via **AgentReach**)
2. **Learn from every job** — successes, failures, test output, reviewer feedback → memory + datasets
3. **Apply what it learned** — next task starts with prior patterns, not from zero
4. **Improve itself** — prompt optimization, skill library growth, optional model fine-tuning on verified trajectories

Target quality bar: **frontier-class coding** (aspiration: Opus-class reasoning and reliability), achieved through **orchestration + verification + accumulated knowledge** — not a one-shot prompt per task.

Supporting pillars: **Graphify** (codebase intelligence), **Deep Agents + LangGraph** (orchestration), **AgentReach** (web/GitHub/YouTube access).

**This project is NOT about the MPC sampler UI or AKIRA visuals.** It is about **reading, reasoning, learning, and creating software with AI that teaches itself.**

---

## What we are building

| Capability | Description |
|------------|-------------|
| **Self-learning (core)** | Continuous loop: discover → try → verify → remember → reuse; platform gets better every week |
| **Multi-agent orchestration** | 50+ agents with roles: planner, coder, reviewer, tester, learner, debugger, deployer |
| **Self-control & self-check** | Agents critique each other; loops until tests/lint pass or budget exhausted |
| **Persistent memory** | Episodic (past jobs), semantic (patterns/skills), procedural (how-to for stacks/tools) |
| **Server-hosted service** | API + dashboard; users submit tasks; agents run on server infrastructure |
| **Agent deployment** | Spin up/isolate agent workers (containers/sandboxes); queue jobs; monitor lifecycle |
| **Graphify integration** | Knowledge graph over repos — local + ingested public repos; grows with every clone |
| **AgentReach integration** | Web/GitHub/YouTube access — agents fetch new knowledge when they hit unknown territory |
| **Claude Code–like UX** | Terminal/agent mode: read repo, edit files, run commands, git, iterative fixes |
| **Cursor-like UX** | IDE integration or web UI: inline edits, project rules, background agents on branches |

---

## Non-negotiables

1. **Self-learning is mandatory** — every completed job writes back to memory; unknown tasks trigger web/GitHub research before asking the user; the platform must measurably improve on repeated task types.
2. **Safety & isolation** — each agent run in sandbox (container/VM); no arbitrary host access; secrets in vault/env.
3. **Verifiability** — no “done” without automated checks where possible: build, test, lint, typecheck, optional human gate.
4. **Observability** — every agent step logged (LangSmith or equivalent): prompts, tool calls, diffs, cost, latency — **feeds the learning pipeline**.
5. **Graph-first codebase context** — use Graphify before large grep/read sweeps when `graphify-out/` exists.
6. **Web learning is first-class** — agents must reach GitHub, YouTube, and the open web via AgentReach (not only user-supplied code).
7. **Model-agnostic core** — orchestration layer must swap models (Claude, GPT, open weights) without rewriting agents.
8. **Honest quality bar** — Opus-class *behavior* is achieved via **strong base models + multi-agent verification + accumulated knowledge**, not by pretending a small local model equals frontier reasoning on day one.

---

## Self-learning architecture (the core loop)

This is not a “nice to have later” feature. **Self-learning runs on every job from day one.**

```
                    ┌──────────────────────────────────────┐
                    │         USER TASK ARRIVES            │
                    └──────────────────┬───────────────────┘
                                       │
                    ┌──────────────────▼───────────────────┐
                    │  RECALL — search memory + skill lib   │
                    │  Have we done this stack/pattern?     │
                    └──────────────────┬───────────────────┘
                                       │
                         gap found? ───┼─── yes, enough context
                                       │              │
                    ┌──────────────────▼───┐          │
                    │  DISCOVER (AgentReach)│          │
                    │  GitHub · YouTube ·   │          │
                    │  web · Exa search     │          │
                    └──────────────────┬───┘          │
                                       │              │
                    ┌──────────────────▼──────────────▼──┐
                    │  INGEST — clone repo, graphify,    │
                    │  extract patterns, store subgraph  │
                    └──────────────────┬─────────────────┘
                                       │
                    ┌──────────────────▼─────────────────┐
                    │  ACT — plan → code → review → test   │
                    └──────────────────┬─────────────────┘
                                       │
                    ┌──────────────────▼─────────────────┐
                    │  REFLECT — what worked? what failed? │
                    │  critic output · test logs · diffs   │
                    └──────────────────┬─────────────────┘
                                       │
                    ┌──────────────────▼─────────────────┐
                    │  REMEMBER — write to memory layers   │
                    │  trajectories · skills · eval set    │
                    └──────────────────┬─────────────────┘
                                       │
                    ┌──────────────────▼─────────────────┐
                    │  IMPROVE — nightly/weekly jobs       │
                    │  DSPy · regressions · fine-tune opt  │
                    └──────────────────────────────────────┘
```

### Three learning sources

| Source | What the system learns | How |
|--------|------------------------|-----|
| **External (world)** | New libraries, patterns, idioms, tutorials | AgentReach → GitHub clone → Graphify ingest → skill cards |
| **Internal (experience)** | What fixes worked, common failure modes, project conventions | Trajectory logging after every job; replay on similar tasks |
| **Social (multi-agent)** | Reviewer critiques, cross-agent corrections | Critic/fixer loops produce labeled `{bad diff → good diff}` pairs |

### Memory layers (persistent, queryable)

| Layer | Stores | Used when |
|-------|--------|-----------|
| **Episodic** | Full job traces: prompt, tools, diffs, test results, outcome | “Last time we migrated X, we did Y” |
| **Semantic** | Distilled facts: “React 19 uses …”, “this repo uses Zustand for state” | Planner + researcher context injection |
| **Procedural (skills)** | Reusable playbooks: “add auth with Clerk”, “fix flaky pytest” | Supervisor routes to matching skill before planning from scratch |
| **Graph (Graphify)** | Code structure of local + ingested public repos | Scoped subgraph per agent; grows with every ingest |

### Skill library (self-built curriculum)

After ingesting GitHub repos or completing jobs, a **Learner agent** distills:

- **Pattern cards** — “how this codebase handles routing / state / tests”
- **Failure cards** — “when you see error X, check Y” (from failed runs that later succeeded)
- **Stack profiles** — React+Zustand, FastAPI+SQLAlchemy, etc. — built from public repos + your repos

Next time a similar task arrives, the supervisor **recalls skills first**, then researches only the gap.

### When the AI does NOT know something

**Default behavior (required):**

1. Search memory + skill library + Graphify (local + ingested repos)
2. If gap remains → **AgentReach**: GitHub search, YouTube tutorial, docs, Exa
3. Ingest findings → Graphify + skill card
4. Attempt task → log outcome
5. **Only then** ask the user — with what was already tried

The user teaches the system once; the system teaches itself afterward.

### Improvement schedule (automatic, not manual)

| Cadence | Job |
|---------|-----|
| **Every job** | Log trajectory; update episodic memory; extract failure/success signals |
| **Daily** | Merge new skill cards; dedupe; index for retrieval |
| **Weekly** | Run eval suite on benchmark repos; compare to last week; flag regressions |
| **Monthly** | DSPy prompt optimization on top failure categories; optional LoRA fine-tune on verified trajectories |

### What “self-learning” is NOT

- **Not** training a frontier model from scratch on day one
- **Not** blindly copying GitHub code without tests and review
- **Not** replacing the user — it reduces how often you must explain the same stack twice

### What “self-learning” IS

- Agents that **get faster and more accurate on your stack** over weeks
- A **growing knowledge base** of public + private code patterns
- **Measurable improvement**: same benchmark tasks pass more often with fewer tokens and fewer web fetches (because memory already has the answer)

---

## Architecture (target)

```
┌─────────────────────────────────────────────────────────────┐
│  Clients: Web UI · VS Code/Cursor plugin · CLI · API        │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  API Gateway — auth, quotas, job submit, stream events      │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  Deep Agents Supervisor (LangGraph runtime)                   │
│    ├─ Planner agent                                         │
│    ├─ Research agent (Graphify + AgentReach)                │
│    ├─ Learner agent (distill skills, ingest repos)          │
│    ├─ Coder agents (N parallel, file-scoped)                │
│    ├─ Critic / reviewer agents                              │
│    ├─ Test runner agent                                     │
│    └─ Integrator / merge agent                              │
└───────────────────────────┬─────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
   Graphify KG          Tool layer         Model router
   (local + ingested)  bash, git, read,   Claude / GPT /
                       write, grep, PR     open models
        │                   │                   │
        └───────────────────┴───────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  LEARNING LAYER (persistent — grows every job)                │
│    ├─ Episodic memory (trajectories)                          │
│    ├─ Skill library (pattern + failure cards)                 │
│    ├─ Eval datasets + regression suite                        │
│    └─ Optional: fine-tuned adapters on verified runs          │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  AgentReach — web, GitHub, YouTube, search, RSS               │
│  (gh, yt-dlp, Jina Reader, Exa MCP — zero API fees)           │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  Agent workers (50+) — Docker/K8s · OpenHands-style sandbox │
│  Queue: Redis/Rabbit/SQS · object storage for artifacts     │
└─────────────────────────────────────────────────────────────┘
```

---

## AgentReach — web access for learning (critical)

[Agent-Reach](https://github.com/Panniantong/Agent-Reach) gives agents **eyes on the internet** without paid platform APIs. It is a Python CLI “capability layer” that installs, routes, and health-checks backends per platform — when one tool breaks (Reddit API changes, yt-dlp blocked), AgentReach switches routes so agents keep working.

### Why it matters for this platform

Code does not only come from the user. Agents must **learn from public GitHub**, **YouTube tutorials**, **docs and blog posts**, and **search** — then apply patterns inside sandboxes with Graphify-scoped repo context.

### Zero-config channels (install and use immediately)

| Channel | What agents can do | Backend |
|---------|---------------------|---------|
| **Web** | Read any URL as clean Markdown | Jina Reader (`curl https://r.jina.ai/URL`) |
| **GitHub** | View/search public repos, read code | `gh` CLI |
| **YouTube** | Search videos, extract subtitles/transcripts | `yt-dlp` |
| **RSS** | Follow feeds, docs changelogs | `feedparser` |
| **Search** | Semantic web search | Exa via MCP (free tier) |
| **Bilibili / V2EX** | Extra video/community sources | Platform-specific CLIs |

### Optional channels (cookie/login)

Twitter/X, Reddit, LinkedIn, XiaoHongShu — require browser login or cookies. Not required for core coding; enable when research agents need social signals.

### Install & verify

```bash
pip install agent-reach
agent-reach doctor          # health-check all channels
agent-reach doctor --json   # machine-readable status
```

Also available as an **Agent Skill** (Claude Code, Cursor, Windsurf) and **MCP server** for framework integration.

### Platform integration

Expose AgentReach as **first-class tools** in the orchestrator:

| Tool | Example use |
|------|-------------|
| `web_read(url)` | Fetch docs, blog posts, Stack Overflow |
| `github_repo(owner/repo)` | Inspect public code, README, structure |
| `github_search(query)` | Find reference implementations |
| `youtube_transcript(url)` | Learn from coding tutorials |
| `web_search(query)` | Exa semantic search for patterns/APIs |
| `rss_read(url)` | Track library releases and changelogs |

**Research agent loop:** `web_search → github_repo → graphify query → implement → test`

### Learning pipeline (public code → platform knowledge)

This pipeline runs **automatically** when agents hit unknown territory — not only on manual ingest jobs.

1. **Recall** — check memory + skill library + Graphify (local + previously ingested repos).
2. **Discover** — if gap: AgentReach finds repos, tutorials, docs for the unknown stack/pattern.
3. **Ingest** — clone/index public repos; `graphify update`; store subgraphs + metadata.
4. **Distill** — Learner agent writes pattern cards + stack profiles from ingested material.
5. **Apply** — Coder agents use recalled skills + Graphify-scoped context (not blind copy-paste).
6. **Reflect** — log success/failure signals from tests, critic, and diffs.
7. **Remember** — append to episodic memory + eval dataset; promote repeated patterns to skills.
8. **Improve** — weekly evals + DSPy/fine-tune on verified trajectories.

---

## LangGraph vs “something better for coding” (2026 research)

**LangGraph alone is not the best starting point for a coding agent.** It is the **orchestration runtime** — stateful graphs, checkpointing, human-in-the-loop, parallel fan-out. For *teaching AI to code*, the industry has moved to **higher-level coding harnesses** built on top of LangGraph.

### Recommended stack (layers, not either/or)

| Layer | Tool | Role |
|-------|------|------|
| **Coding harness** | [**Deep Agents**](https://github.com/langchain-ai/deepagents) | Planning, virtual filesystem, subagents, context management — “Claude Code-style” loop out of the box |
| **Reference implementation** | [**Open SWE**](https://github.com/langchain-ai/open-swe) | Open-source internal coding agent (MIT); Deep Agents + LangGraph; async PR generation |
| **Terminal agent** | [**Deep Agents Code (`dcode`)**](https://docs.langchain.com/deepagents-code) | Pre-built terminal coding agent; evaluate as baseline |
| **Orchestration runtime** | **LangGraph** | Supervisor graphs, checkpoints, 50-agent routing, custom DAGs |
| **Execution sandbox** | [**OpenHands**](https://github.com/All-Hands-AI/OpenHands) SDK | Containerized dev environment, SWE-bench-proven execution, security analyzer |
| **Codebase intelligence** | **Graphify** | Scoped subgraphs, community partitioning for 50 agents |
| **Web learning** | **AgentReach** | GitHub, YouTube, web, search — no API fees |

LangChain’s own guidance (2026): **start with Deep Agents** for most agent work; drop to raw LangGraph when you need a custom topology that does not fit a ReAct loop.

### Framework comparison

| Framework | Best for | Coding-specific? |
|-----------|----------|------------------|
| **Deep Agents** | Long-horizon coding tasks, subagent delegation, file-based context | **Yes — primary harness** |
| **Open SWE** | Self-hosted async coding agent → PR | **Yes — fork/evaluate first** |
| **LangGraph** | Custom multi-agent graphs, checkpointing, HITL at scale | Orchestration, not coding UX |
| **OpenHands** | Sandboxed execution, tests, SWE-bench (~73–77% Verified) | **Yes — execution layer** |
| **CrewAI** | Fast role-based prototyping | Weaker control for 50-agent production |
| **SWE-agent** | Narrow GitHub issue → fix pipeline | Good reference, not full platform |

### Recommended hybrid for this platform

```
Deep Agents (coding harness + subagents)
    └── LangGraph (supervisor, 50-agent routing, checkpoints)
            ├── Graphify tools (repo intelligence)
            ├── AgentReach tools (web/GitHub/YouTube)
            └── OpenHands-style sandbox (run tests, isolated FS)
```

**Do not rebuild the coding loop from scratch.** Fork/evaluate **Open SWE** and **Deep Agents Code** before writing custom planner/critic code.

---

## Agent roles (initial set)

| Agent | Job |
|-------|-----|
| **Supervisor** | Decompose user goal; assign subtasks; stop when done or over budget |
| **Learner** | Distill skills from completed jobs + ingested repos; maintain skill library; trigger ingest |
| **Graph explorer** | Run Graphify; return scoped subgraph + inferred edges (local + ingested repos) |
| **Web researcher** | AgentReach: GitHub repos, YouTube tutorials, docs, Exa search — **before asking user** |
| **Implementer** | Write minimal diffs; follow project conventions + recalled skills |
| **Reviewer** | Diff review; security + logic; request changes; produce labeled correction pairs |
| **Test runner** | Execute test suite; report failures with logs |
| **Fixer** | Patch failures from test/lint output |
| **Doc / rules** | Update CLAUDE.md, AGENTS.md, graphify after structural changes |
| **Deploy** | CI status, PR creation, optional merge (with policy) |

**Self-check + self-learn loop:**  
`recall → (research if gap) → plan → implement → review → test → (fail → fix)* → reflect → remember → ship`

---

## Tech stack (proposed)

| Layer | Technology |
|-------|------------|
| **Self-learning** | Trajectory store, skill library (vector + structured cards), nightly eval jobs, DSPy |
| Coding harness | **Deep Agents** (planning, subagents, filesystem context) |
| Orchestration runtime | **LangGraph** (stateful graphs, cycles, human-in-the-loop, 50-agent routing) |
| Reference / baseline | **Open SWE**, **Deep Agents Code (`dcode`)** |
| Execution sandbox | **OpenHands** SDK patterns or pluggable containers (Modal/Daytona/E2B) |
| Codebase intelligence | **Graphify** (AST graph, communities, wiki — local + ingested repos) |
| Web / GitHub / YouTube | **AgentReach** (`pip install agent-reach`; MCP or tool wrapper) |
| Memory | pgvector / Qdrant + object storage for trajectories; Graphify for structural memory |
| Eval / debug | **LangSmith** or open telemetry (traces, datasets, regressions) |
| API | FastAPI or Node + WebSockets for streaming |
| Workers | Docker + Kubernetes (or Modal/Fly.io for MVP) |
| Queue | Redis + Bull / Celery / Temporal |
| Sandboxing | gVisor / Firecracker / E2B / Daytona-style dev containers |
| Git | Clone to sandbox; branch per job; PR via GitHub App |
| Models (phase 1) | Frontier APIs (Claude Opus/Sonnet, GPT) via router |
| Models (phase 2) | Fine-tune coder model on approved trajectories (Unsloth/TRL) |
| Teaching / optimize | **DSPy** or LangSmith evals; trajectory logging from web+graph+code runs |

---

## How to reach Opus-class *coding* (realistic path)

Frontier models are the **reasoning engine**. Our platform wins on **self-learning + orchestration + verification + accumulated knowledge**, not by replacing Opus with a 7B model on day one.

### Phase 0 — Foundation (self-learning from job one)
- [ ] Repo `ai-agent-platform` (new) with monorepo layout
- [ ] Evaluate **Open SWE** and **Deep Agents Code** on 3 benchmark tasks
- [ ] Deep Agents supervisor + 1 coder + 1 critic + **1 learner** loop (LangGraph runtime)
- [ ] Tool SDK: `read_file`, `write_file`, `grep`, `run_terminal`, `graphify_query`
- [ ] **AgentReach tools:** `web_read`, `github_repo`, `github_search`, `youtube_transcript`, `web_search`
- [ ] **Memory MVP:** log every trajectory; `recall_skills(query)` before planning; write skill card after success
- [ ] Graphify embedded: auto-run on repo clone; inject subgraph into agent context
- [ ] Single sandbox worker; CLI: `agent run "fix the login bug"`
- [ ] **Prove learning loop:** run same task type twice — second run uses memory, fewer web fetches

### Phase 1 — Multi-agent MVP (scale to ~10 agents)
- [ ] Parallel implementers on non-overlapping files (Graphify community detection)
- [ ] Research agent auto-ingests public GitHub + YouTube when skill gap detected
- [ ] Skill library with stack profiles (React, FastAPI, etc.) built from ingested repos
- [ ] Mandatory review + test gate before PR; reviewer corrections → training pairs
- [ ] Job queue + 10 concurrent sandboxes
- [ ] Web UI: submit task, watch stream, view diff/PR + “what the agent learned”

### Phase 2 — Scale to 50+ agents
- [ ] Kubernetes autoscaling workers
- [ ] Task partitioner uses Graphify communities/god nodes
- [ ] Cost budgets per job; model routing (cheap model for grep, frontier for plan/review)
- [ ] Full memory stack: episodic + semantic + procedural + graph
- [ ] Public-repo ingestion pipeline on autopilot (AgentReach discover → clone → graphify → skill cards)
- [ ] Weekly eval suite — track improvement over time

### Phase 3 — Deep self-improvement
- [ ] LangSmith / custom evals on benchmark repos; regression alerts
- [ ] DSPy optimization on top failure categories from logged trajectories
- [ ] Optional LoRA fine-tune on verified trajectories (specialize on your stack, not “be Opus”)
- [ ] Cross-tenant skill sharing (opt-in): popular patterns promoted platform-wide

### Phase 4 — Product parity targets
- [ ] **Claude Code parity:** terminal agent, full repo, git, long tasks, resume sessions
- [ ] **Cursor parity:** rules files, background cloud agents, PR per branch, MCP tools

---

## Graphify’s role (critical)

Graphify is not optional decoration — it is the **technical backbone** for *local* repos:

- Before exploration: `graphify query "<task>"` → scoped subgraph
- Dependency questions: `graphify path "A" "B"`
- Concepts: `graphify explain "<concept>"`
- After code changes: `graphify update . --code-only` + `graphify cluster-only .`
- **50 agents** must not each read the whole repo — Graphify assigns **community-scoped** context per agent

**Pair with AgentReach:** Graphify for *your* codebase; AgentReach for *everyone else’s* public code on GitHub.

---

## Orchestration patterns (LangGraph + Deep Agents)

1. **Supervisor graph** — router node picks next agent (LangGraph)
2. **Subagent delegation** — isolated context per subtask (Deep Agents `task()` tool)
3. **Reflection node** — critic returns structured `{ pass, issues[] }`
4. **Human interrupt** — optional approval before push/merge
5. **Checkpointing** — resume long jobs after crash
6. **Parallel fan-out** — map over subtasks (one Graphify community per worker)
7. **Reduce** — integrator merges branches/diffs with conflict policy

---

## Server deployment (people will use it)

| Concern | Approach |
|---------|----------|
| Auth | API keys + OAuth; org accounts |
| Multi-tenant | Isolated sandboxes per user/repo |
| Billing | Token/work-minute metering |
| Storage | S3-compatible for clones, logs, artifacts, ingested repo graphs |
| Secrets | User GitHub tokens encrypted; never in agent logs |
| Rate limits | Per-user concurrent agent cap (e.g. 5–50) |
| AgentReach | Install in worker image; `agent-reach doctor` in health checks |

---

## Success metrics

| Metric | Target |
|--------|--------|
| **Repeat-task success rate** | ↑ week over week on same benchmark tasks (proves self-learning) |
| **Web fetches per repeat task** | ↓ as skill library grows (memory replaces re-research) |
| SWE-bench-style pass rate | Track vs Open SWE / single-agent baseline |
| First-try test pass | ↑ with critic loop + recalled skills |
| Tokens per task | ↓ with Graphify scoped context + skill recall |
| Skill library size | Grows with every ingest + successful job |
| Parallel agents without conflict | ↑ with community partitioning |
| User task completion | Subjective parity with Claude Code for medium repos |

---

## Out of scope (for v1)

- Training a frontier model from scratch
- Claiming “better than Opus 5” without benchmarks
- MPC sampler / AKIRA UI work
- Unsandboxed arbitrary code on host

---

## Immediate next steps (for Claude Code on server)

1. **Create new repository** `ai-agent-platform` (separate from akaimcpsampler).
2. **Evaluate** Open SWE + Deep Agents Code on 3 tasks; pick baseline harness.
3. **Scaffold** Deep Agents supervisor + Graphify + AgentReach + **memory/skill library from day one**.
4. **Prove self-learning loop:** task A (unknown stack) → research → succeed → log skill → task A′ (similar) → recall, no re-research → succeed faster.
5. **Document** agent protocol in `AGENTS.md` + this `GOAL.md`.
6. **Benchmark** improvement: same tasks weekly; track pass rate and token/web-fetch deltas.

---

## One-line goal

> **A self-learning, self-hosted coding platform: 50+ agents that recall past work, research GitHub/YouTube when they don’t know, verify each other, and get smarter every week — Graphify + AgentReach + Deep Agents + LangGraph.**

---

## Key references

| Resource | URL |
|----------|-----|
| AgentReach | https://github.com/Panniantong/Agent-Reach |
| Deep Agents | https://github.com/langchain-ai/deepagents |
| Open SWE | https://github.com/langchain-ai/open-swe |
| Deep Agents Code | https://docs.langchain.com/deepagents-code |
| LangGraph | https://github.com/langchain-ai/langgraph |
| OpenHands | https://github.com/All-Hands-AI/OpenHands |
| Graphify | Project skill at `.claude/skills/graphify/SKILL.md` |

---

*Owner workflow: design on tablet/PC → Claude Code in Ubuntu → push to GitHub → deploy orchestrator on server → iterate with LangSmith evals.*

*Last updated: August 2026*
