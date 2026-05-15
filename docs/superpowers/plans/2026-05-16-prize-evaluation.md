# Prize Evaluation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Yeni çekilişler kaydedildiğinde ödül tablosunu da scrape edip DB'ye yaz; tahminleri ödül kategorilerine göre değerlendir; frontend'de son 3 çekiliş sonuçlarını göster.

**Architecture:** `fetchDrawDetails` aynı HTTP isteğinde prize table'ı da parse eder ve `Result`'a kaydeder. Evaluation sırasında `determinePrizeCategory` fonksiyonu ödül kategorisini hesaplar ve `Prediction.evaluationResults`'a yazar. Yeni `/api/results/recent` endpoint'i son 3 draw + değerlendirme verisini döndürür; frontend bu veriyi yeni bir section'da gösterir.

**Tech Stack:** Node.js ESM, Express, Mongoose, Cheerio — mevcut stack. Test runner yok; doğrulama manuel (curl + Render logs).

---

## Dosya Haritası

| Dosya | Repo | Değişiklik |
|---|---|---|
| `functions/models/Result.js` | backend | `prizeTable` alanı ekle |
| `functions/models/Prediction.js` | backend | `prizeCategory`, `prizeAmount` ekle |
| `functions/services/scraper.js` | backend | `fetchDrawDetails` prize table parse |
| `functions/services/learner.js` | backend | `determinePrizeCategory` + evaluation genişlet |
| `functions/controllers/lotteryController.js` | backend | `updateResults` + `getRecentResults` |
| `functions/routes/api.js` | backend | `/api/results/recent` route |
| `public/index.html` | frontend | yeni section |
| `public/style.css` | frontend | result card stilleri |
| `public/script.js` | frontend | `renderRecentResults` + loadAll güncelle |

---

## Task 1: Result modeline prizeTable ekle

**Files:**
- Modify: `functions/models/Result.js`

- [ ] **Step 1: Result.js'i guncelle**

`functions/models/Result.js` dosyasini tamamen su icerikle degistir:

```js
import mongoose from 'mongoose';

const prizeItemSchema = new mongoose.Schema({
  category:     String,
  winnersCount: Number,
  prizeAmount:  String,
}, { _id: false });

const resultSchema = new mongoose.Schema({
  drawId:   { type: Number, required: true, unique: true },
  drawDate: { type: String, required: true },
  numbers:  {
    type: [Number],
    required: true,
    validate: { validator: v => v.length === 6, message: 'numbers dizisi tam 6 eleman icermeli' },
  },
  joker:      { type: Number, default: null },
  superstar:  { type: Number, default: null },
  prizeTable: { type: [prizeItemSchema], default: [] },
}, { timestamps: true });

export default mongoose.model('Result', resultSchema);
```

- [ ] **Step 2: Commit**

```bash
cd functions
git add models/Result.js
git commit -m "feat: add prizeTable field to Result model"
```

---

## Task 2: Prediction modeline prizeCategory ve prizeAmount ekle

**Files:**
- Modify: `functions/models/Prediction.js`

- [ ] **Step 1: evaluationResultSchema'ya iki alan ekle**

`functions/models/Prediction.js` dosyasini tamamen su icerikle degistir:

```js
import mongoose from 'mongoose';

const evaluationResultSchema = new mongoose.Schema({
  predictionIndex: Number,
  numbersHit:      Number,
  jokerHit:        Boolean,
  superstarHit:    Boolean,
  totalHitScore:   Number,
  prizeCategory:   { type: String, default: null },
  prizeAmount:     { type: String, default: null },
}, { _id: false });

const predictionSchema = new mongoose.Schema({
  status:    { type: String, enum: ['pending', 'evaluated'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
  predictions: [{
    numbers:   [Number],
    joker:     { type: Number, default: null },
    superstar: { type: Number, default: null },
    _id: false,
  }],
  modelConfidence: Number,

  evaluatedAgainstDrawId: { type: Number, default: null },
  evaluatedAt:            { type: Date,   default: null },
  evaluationResults:      { type: [evaluationResultSchema], default: [] },
  bestHitScore:           { type: Number, default: null },
  averageHitScore:        { type: Number, default: null },
});

export default mongoose.model('Prediction', predictionSchema);
```

- [ ] **Step 2: Commit**

