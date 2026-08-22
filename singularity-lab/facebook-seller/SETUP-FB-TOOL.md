# Setup: fb_tool (join groups + AI + schedule)

**Repo:** https://github.com/ali8691/fb_tool

**Best for:** joining groups from URLs, generating post text with AI, scheduling tasks.

---

## Requirements

- PC with Python 3.10+
- Google Chrome installed
- Facebook email + password (or manual login once)
- OpenAI API key (optional — for AI post text) — https://platform.openai.com

---

## Install

```bash
git clone https://github.com/ali8691/fb_tool.git
cd fb_tool
python -m venv venv

# Windows
venv\Scripts\activate

# Mac/Linux
source venv/bin/activate

pip install -r requirements.txt
```

Copy `.env` from this kit:

```bash
cp /path/to/singularity-lab/facebook-seller/.env.example fb_tool/.env
```

Edit `.env` — add your Facebook email/password and OpenAI key.

---

## First login

```bash
python cli.py login
```

A Chrome window opens — log in to Facebook if needed.  
**Use HEADLESS_MODE=False** for first runs so you can solve CAPTCHA if Facebook asks.

---

## Join groups slowly

1. Edit **`groups-to-join.txt`** — add one group URL per line (from Facebook search).
2. Edit **`actions-join-groups.csv`** — add one `join-group` row per URL (see file).
3. Run:

```bash
python cli.py bulk-run --csv-path /path/to/actions-join-groups.csv
```

**Join max 5–10 groups per day** — split into multiple CSV runs.

---

## Generate AI post text

```bash
python cli.py generate-ai-text --prompt "Write a Facebook post selling a business in Chiang Mai Thailand. Professional, includes price placeholder, what's included, call to message. Under 150 words."
```

Copy output into `post-template-en.txt` or use directly in FAP.

---

## Schedule repost (every 3 days)

Example — run bulk actions every 72 hours:

```bash
python cli.py schedule-command --command "bulk-run --csv-path actions-post-schedule.csv" --trigger interval --interval-seconds 259200
```

Keep the terminal/PC running, or use Windows Task Scheduler / cron on Linux.

See fb_tool docs for cron syntax: daily at 9am and 6pm:

```bash
python cli.py schedule-command --command "bulk-run --csv-path actions-post-schedule.csv" --trigger cron --cron-expression "0 9,18 * * *"
```

---

## Docker (optional)

```bash
make docker-build
docker run --env-file .env fb_auto_tool login
```

---

## Security

- Never commit `.env` to git
- Prefer **app password** or session cookies if fb_tool supports it in future
- If account gets checkpoint — stop automation 48 hours

---

## Limitations

- fb_tool posts to **pages** via CLI — for **groups**, FAP is easier for posting
- Use fb_tool mainly for: **join-group**, **generate-ai-text**, **schedule**
- Use **FAP** for actual group posting with photos

**Recommended combo:** fb_tool joins groups → FAP posts to them.
