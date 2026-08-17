# Autonomous Multi-Agent Coding AI — Project Goal

## Mission

Build a **self-hosted AI coding platform** that people can run on a server — comparable in *capability* to **Claude Code** and **Cursor** — powered by **50+ autonomous agents** that plan, code, verify, and correct their own work.

Target quality bar: **frontier-class coding** (aspiration: Opus-class reasoning and reliability). The system must deploy and coordinate agents at scale, use **Graphify** for deep codebase intelligence, use **Deep Agents + LangGraph** for orchestration and coding harnesses, and use **AgentReach** so agents can learn from the public internet — especially **GitHub**, **YouTube**, and the open web.

**This project is NOT about the MPC sampler UI or AKIRA visuals.** It is about **reading, reasoning, teaching, and creating software with AI.**

---

## What we are building

| Capability | Description |
|------------|-------------|
| **Multi-agent orchestration** | 50+ agents with roles: planner, coder, reviewer, tester, debugger, deployer |
| **Self-control & self-check** | Agents critique each other; loops until tests/lint pass or budget exhausted |
| **Server-hosted service** | API + dashboard; users submit tasks; agents run on server infrastructure |
| **Agent deployment** | Spin up/isolate agent workers (containers/sandboxes); queue jobs; monitor lifecycle |
| **Graphify integration** | Knowledge graph over repos: god nodes, communities, `query` / `path` / `explain` — reduce tokens, improve cross-file reasoning |
| **AgentReach integration** | Web/GitHub/YouTube/social access without paid APIs — agents learn from public code, docs, and tutorials |
| **Claude Code–like UX** | Terminal/agent mode: read repo, edit files, run commands, git, iterative fixes |
| **Cursor-like UX** | IDE integration or web UI: inline edits, project rules, background agents on branches |
| **Teach / improve over time** | Ingest public repos + successful trajectories → eval datasets → optional fine-tuning |

---

## Non-negotiables

1. **Safety & isolation** — each agent run in sandbox (container/VM); no arbitrary host access; secrets in vault/env.
2. **Verifiability** — no “done” without automated checks where possible: build, test, lint, typecheck, optional human gate.
3. **Observability** — every agent step logged (LangSmith or equivalent): prompts, tool calls, diffs, cost, latency.
4. **Graph-first codebase context** — use Graphify before large grep/read sweeps when `graphify-out/` exists.
5. **Web learning is first-class** — agents must reach GitHub, YouTube, and the open web via AgentReach (not only user-supplied code).
6. **Model-agnostic core** — orchestration layer must swap models (Claude, GPT, open weights) without rewriting agents.
7. **Honest quality bar** — Opus-class *behavior* is achieved via **strong base models + multi-agent verification + graph context + web research**, not by pretending a small local model equals frontier reasoning on day one.

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
│    ├─ Research agent (Graphify + AgentReach web/GitHub)     │
│    ├─ Coder agents (N parallel, file-scoped)                │
│    ├─ Critic / reviewer agents                              │
│    ├─ Test runner agent                                     │
│    └─ Integrator / merge agent                              │
└───────────────────────────┬─────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
   Graphify KG          Tool layer         Model router
   (repo graph)     bash, git, read,     Claude / GPT /
                    write, grep, PR      open models
        │                   │                   │
        └───────────────────┴───────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  AgentReach — web, GitHub, YouTube, search, RSS, social       │
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

1. **Discover** — AgentReach finds repos, tutorials, and docs relevant to a task or skill gap.
2. **Ingest** — Clone/index public repos; run `graphify update` on each; store subgraphs + metadata.
3. **Apply** — Coder agents use Graphify-scoped context from ingested repos as reference (not blind copy-paste).
4. **Log** — Successful trajectories (prompt, graph context, web sources, diffs, tests passed) → eval dataset.
5. **Improve** — DSPy prompt optimization and optional fine-tuning on approved trajectories.

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
| **Graph explorer** | Run Graphify; return scoped subgraph + inferred edges |
| **Web researcher** | AgentReach: GitHub repos, YouTube tutorials, docs, Exa search |
| **Implementer** | Write minimal diffs; follow project conventions |
| **Reviewer** | Diff review; security + logic; request changes |
| **Test runner** | Execute test suite; report failures with logs |
| **Fixer** | Patch failures from test/lint output |
| **Doc / rules** | Update CLAUDE.md, AGENTS.md, graphify after structural changes |
| **Deploy** | CI status, PR creation, optional merge (with policy) |

