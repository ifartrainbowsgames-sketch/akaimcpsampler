# Singularity Lab — Agent Protocol

Rules for all agents in the Singularity Lab platform (and for Claude while building it).

---

## Core principle

**Every agent run must feed the learning loop.** No silent completions.

```
recall → (discover if gap) → plan → implement → review → test → reflect → remember
```

---

## Agent roles (Phase 0 → scale)

| Agent | Responsibility | Tools |
|-------|----------------|-------|
| **Supervisor** | Decompose task; route to agents; enforce budget | recall, assign |
| **Researcher** | Fill knowledge gaps **before asking user** | AgentReach, Graphify |
| **Planner** | Steps + file scope from recalled skills + graph | recall, graphify_query |
| **Implementer** | Minimal diffs; follow conventions | read, write, grep, shell |
| **Reviewer** | Security, logic, style; `{ pass, issues[] }` | diff, graphify_path |
| **Tester** | Run tests/lint; return logs | shell, pytest/npm test |
| **Fixer** | Patch from test/lint output | write, shell |
| **Learner** | Distill trajectories → skill cards; trigger ingest | remember, write_skill |

Phase 0 minimum: **Supervisor + Implementer + Learner** (Reviewer optional stub).

---

## Self-learning protocol (mandatory)

### Before every task — RECALL

1. Search `memory/skills/*.md` for matching patterns/stacks.
2. Search `memory/trajectories/*.jsonl` for similar past jobs.
3. If Graphify available: `graphify query "<task>"`.
4. Inject top matches into planner context.

### On knowledge gap — DISCOVER (before user)

1. `web_search(query)` — Exa via AgentReach.
2. `github_search(query)` — public repos.
3. `github_repo(owner/repo)` — read reference code.
4. `youtube_transcript(url)` — tutorials.
5. `web_read(url)` — docs.
6. Clone + graphify ingest if repo is valuable.
7. Write draft skill card from findings.

### After every task — REMEMBER

1. Append full trajectory to `memory/trajectories/<date>-<id>.jsonl`:
   - prompt, tools called, diffs, test results, outcome, web sources used.
2. If success (or recovered after failure): **Learner** writes/updates `memory/skills/<topic>.md`.
3. If failure: write **failure card** — error, fix that worked, link to trajectory.

### Skill card format (`memory/skills/*.md`)

```markdown
# Skill: <title>

## Stack / tags
fastapi, pytest, auth, ...

## When to use
<trigger conditions>

## Pattern
<steps or code pattern>

## Failure modes
- Error X → check Y

## Sources
- github.com/...
- Learned from job: trajectories/2026-08-17-001.jsonl

## Last verified
2026-08-17
```

---

## When agents must NOT ask the user

- Unknown library/framework → research GitHub + docs first.
- Repeated stack question → recall skills first.
- Test failure → fixer loop before escalating.

## When agents MAY ask the user

- Missing API keys / secrets.
- Ambiguous product decision (feature A vs B).
- Research exhausted with evidence of what was tried.

---

## Tool registry (target)

### Memory

| Tool | Description |
|------|-------------|
| `recall_skills(query, k=5)` | Search skills + recent trajectories |
| `remember_job(trajectory)` | Append JSONL log |
| `write_skill_card(path, content)` | Create/update skill markdown |

### AgentReach

| Tool | Description |
|------|-------------|
| `web_read(url)` | Jina Reader → markdown |
| `github_repo(owner/repo)` | Public repo via `gh` |
| `github_search(query)` | GitHub search |
| `youtube_transcript(url)` | Subtitles via yt-dlp |
| `web_search(query)` | Exa semantic search |

### Graphify

| Tool | Description |
|------|-------------|
| `graphify_query(task)` | Scoped subgraph for task |
| `graphify_path(a, b)` | Dependency path |
| `graphify_explain(concept)` | Concept wiki |
| `graphify_update()` | Reindex after changes |

### Code (standard)

| Tool | Description |
|------|-------------|
| `read_file`, `write_file`, `grep`, `run_terminal` | Sandbox-scoped |

---

## Verification gate

**No job is "done" without:**

- [ ] Tests pass (or explicit "no tests" documented).
- [ ] Lint/typecheck if configured.
- [ ] Trajectory logged.
- [ ] Skill card written if reusable pattern emerged.
- [ ] MEMORY.md updated if building platform (Claude session).

---

## Success metric (proves self-learning)

Run **the same task type twice**:

| Run | Expected |
|-----|----------|
| 1st | May research web/GitHub; slower |
| 2nd | Recalls skill; **fewer web fetches**; faster; may skip research |

Track in MEMORY.md and trajectory metadata: `web_fetches_count`, `skills_recalled`.

---

## Reference repos (study, don't copy blindly)

| Repo | Learn |
|------|-------|
| [Agent-Reach](https://github.com/Panniantong/Agent-Reach) | Web/GitHub/YouTube tools |
| [deepagents](https://github.com/langchain-ai/deepagents) | Coding harness |
| [open-swe](https://github.com/langchain-ai/open-swe) | Async PR agent |
| [gitagent](https://github.com/open-gitagent/gitagent) | Skills in git |
| [live-swe-agent](https://github.com/OpenAutoCoder/live-swe-agent) | Runtime self-evolve |
| [CORAL](https://github.com/Human-Agent-Society/Coral) | Multi-agent evolution + grading |

---

*Singularity Lab — agents that teach themselves.*
