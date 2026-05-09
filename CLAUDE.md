# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Two Separate Git Repositories

This project has **two independent git repos** that must be pushed separately:

| Repo | Path | Remote | Branch mapping |
|---|---|---|---|
| Frontend | `c:\Users\altin\Piyango\` | `github.com/Altintren/piyango.git` | `git push origin main:master` |
| Backend  | `c:\Users\altin\Piyango\functions\` | `github.com/Altintren/piyango-backend.git` | `git push origin main` |

Always check which repo the changed file belongs to before committing.

## Running the Backend

```bash
cd functions
npm start          # node index.js (ESM, Node 20.x)
```

Requires a `.env` file in `functions/` with:
```
MONGODB_URI=<MongoDB Atlas connection string>
```

No test runner, no linter configured.

## Deployment

- **Frontend**: Firebase Hosting → `cilginpiyango.web.app` (auto-deploys from `piyango.git`)
- **Backend**: Render → `piyango-backend.onrender.com` (auto-deploys from `piyango-backend.git` on push to `main`)

## Architecture

### Frontend (`public/`)
Static HTML/CSS/JS — no build step. Calls the Render backend API. Draw days (Çarşamba and Cumartesi) are computed client-side in `script.js` to set the prediction section title.

### Backend (`functions/`)
Express + Mongoose + Cheerio, ESM modules (`"type": "module"`).

```
functions/
  index.js                    # Entry: MongoDB connect, Express, cron start
  routes/api.js               # Route definitions
  controllers/
    lotteryController.js      # All business logic + HTTP handlers
  models/
    Result.js                 # Scraped draw results
    Prediction.js             # Generated predictions (pending → evaluated lifecycle)
    ModelWeights.js           # Per-number trained weights (1–90)
    AnalysisLog.js            # Per-training-run stats snapshot
  services/
    scraper.js                # Cheerio scraper → fotomac.com.tr
    learner.js                # Training, evaluation, analysis log
    predictor.js              # Prediction generation + save
  jobs/cronJob.js             # node-cron: Sun+Mon+Thu 04:00 Istanbul
```

## Sayısal Loto Game Rules (Critical for Model Correctness)

Draws happen **Monday, Wednesday, Saturday at 21:30**.

- **6 main numbers**: drawn from 1–90, stored sorted ascending (draw order is lost).
- **Joker**: independently drawn 7th number from the same 1–90 pool, **after** the 6 main numbers are removed (so joker ≠ any main number). Predicted via frequency analysis; predicted joker is always excluded from the 6 predicted main numbers.
- **Superstar**: drawn from a completely separate second drum (1–90). Optional extra bet, independently predicted via frequency analysis.

## Scraping

Source: `https://www.fotomac.com.tr/sayisal-loto-sonuclari`

- Draw list: `#historylistselect option` — `value` = drawId (int), text = date (DD.MM.YYYY)
- Draw numbers: `.lottery-wins-numbers span` — classified by span count: 6 = numbers only, 7 = +joker, 8 = +joker+superstar
- 800ms delay between requests, 3-retry with backoff
- Full historical scrape (~1600 draws) takes ~21 minutes — `/api/update` uses fire-and-forget pattern (responds immediately, runs in background)

## ML Learning Cycle

Triggered after new draws are saved (`learnFromNewDraw`):

1. **Evaluate** pending prediction against the new draw result
2. **Train** (`trainFromScratch`) — rebuilds all ModelWeights from full history
3. **Log** (`createAnalysisLog`) — snapshots stats to AnalysisLog
4. **Predict** (`generateAndSavePrediction`) — generates 3 new predictions

**Weight formula:**
```
score = baseFreq×0.30 + recentFreq×0.40 + dayFreq×0.20 + hitRate×0.10
```
- `recentFreq`: last 50 draws window
- `dayFreq`: frequency on the next draw's day-of-week (Wed=3, Sat=6)
- `hitRate`: historical hit rate from evaluated predictions

**Training uses only the 6 main numbers** — joker and superstar each have their own separate frequency maps in predictor.js; ModelWeights tracks only main numbers.

## Prediction Constraints

Generated combinations are rejected if they:
1. Fail balance check: fewer than 2 odd, fewer than 2 even, or sum outside 80–180
2. Already exist in the historical draw database (existingCombos)
3. Duplicate another prediction in the same batch (usedCombos)

Three fallback tiers apply progressively if all 200 balanced attempts fail.

## MongoDB

- Atlas cluster, database name: `lotodb`
- `Result.drawId` has a unique index — duplicate inserts are caught by `err.code === 11000` and skipped.
- The `isUpdating` flag in `lotteryController.js` prevents concurrent update runs.