**Self-check loop:**  
`plan → (graphify + web research) → implement → review → test → (fail → fix)* → ship`

---

## Tech stack (proposed)

| Layer | Technology |
|-------|------------|
| Coding harness | **Deep Agents** (planning, subagents, filesystem context) |
| Orchestration runtime | **LangGraph** (stateful graphs, cycles, human-in-the-loop, 50-agent routing) |
| Reference / baseline | **Open SWE**, **Deep Agents Code (`dcode`)** |
| Execution sandbox | **OpenHands** SDK patterns or pluggable containers (Modal/Daytona/E2B) |
| Codebase intelligence | **Graphify** (AST graph, communities, wiki, `graphify update`) |
| Web / GitHub / YouTube | **AgentReach** (`pip install agent-reach`; MCP or tool wrapper) |
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

Frontier models are the **reasoning engine**. Our platform wins on **orchestration + verification + graph context + web research**, not by replacing Opus with a 7B model on day one.

### Phase 0 — Foundation
- [ ] Repo `ai-agent-platform` (new) with monorepo layout
- [ ] Evaluate **Open SWE** and **Deep Agents Code** on 3 benchmark tasks
- [ ] Deep Agents supervisor + 1 coder + 1 critic loop (LangGraph runtime)
- [ ] Tool SDK: `read_file`, `write_file`, `grep`, `run_terminal`, `graphify_query`
- [ ] **AgentReach tools:** `web_read`, `github_repo`, `github_search`, `youtube_transcript`, `web_search`
- [ ] Graphify embedded: auto-run on repo clone; inject subgraph into agent context
- [ ] Single sandbox worker; CLI: `agent run "fix the login bug"`

### Phase 1 — Multi-agent MVP (scale to ~10 agents)
- [ ] Parallel implementers on non-overlapping files (Graphify community detection)
- [ ] Research agent ingests public GitHub repos + YouTube tutorials for unfamiliar stacks
- [ ] Mandatory review + test gate before PR
- [ ] Job queue + 10 concurrent sandboxes
- [ ] Web UI: submit task, watch stream, view diff/PR

### Phase 2 — Scale to 50+ agents
- [ ] Kubernetes autoscaling workers
- [ ] Task partitioner uses Graphify communities/god nodes
- [ ] Cost budgets per job; model routing (cheap model for grep, frontier for plan/review)
- [ ] Agent memory: job-scoped + project-scoped (vector + graph)
- [ ] Public-repo ingestion pipeline (AgentReach discover → clone → graphify → index)

### Phase 3 — Teach the system (continuous improvement)
- [ ] Log successful runs → dataset (prompt, graph context, web sources, diffs, tests passed)
- [ ] LangSmith / custom evals on benchmark repos
- [ ] DSPy or fine-tune router + specialized small agents
- [ ] Optional: fine-tune open coder on *your* trajectories (not “be Opus” — “be good at our stack”)

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
| SWE-bench-style pass rate | Track vs Open SWE / single-agent baseline |
| First-try test pass | ↑ with critic loop |
| Tokens per task | ↓ with Graphify scoped context |
| Web-augmented task success | ↑ when AgentReach finds reference repos/docs |
| Parallel agents without conflict | ↑ with community partitioning |
| User task completion | Subjective parity with Claude Code for medium repos |
| P95 job latency | Acceptable for async (minutes, not hours) |

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
3. **Scaffold** Deep Agents supervisor + Graphify tools + AgentReach tools + Docker sandbox.
4. **Prove one loop:** issue → AgentReach (GitHub/docs) → graphify query → edit → pytest → PR.
5. **Document** agent protocol in `AGENTS.md` + this `GOAL.md`.
6. **Benchmark** against single Claude Code run on same tasks.

---

## One-line goal

> **A self-hosted, Graphify-powered, Deep-Agents-orchestrated army of 50+ self-checking coding agents with AgentReach web/GitHub/YouTube access — delivering Claude Code / Cursor–class results on a server people can actually use.**

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