```bash
git add models/Prediction.js
git commit -m "feat: add prizeCategory and prizeAmount to evaluationResultSchema"
```

---

## Task 3: Scraper'i prize table parse edecek sekilde genislet

**Files:**
- Modify: `functions/services/scraper.js`

- [ ] **Step 1: fetchDrawDetails'i guncelle**

`functions/services/scraper.js` dosyasini tamamen su icerikle degistir:

```js
import axios from 'axios';
import * as cheerio from 'cheerio';

const BASE_URL = 'https://www.fotomac.com.tr/sayisal-loto-sonuclari';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const { data } = await axios.get(url, { timeout: 15000 });
      return data;
    } catch (err) {
      if (attempt === retries - 1) throw err;
      await sleep(1500 * (attempt + 1));
    }
  }
}

export async function fetchDrawList() {
  const html = await fetchWithRetry(`${BASE_URL}/`);
  const $ = cheerio.load(html);

  const draws = [];
  $('#historylistselect option').each((_, el) => {
    const raw  = $(el).attr('value');
    const date = $(el).text().trim();
    const id   = Number(raw);

    if (!raw || isNaN(id) || id <= 0) return;
    draws.push({ id, date });
  });

  if (draws.length === 0) throw new Error('Hic cekilis option bulunamadi.');
  return draws;
}

export async function fetchDrawDetails(drawId) {
  await sleep(800);
  const html = await fetchWithRetry(`${BASE_URL}/${drawId}`);
  const $ = cheerio.load(html);

  const allNums = [];
  $('.lottery-wins-numbers span').each((_, el) => {
    const n = Number($(el).text().trim());
    if (Number.isInteger(n) && n >= 1 && n <= 99) allNums.push(n);
  });

  if (allNums.length < 6) {
    throw new Error(`Gecersiz numara sayisi: ${allNums.length} (drawId: ${drawId})`);
  }

  const prizeTable = [];
  $('.lottery-wins-money-item').each((_, el) => {
    const spans = $(el).find('span');
    if (spans.length < 2) return;

    const categoryRaw  = $(spans[0]).clone().find('strong').remove().end().text().trim();
    const category     = categoryRaw.replace(/\s+/g, ' ').replace(/:$/, '').trim();
    const winnersText  = $(spans[0]).find('strong').text().trim().replace(/\./g, '');
    const winnersCount = isNaN(Number(winnersText)) ? 0 : Number(winnersText);
    const prizeAmount  = $(spans[1]).find('strong').text().trim();

    if (category && prizeAmount) {
      prizeTable.push({ category, winnersCount, prizeAmount });
    }
  });

  return {
    numbers:    allNums.slice(0, 6),
    joker:      allNums.length >= 7 ? allNums[6] : null,
    superstar:  allNums.length >= 8 ? allNums[7] : null,
    prizeTable,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add services/scraper.js
git commit -m "feat: parse prize table in fetchDrawDetails"
```

---

## Task 4: Learner'a determinePrizeCategory ve prize lookup ekle

**Files:**
- Modify: `functions/services/learner.js`

- [ ] **Step 1: determinePrizeCategory yardimci fonksiyonunu ekle**

`learner.js` icinde, `getDayOfWeek` fonksiyonundan hemen sonrasina su fonksiyonu ekle:

```js
function determinePrizeCategory(numbersHit, jokerHit, superstarHit) {
  if (numbersHit === 6 && superstarHit)            return '6+SüperStar bilen kişi sayısı';
  if (numbersHit === 6)                             return '6 bilen kişi sayısı';
  if (numbersHit === 5 && jokerHit && superstarHit) return '5+1+SüperStar bilen kişi sayısı';
  if (numbersHit === 5 && jokerHit)                 return '5+1 bilen kişi sayısı';
  if (numbersHit === 5 && superstarHit)             return '5+SüperStar bilen kişi sayısı';
  if (numbersHit === 5)                             return '5 bilen kişi sayısı';
  if (numbersHit === 4 && superstarHit)             return '4+SüperStar bilen kişi sayısı';
  if (numbersHit === 4)                             return '4 bilen kişi sayısı';
  if (numbersHit === 3 && superstarHit)             return '3+SüperStar bilen kişi sayısı';
  if (numbersHit === 3)                             return '3 bilen kişi sayısı';
  if (numbersHit === 2 && superstarHit)             return '2+SüperStar bilen kişi sayısı';
  if (numbersHit === 2)                             return '2 bilen kişi sayısı';
  if (numbersHit === 1 && superstarHit)             return '1+SüperStar bilen kişi sayısı';
  if (superstarHit)                                 return '0+SüperStar bilen kişi sayısı';
  return null;
}
```

