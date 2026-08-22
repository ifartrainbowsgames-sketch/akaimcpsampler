# Setup: FAP Facebook Auto Poster (Chrome)

**Best for:** posting photos + text to many groups you already joined.

**Repo:** https://github.com/Tigerzplace/FAP-FacebookAutoPoster

---

## Requirements

- Windows, Mac, or Linux PC
- Google Chrome (or Brave / Edge)
- Facebook account logged in on that browser

---

## Install (10 minutes)

### 1. Download FAP

```bash
git clone https://github.com/Tigerzplace/FAP-FacebookAutoPoster.git
cd FAP-FacebookAutoPoster
```

Or download ZIP from GitHub and unzip.

### 2. Load in Chrome

1. Open Chrome → go to `chrome://extensions`
2. Turn **Developer mode** ON (top right)
3. Click **Load unpacked**
4. Select the folder that contains `manifest.json`

### 3. License (optional)

FAP may ask you to check license at [tigerzplace.com](https://tigerzplace.com) (~$10 for 6 months).  
You can test the extension first — read their site for current free tier.

### 4. Pin the extension

Click the puzzle icon → pin **FAP** to your toolbar.

---

## First campaign — sell your business

### 1. Prepare post

Edit `post-template-en.txt` in this folder. Copy the final text.

Prepare **3–5 photos**:
- Shop front / sign
- Interior
- Equipment or products
- Location context

### 2. Join groups first (manual)

Search Facebook using words from `groups-keywords.txt`.  
Join **10 groups** before your first campaign.

Write URLs in `groups-to-join.txt`.

### 3. Create campaign in FAP

1. Open Facebook in Chrome (logged in)
2. Click **FAP** extension icon
3. **Load groups** — select groups you want (start with 5–10)
4. Paste your post text
5. **Attach photos**
6. Set delays: use **Smart delay** or **1–3 min** between groups (not 5 seconds)
7. Optional: enable **caption rotation** — slightly different text per group
8. Click **Start**

### 4. Schedule reposts

In FAP:
- Save campaign
- Schedule to repeat every **3–5 days**
- Or run manually twice per week

---

## Tips

- Run campaigns when you're at the PC — browser tab must stay open
- If a group fails (admin approval required), remove it from list
- Start small (5 groups) → increase to 20+ over a week
- Use both English and Thai posts on alternate days (two saved campaigns)

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Extension not loading | Reload unpacked; check manifest.json path |
| Groups not loading | Refresh Facebook; re-open extension |
| Post rejected | Group may ban business ads — read group rules |
| Account restricted | Stop 48h; reduce posts per day; increase delays |

---

Next: **[SETUP-FB-TOOL.md](./SETUP-FB-TOOL.md)** for auto-join + OpenAI post variants.
