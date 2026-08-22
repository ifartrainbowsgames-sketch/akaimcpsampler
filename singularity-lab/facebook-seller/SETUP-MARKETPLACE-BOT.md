# Setup: Marketplace repost bot (optional)

**Repo:** https://github.com/GeorgiKeranov/facebook-marketplace-bot

**Why:** Deletes and reposts your Marketplace listing so it appears at the top again — more views when nobody messages you.

---

## Requirements

- Python 3 + pip
- Chrome + ChromeDriver (Selenium)
- PC (Windows/Mac/Linux)

---

## Install

```bash
git clone https://github.com/GeorgiKeranov/facebook-marketplace-bot.git
cd facebook-marketplace-bot
pip install -r requirements.txt
```

Follow the repo README for ChromeDriver setup on your OS.

---

## Configure

1. Open folder `csvs/`
2. Edit `items.csv` — add your business listing:

| Column | Example |
|--------|---------|
| Title | Restaurant for sale — Hang Dong, Chiang Mai |
| Price | 3500000 |
| Description | (from post-template-en.txt) |
| Photos Folder | C:\Pictures\business-sale |
| Photos Names | front.jpg;interior.jpg;kitchen.jpg |
| Groups | Business for sale Chiang Mai;Chiang Mai expats |

**Groups column:** exact group names separated by `;` — must match Facebook group names.

3. First run: log in manually when browser opens (pickle saves session).

---

## Run

```bash
python main.py
```

Bot removes old listing with same title and reposts fresh.

**Schedule:** run every **3–5 days** via cron or Task Scheduler.

---

## Note for business sales

Marketplace is built for **items**. For a **whole business**, groups + SMERGERS often work better.  
Use this bot to **boost visibility** of a Marketplace listing, not as your only channel.

Also list at: https://www.smergers.com