- [ ] **Step 2: evaluatePrediction fonksiyonunu guncelle**

`learner.js` icindeki `evaluatePrediction` fonksiyonunu tamamen su kod ile degistir:

```js
async function evaluatePrediction(prediction, actualDraw) {
  const actualSet = new Set(actualDraw.numbers);
  const prizeMap  = new Map((actualDraw.prizeTable || []).map(p => [p.category, p.prizeAmount]));

  const evaluationResults = prediction.predictions.map((pred, idx) => {
    const numbersHit    = pred.numbers.filter(n => actualSet.has(n)).length;
    const jokerHit      = actualDraw.joker     != null && pred.joker     === actualDraw.joker;
    const superstarHit  = actualDraw.superstar != null && pred.superstar === actualDraw.superstar;
    const totalHitScore = numbersHit + (jokerHit ? 1.5 : 0) + (superstarHit ? 2.0 : 0);
    const prizeCategory = determinePrizeCategory(numbersHit, jokerHit, superstarHit);
    const prizeAmount   = prizeCategory ? (prizeMap.get(prizeCategory) ?? null) : null;
    return { predictionIndex: idx, numbersHit, jokerHit, superstarHit, totalHitScore, prizeCategory, prizeAmount };
  });

  const scores = evaluationResults.map(e => e.totalHitScore);

  await Prediction.findByIdAndUpdate(prediction._id, {
    status:                  'evaluated',
    evaluatedAgainstDrawId:  actualDraw.drawId,
    evaluatedAt:             new Date(),
    evaluationResults,
    bestHitScore:            Math.max(...scores),
    averageHitScore:         scores.reduce((a, b) => a + b, 0) / scores.length,
  });

  const hitTracker = new Map();
  for (const pred of prediction.predictions) {
    for (const n of pred.numbers) {
      const cur = hitTracker.get(n) || { predicted: 0, hits: 0 };
      cur.predicted += 1;
      if (actualSet.has(n)) cur.hits += 1;
      hitTracker.set(n, cur);
    }
  }

  const hitOps = [];
  for (const [number, { predicted, hits }] of hitTracker) {
    hitOps.push({
      updateOne: {
        filter: { number },
        update: { $inc: { predictedCount: predicted, hitCount: hits } },
        upsert: true,
      },
    });
  }
  if (hitOps.length > 0) await ModelWeights.bulkWrite(hitOps);

  console.log(`Tahmin degerlendirildi. En iyi skor: ${Math.max(...scores)}`);
}
```

- [ ] **Step 3: Commit**

```bash
git add services/learner.js
git commit -m "feat: add prize category evaluation to learner"
```

---

## Task 5: Controller'a prizeTable kaydi ve getRecentResults ekle

**Files:**
- Modify: `functions/controllers/lotteryController.js`

- [ ] **Step 1: updateResults icinde Result.create'e prizeTable ekle**

`lotteryController.js` icinde `Result.create` cagrisini bul ve `prizeTable` alanini ekle:

```js
const result = await Result.create({
  drawId:     draw.id,
  drawDate:   draw.date,
  numbers:    details.numbers,
  joker:      details.joker,
  superstar:  details.superstar,
  prizeTable: details.prizeTable,
});
```

- [ ] **Step 2: getRecentResults fonksiyonunu ekle**

`getStats` fonksiyonunun hemen altina su fonksiyonu ekle:

```js
export async function getRecentResults() {
  const recentDraws = await Result.find({}, 'drawId drawDate numbers joker superstar')
    .sort({ drawId: -1 })
    .limit(3);

  const results = await Promise.all(recentDraws.map(async (draw) => {
    const prediction = await Prediction.findOne(
      { evaluatedAgainstDrawId: draw.drawId },
      'predictions evaluationResults'
    );

    let evaluation = null;
    if (prediction) {
      evaluation = {
        predictions: prediction.predictions.map((pred, i) => {
          const er = (prediction.evaluationResults || []).find(e => e.predictionIndex === i) || {};
          return {
            index:         i,
            numbers:       pred.numbers,
            joker:         pred.joker,
            superstar:     pred.superstar,
            prizeCategory: er.prizeCategory ?? null,
            prizeAmount:   er.prizeAmount   ?? null,
          };
        }),
      };
    }

    return {
      drawId:    draw.drawId,
      drawDate:  draw.drawDate,
      numbers:   draw.numbers,
      joker:     draw.joker,
      superstar: draw.superstar,
      evaluation,
    };
  }));

  return { results };
}
```

