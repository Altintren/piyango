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
SCRAPER_API_KEY=<ScraperAPI key>   # opsiyonel — olmadan doğrudan istek yapar
```

No test runner, no linter configured.

## Deployment

- **Frontend**: Firebase Hosting → `cilginpiyango.web.app` — **NOT** auto-deployed; requires `firebase deploy --only hosting` after every push. Firebase CDN caches static assets for 1 hour — bump `?vN` query params on `style.css` and `script.js` in `index.html` after changes. Current versions: `style.css?v=10`, `script.js?v=10`.
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
- **Joker**: independently drawn 7th number from the same 1–90 pool, **after** the 6 main numbers are removed (so joker ≠ any main number). **We do NOT predict a separate joker number.** Joker hit is evaluated by checking whether the drawn joker number appears in our 6 predicted main numbers. Old predictions in DB have `pred.joker` set — backward-compatible evaluation applies.
- **Superstar**: drawn from a completely separate second drum (1–90). Independently predicted via frequency analysis. **Superstar is compared ONLY to the predicted superstar — never to predicted main numbers or the drawn joker.**

**Prediction format**: `{ numbers: [6 sorted ints], joker: null, superstar: int }`

**Superstar isolation rule** (enforced in both `evaluatePrediction` and frontend `renderRecentResults`):
- `actualSet` is always built from `numbers.slice(0, 6)` — guards against old DB records where joker/superstar may have been stored inside `numbers[]`
- `drawnJoker` is set to `null` if `draw.joker === draw.superstar` — prevents superstar value from triggering a joker-hit highlight (indicates a scraper parse error in that record)

## Scraping

Source: `https://www.fotomac.com.tr/sayisal-loto-sonuclari`

- Draw list: `#historylistselect option` — `value` = drawId (int), text = date (DD.MM.YYYY)
- Draw numbers: `.lottery-wins-numbers span` — classified by span count: 6 = numbers only, 7 = +joker, 8 = +joker+superstar
- Prize table: `.lottery-wins-money-item` divs on the same detail page — each has two `<span>` children: first contains category label + winner count `<strong>`, second contains prize amount `<strong>`
- 800ms delay between requests, 3-retry with backoff
- Full historical scrape (~1600 draws) takes ~21 minutes — `/api/update` uses fire-and-forget pattern (responds immediately, runs in background)
- `/api/update/status` — polls the in-memory `updateStatus` object; returns `{ running, message, startedAt }`

**WAF notu:** fotomac.com.tr Volterra/CloudFront WAF kullanıyor. Render ve benzeri datacenter IP'lerini blokluyor. `SCRAPER_API_KEY` ortam değişkeni varsa tüm istekler ScraperAPI üzerinden (`http://api.scraperapi.com?api_key=KEY&url=...`) yapılır. Render'da Environment Group ile hem `MONGODB_URI` hem `SCRAPER_API_KEY` tanımlı.

## Auto-Update Schedule

Two-layer cron system (Istanbul timezone):

| Cron | Schedule | Purpose |
|---|---|---|
| `0 22,23 * * 1,3,6` | Mon/Wed/Sat 22:00–23:00 | Hourly lightweight check after draw |
| `0 0-3 * * 0,2,4` | Sun/Tue/Thu 00:00–03:00 | Hourly lightweight check (midnight carry-over) |
| `0 4 * * 0,2,4` | Sun/Tue/Thu 04:00 | Full backup update |

**Lightweight check** (`checkForNewDraw`): Fetches only the draw list (one HTTP request), compares latest `drawId` on site vs DB. Triggers full `updateResults()` only if a new draw is found. Also available as `/api/check` for manual triggering.

## ML Learning Cycle

Triggered after new draws are saved (`learnFromNewDraw`). Order matters:

1. **Evaluate** (`evaluatePrediction`) — scores pending prediction against the new draw
2. **Analyze** (`createAnalysisLog`) — computes component performance for this draw, derives new dynamic weights, saves AnalysisLog
3. **Train** (`trainFromScratch`) — rebuilds ModelWeights using the fresh dynamic weights from step 2
4. **Predict** (`generateAndSavePrediction`) — generates 3 new predictions

**Weight formula:**
```
score = baseFreq×W.base + recentFreq×W.recent + dayFreq×W.day + hitRate×0.10
```
Weights are **dynamic** — computed from the last 30 `AnalysisLog` entries. Default (before enough data): `base=0.30, recent=0.40, day=0.20`. After backfill on ~1600 draws: `base≈0.06, recent≈0.67, day≈0.17`.

