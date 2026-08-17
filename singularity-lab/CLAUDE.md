# Singularity Lab — Claude Code instructions

Read these files at the **start of every session**:

1. **GOAL.md** — full project spec (self-learning AI coding platform)
2. **MEMORY.md** — current state, progress, blockers (**update before ending session**)
3. **AGENTS.md** — agent roles and self-learning loop protocol

---

## Project identity

| Field | Value |
|-------|-------|
| **Name** | Singularity Lab |
| **Folder** | `~/singularity lab` (note the space — always quote paths) |
| **Mission** | Self-learning, self-hosted multi-agent coding AI |
| **Core loop** | recall → discover (AgentReach) → act → reflect → remember |
| **NOT** | MPC sampler, AKIRA visuals, unrelated UI work |

---

## Stack (Phase 0)

| Layer | Tool |
|-------|------|
| Self-learning | `memory/trajectories/` + `memory/skills/` |
| Orchestration | Deep Agents + LangGraph |
| Web / GitHub / YouTube | AgentReach (`pip install agent-reach`) |
| Code intelligence | Graphify |
| Dev env | Termux + proot Ubuntu, `.venv`, Headroom proxy optional |

---

## Rules

1. **Self-learning is mandatory** — write to memory after every completed job.
2. **Research before asking** — unknown stack → AgentReach (GitHub, YouTube, web) first.
3. **Memory first** — build `recall` / `remember` / skill cards before fancy UI.
4. **Small commits** — clear messages; explain what changed after each step.
5. **Tablet-friendly** — prefer pip; avoid Docker in Phase 0 unless necessary.
6. **No paid APIs required** — AgentReach + `gh` + `yt-dlp` for web access.
7. **Don't break `xfetch/`** — existing subproject; integrate or isolate cleanly.

---

## Headroom (optional token compression)

Proxy runs manually on tablet (no systemd):

```bash
# Terminal 1 — keep open
cd ~/"singularity lab" && source .venv/bin/activate && headroom proxy --port 8787

# Terminal 2
cd ~/"singularity lab" && source .venv/bin/activate && headroom wrap claude
```

---

## End-of-session ritual

Before stopping, **update MEMORY.md** with:

- Date and what was built
- Current repo structure
- Decisions made (and why)
- Blockers
- Exact next steps for the next session

---

## Start prompt (if user says "continue")

```
Read GOAL.md, MEMORY.md, and AGENTS.md.
Continue from MEMORY.md "Next session" section.
Update MEMORY.md before stopping.
```