- [ ] **Step 3: Commit**

```bash
git add controllers/lotteryController.js
git commit -m "feat: save prizeTable in updateResults, add getRecentResults"
```

---

## Task 6: Route ekle ve backend'i push et

**Files:**
- Modify: `functions/routes/api.js`

- [ ] **Step 1: api.js'i guncelle**

`functions/routes/api.js` dosyasini tamamen su icerikle degistir:

```js
import { Router } from 'express';
import {
  updateResults,
  checkForNewDraw,
  getPredictions,
  getPerformance,
  getStats,
  getRecentResults,
} from '../controllers/lotteryController.js';

const router = Router();

const wrap = fn => async (req, res) => {
  try {
    const data = await fn();
    res.json(data);
  } catch (err) {
    console.error(`[${req.path}] Hata:`, err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

router.get('/api/update', (req, res) => {
  res.json({ success: true, message: 'Guncelleme arka planda baslatildi.' });
  updateResults().then(r => {
    console.log(`Guncelleme tamamlandi: ${r.added} yeni, ${r.skipped} atlandi`);
  }).catch(err => {
    console.error('Guncelleme hatasi:', err.message);
  });
});
router.get('/api/check',          (req, res) => {
  res.json({ success: true, message: 'Kontrol baslatildi.' });
  checkForNewDraw().catch(err => console.error('Check hatasi:', err.message));
});
router.get('/api/predictions',    wrap(getPredictions));
router.get('/api/performance',    wrap(getPerformance));
router.get('/api/stats',          wrap(getStats));
router.get('/api/results/recent', wrap(getRecentResults));

export default router;
```

- [ ] **Step 2: Commit ve push**

```bash
git add routes/api.js
git commit -m "feat: add /api/results/recent route"
git push origin main
```

- [ ] **Step 3: Render deploy'u bekle ve dogrula**

Render dashboard'da deploy tamamlandiktan sonra:

```bash
curl https://piyango-backend.onrender.com/api/results/recent
```

Beklenen yani: `{"results":[...]}` icinde her draw icin `drawId`, `drawDate` ve `evaluation` alanlari.

---

## Task 7: Frontend — HTML section ekle

**Files:**
- Modify: `public/index.html`

- [ ] **Step 1: Yeni section ekle**

`public/index.html` icinde `performance-section` kapanis etiketinden hemen sonraya, container kapanisinin oncesine su blogu ekle:

```html
    <section class="section" id="results-section" style="display:none;">
      <h2 class="section-title">Son Cekilis Sonuclari</h2>
      <div id="results-container"></div>
    </section>
```

- [ ] **Step 2: Commit**

```bash
cd ..
git add public/index.html
git commit -m "feat: add recent results section to HTML"
```

---

## Task 8: Frontend — CSS stilleri ekle

**Files:**
- Modify: `public/style.css`

- [ ] **Step 1: Result card stillerini dosyanin sonuna ekle**

`public/style.css` dosyasinin en sonuna su blogu ekle:

```css
/* -- Recent Results -- */
.result-draw-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  margin-bottom: 12px;
}

.result-draw-header {
  padding: 12px 24px;
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  border-bottom: 1px solid var(--border);
}

.result-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 24px;
  border-bottom: 1px solid var(--border);
}
.result-row:last-child { border-bottom: none; }

.result-pred-label {
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  min-width: 62px;
}

.prize-badge {
  background: rgba(16, 185, 129, 0.15);
  color: var(--super);
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: 6px;
  padding: 3px 10px;
  font-size: 0.75rem;
  font-weight: 600;
}

.prize-amount {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text);
  margin-left: auto;
}

.no-prize {
  font-size: 0.82rem;
  color: var(--muted);
}

.no-prediction {
  font-size: 0.82rem;
  color: var(--muted);
  font-style: italic;
}

@media (max-width: 640px) {
  .result-row   { flex-wrap: wrap; gap: 8px; }
  .prize-amount { margin-left: 0; }
}
```