- `recentFreq`: last 50 draws window
- `dayFreq`: frequency on the next draw's day-of-week (Mon=1, Wed=3, Sat=6)
- `hitRate`: weighted — `accumulatedHitScore / (predictedCount × 9.5)`, normalized 0–1. Each number accumulates the `totalHitScore` of every prediction it appeared in. MAX_SCORE = 9.5 (6 main + 1.5 joker + 2.0 superstar). Fixed weight 0.10.

**Training includes 6 main numbers + joker** — same 1–90 pool, so joker contributes to frequency analysis. Superstar has its own separate frequency map in `predictor.js`. `ModelWeights` tracks main+joker frequency for numbers 1–90.

**Component performance analysis** (`createAnalysisLog`): For each draw, all 90 numbers are ranked by each component. The drawn numbers' average percentile rank in each component is recorded (0.5 = random baseline). `computeDynamicWeights()` averages last 30 logs, subtracts 0.5 baseline, normalizes to sum=0.90 for frequency components. Min weight per component: 0.05, max: 0.70.

## Prediction Constraints

Generated combinations are rejected if they:
1. Fail balance check: fewer than 2 odd, fewer than 2 even, or sum outside 80–180
2. Already exist in the historical draw database (existingCombos)
3. Duplicate another prediction in the same batch (usedCombos)

Three fallback tiers apply progressively if all 200 balanced attempts fail.

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/predictions` | Active pending prediction |
| GET | `/api/performance` | Evaluated prediction stats |
| GET | `/api/stats` | Total draws, latest draw, model confidence |
| GET | `/api/results/recent` | Last 3 draws with per-prediction prize evaluation |
| GET | `/api/update` | Fire-and-forget full update (responds immediately) |
| GET | `/api/update/status` | Current update progress (poll while running) |
| GET | `/api/check` | Lightweight new-draw check |
| GET | `/api/analysis` | Component performance averages + current dynamic weights |
| GET | `/api/analyze/backfill` | One-time backfill: creates AnalysisLog entries for last 30 historical draws. Idempotent — skips if logs already exist. Already ran on 2026-05-23. |

## Data Models

### `Result`
- `drawId`, `drawDate`, `numbers[]`, `joker`, `superstar`
- `prizeTable[]` — `{ category, winnersCount, prizeAmount }` scraped from fotomac at save time. Empty `[]` for draws scraped before this feature was added.

### `Prediction`
- `status`: `'pending'` → `'evaluated'`
- `predictions[]` — 3 entries, each with `{ numbers[], joker, superstar }`
- `evaluationResults[]` — after evaluation: `{ predictionIndex, numbersHit, jokerHit, superstarHit, totalHitScore, prizeCategory, prizeAmount }`
- `prizeCategory`/`prizeAmount` are `null` for draws evaluated before prize table scraping was added

### `ModelWeights`
- Per-number (1–90): `score`, `totalAppearances`, `totalDraws`, `recentAppearances`, `dayWeights`, `dayDrawCounts`
- Feedback fields: `predictedCount`, `accumulatedHitScore` (replaces old `hitCount` — accumulates `totalHitScore` of predictions containing this number)

### `AnalysisLog`
- Stats: `totalDrawsInDB`, `avgHitScore`, `avgNumbersHit`, `bestEverHitScore`, `topNumbersSnapshot`, `topJokersSnapshot`, `topSuperstarsSnapshot`
- `componentPerformance`: `{ baseFreq, recentFreq, dayFreq }` each with `{ avgPercentile }` — how well the component ranked drawn numbers (0.5 = random)
- `dynamicWeights`: `{ baseFreq, recentFreq, dayFreq, hitRate }` — weights used for the next `trainFromScratch()`

### Prize Categories (14 tiers, priority order)
`6+SüperStar` → `6` → `5+1+SüperStar` → `5+1` → `5+SüperStar` → `5` → `4+SüperStar` → `4` → `3+SüperStar` → `3` → `2+SüperStar` → `2` → `1+SüperStar` → `0+SüperStar` → null

## MongoDB

- Atlas cluster, database name: `lotodb`
- Local `.env` URI must include `/lotodb` at the end of the connection string, otherwise Mongoose defaults to the `test` database.
- `Result.drawId` has a unique index — duplicate inserts are caught by `err.code === 11000` and skipped.
- Concurrent update runs are blocked via `updateStatus.running` flag in `lotteryController.js`.
