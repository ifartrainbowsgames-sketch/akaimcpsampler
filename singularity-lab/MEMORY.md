# Singularity Lab — Session Memory

> **Claude: read this at session start. Update before session end.**

---

## Last updated

2026-08-17

---

## Current phase

**Phase 0** — scaffold self-learning MVP (memory layer + minimal agent loop)

---

## Environment

| Item | Detail |
|------|--------|
| Device | Android tablet + Termux + proot Ubuntu |
| Project path | `~/singularity lab` |
| Python venv | `.venv/` (Headroom installed) |
| Headroom | Manual proxy on `127.0.0.1:8787` — start each session |
| GitHub user | ifartrainbowsgames-sketch |

---

## What exists in this repo

| Path | Status |
|------|--------|
| `.venv/` | Python virtualenv — Headroom + deps |
| `xfetch/` | Existing subproject — do not break |
| `GOAL.md` | Full platform spec |
| `CLAUDE.md` | Claude session rules |
| `MEMORY.md` | This file — living session state |
| `AGENTS.md` | Agent protocol |
| `src/` | **Not yet** — to be scaffolded |
| `memory/trajectories/` | **Not yet** — JSONL job logs |
| `memory/skills/` | **Not yet** — Markdown skill cards |

---

## Key decisions

- **Self-learning is THE point** — not a Phase 3 feature.
- **Memory before UI** — trajectories + skill cards from day one.
- **Stack:** Deep Agents + LangGraph + AgentReach + Graphify + git-based skills.
- **Repo name on disk:** `singularity lab` (with space).
- **Reference projects to study:** Open SWE, Live-SWE-agent, GitAgent, CORAL, Sprout.

---

## Phase 0 checklist

- [x] Headroom installed; proxy works (`curl http://127.0.0.1:8787/health`)
- [x] GOAL.md, CLAUDE.md, MEMORY.md, AGENTS.md created
- [ ] Monorepo scaffold (`src/`, `memory/`, `tests/`)
- [ ] Memory MVP: `recall_skills()`, `remember_job()`, `write_skill_card()`
- [ ] AgentReach installed (`pip install agent-reach && agent-reach doctor`)
- [ ] Tool wrappers: web_read, github_repo, github_search, youtube_transcript
- [ ] Minimal agent loop: supervisor → recall → act → reflect → remember
- [ ] CLI: `python -m singularity run "task"`
- [ ] **Prove learning:** same task twice — second run uses memory, fewer web fetches

---

## Blockers

_None currently._

---

## Next session — start here

1. Read GOAL.md + this file + AGENTS.md.
2. Inspect `xfetch/` — decide integrate vs keep separate.
3. Create `src/` layout and `memory/trajectories/`, `memory/skills/`.
4. Implement memory MVP first (that's the whole point).
5. Wire AgentReach tools.
6. First working recall → act → remember loop (stubs OK for coding tools).

---

## Session log

### 2026-08-17

- Set up Singularity Lab folder on Termux Ubuntu.
- Installed Headroom; learned proxy needs 2 terminals (don't Ctrl+C proxy).
- Created GOAL.md, CLAUDE.md, MEMORY.md, AGENTS.md.
- Ready to scaffold Phase 0 code.

---

## Notes for Claude

- User wants **50+ self-learning agents** eventually — start with one loop that learns.
- When unsure about architecture, pick the simplest option that supports self-learning.
- Commit to git when user has repo initialized; ask for GitHub remote if missing.