- [ ] **Step 2: Commit**

```bash
git add public/style.css
git commit -m "feat: add recent results card styles"
```

---

## Task 9: Frontend — JS render fonksiyonu ve API cagrisi

**Files:**
- Modify: `public/script.js`

- [ ] **Step 1: loadAll fonksiyonunu guncelle**

`public/script.js` icindeki `loadAll` fonksiyonunu tamamen su kod ile degistir:

```js
async function loadAll() {
  try {
    const [predsRes, statsRes, perfRes, recRes] = await Promise.all([
      fetch(`${API}/api/predictions`),
      fetch(`${API}/api/stats`),
      fetch(`${API}/api/performance`),
      fetch(`${API}/api/results/recent`),
    ]);

    const preds = await predsRes.json();
    const stats = await statsRes.json();
    const perf  = await perfRes.json();
    const rec   = await recRes.json();

    renderStats(stats, preds);
    renderPredictions(preds);
    renderPerformance(perf);
    renderRecentResults(rec);
  } catch (err) {
    console.error('Veri yuklenemedi:', err);
    document.getElementById('predictions-container').innerHTML =
      '<p style="color:#5a5a72;text-align:center;padding:32px">Veriler yuklenirken hata olustu.</p>';
  }
}
```

- [ ] **Step 2: renderRecentResults fonksiyonunu ekle**

`renderPerformance` fonksiyonundan hemen sonraya su fonksiyonu ekle (DOM metodlari kullaniliyor, XSS riski yok):

```js
function renderRecentResults(data) {
  if (!data.results?.length) return;

  document.getElementById('results-section').style.display = 'block';
  const container = document.getElementById('results-container');
  container.textContent = '';

  data.results.forEach(draw => {
    const card = document.createElement('div');
    card.className = 'result-draw-card';

    const header = document.createElement('div');
    header.className = 'result-draw-header';
    header.textContent = draw.drawDate;
    card.appendChild(header);

    if (!draw.evaluation) {
      const row = document.createElement('div');
      row.className = 'result-row no-prediction';
      row.textContent = 'Bu cekilis icin tahmin yapilmamistir.';
      card.appendChild(row);
    } else {
      draw.evaluation.predictions.forEach(pred => {
        const row = document.createElement('div');
        row.className = 'result-row';

        const lbl = document.createElement('span');
        lbl.className = 'result-pred-label';
        lbl.textContent = `Tahmin ${pred.index + 1}`;
        row.appendChild(lbl);

        if (pred.prizeCategory) {
          const badge = document.createElement('span');
          badge.className = 'prize-badge';
          badge.textContent = pred.prizeCategory.replace(' kisi sayisi', '');
          row.appendChild(badge);

          const amount = document.createElement('span');
          amount.className = 'prize-amount';
          amount.textContent = pred.prizeAmount;
          row.appendChild(amount);
        } else {
          const noPrize = document.createElement('span');
          noPrize.className = 'no-prize';
          noPrize.textContent = 'Odul kazanilamamistir.';
          row.appendChild(noPrize);
        }

        card.appendChild(row);
      });
    }

    container.appendChild(card);
  });
}
```

- [ ] **Step 3: Commit ve push**

```bash
git add public/script.js
git commit -m "feat: add renderRecentResults and fetch /api/results/recent"
git push origin main:master
```

- [ ] **Step 4: Sayfayi ac ve dogrula**

`cilginpiyango.web.app` adresini ac. "Son Cekilis Sonuclari" bolumunun gozuktu kontrol et. Her tahmin satiri ya yesil badge (odul) ya da soluk "Odul kazanilamamistir." gostermeli. Browser console'da hata olmamali.

---

## Self-Review

- `prizeTable: []` — eski cekilislerde `prizeAmount` her zaman `null` doner, dogru davranis
- `winnersCount === 0` — odul satiri yine kaydedilir; frontend sadece `prizeAmount` gosterir
- `evaluation: null` — tahmin yapilmamis draw'lar icin "Bu cekilis icin tahmin yapilmamistir."
- DOM metodlari kullanildi, XSS riski yok
- 14 kategori `determinePrizeCategory`'de dogru siralamayla yer aliyor
- `5+SüperStar bilen kisi sayisi` kategori #5 olarak dogru konumda
