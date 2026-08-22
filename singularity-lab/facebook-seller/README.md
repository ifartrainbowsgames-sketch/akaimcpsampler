# Facebook Business Seller — Open Source Kit

Sell your **Chiang Mai business** on Facebook using **free/open-source tools**.

**You need a PC or laptop with Chrome** — these tools do not run on tablet/Termux alone.

---

## What this kit does

| Tool | Job |
|------|-----|
| **FAP** (Chrome extension) | Post + photos to all joined groups on a schedule |
| **fb_tool** (Python) | Join groups, AI post text, schedule reposts |
| **Marketplace bot** (optional) | Repost Marketplace listing so it stays visible |

---

## Quick start (30 minutes on a PC)

### Step 1 — Copy this folder to your PC

If you cloned the repo:

```bash
cd singularity-lab/facebook-seller
```

Or download only this folder from GitHub.

### Step 2 — Install FAP (easiest — start here)

Follow **[SETUP-FAP.md](./SETUP-FAP.md)** — post to groups in ~15 minutes.

### Step 3 — Install fb_tool (join groups + AI + schedule)

Follow **[SETUP-FB-TOOL.md](./SETUP-FB-TOOL.md)** — join groups and schedule reposts.

### Step 4 — Edit your listing text

Open **`post-template-en.txt`** and **`post-template-th.txt`** — fill in:

- Business type (restaurant, salon, shop…)
- Location in Chiang Mai
- Asking price
- What's included (lease, equipment, staff, social media)
- Your contact (Line, WhatsApp, Messenger)

### Step 5 — Join groups

Use **`groups-keywords.txt`** to search Facebook → join 10–20 groups.

Add group URLs to **`groups-to-join.txt`** as you join them.

### Step 6 — Run first campaign

1. FAP: load groups → paste post → start campaign (5–10 groups first day)
2. fb_tool: `python cli.py bulk-run --csv-path actions-join-groups.csv` (join only, slow)
3. Repost every **3–5 days**

---

## Files in this kit

| File | Purpose |
|------|---------|
| `SETUP-FAP.md` | Chrome extension install + first post |
| `SETUP-FB-TOOL.md` | Python fb_tool install + join + schedule |
| `SETUP-MARKETPLACE-BOT.md` | Optional repost to Marketplace |
| `post-template-en.txt` | English listing — **edit this** |
| `post-template-th.txt` | Thai listing — **edit this** |
| `groups-keywords.txt` | Search terms for Facebook groups |
| `groups-to-join.txt` | Your group URLs (fill in as you join) |
| `actions-join-groups.csv` | fb_tool: join groups slowly |
| `actions-post-schedule.csv` | fb_tool: scheduled actions template |
| `.env.example` | Copy to `.env` for fb_tool secrets |

---

## Safety rules (avoid Facebook ban)

1. **Max ~20–40 group posts per day** — not 100 at once
2. **Random delays** between posts (FAP has this built in)
3. **Different text** per group (edit slightly or use OpenAI in fb_tool)
4. **Join slowly** — 5–10 new groups per day
5. **Reply to messages yourself** — builds trust, avoids bot flags on Messenger

---

## If nobody messages you

- [ ] Price or "what's included" unclear in post
- [ ] Bad or dark photos — use bright, wide shots
- [ ] Posted in 1–2 groups only — need 15–30 groups
- [ ] Post older than 48h — **repost** (FAP campaign or Marketplace bot)
- [ ] Wrong groups — use business-for-sale groups, not only buy/sell items
- [ ] Also list on [SMERGERS](https://www.smergers.com) for serious buyers

---

## Daily workflow (5 min/day)

1. Check Messenger — reply to every inquiry within 1 hour
2. FAP or fb_tool runs repost on schedule (set once)
3. Join 2–3 new groups per week from `groups-keywords.txt`
4. Update `MEMORY.md` in parent folder if using Claude Code

---

*Singularity Lab — facebook-seller kit*
