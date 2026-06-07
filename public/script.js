const API = 'https://piyango-backend.onrender.com';

async function loadAll() {
  try {
    const [predsRes, statsRes, perfRes, recRes, analysisRes] = await Promise.all([
      fetch(`${API}/api/predictions`),
      fetch(`${API}/api/stats`),
      fetch(`${API}/api/performance`),
      fetch(`${API}/api/results/recent`),
      fetch(`${API}/api/analysis`),
    ]);

    const preds    = await predsRes.json();
    const stats    = await statsRes.json();
    const perf     = await perfRes.json();
    const rec      = await recRes.json();
    const analysis = await analysisRes.json();

    renderStats(stats, preds);
    renderPredictions(preds);
    renderPerformance(perf);
    renderComponentAnalysis(analysis);
    renderRecentResults(rec);
  } catch (err) {
    console.error('Veri yüklenemedi:', err);
    const errP = document.createElement('p');
    errP.style.cssText = 'color:#5a5a72;text-align:center;padding:32px';
    errP.textContent = 'Veriler yüklenirken hata oluştu.';
    const container = document.getElementById('predictions-container');
    container.textContent = '';
    container.appendChild(errP);
  }
}

function renderStats(stats, preds) {
  document.getElementById('totalDraws').textContent =
    stats.totalDraws != null ? stats.totalDraws.toLocaleString('tr-TR') : '—';

  document.getElementById('latestDraw').textContent =
    stats.latestDraw?.drawDate ?? '—';

  document.getElementById('modelConfidence').textContent =
    preds.modelConfidence != null
      ? `%${(preds.modelConfidence * 100).toFixed(1)}`
      : '—';

  document.getElementById('predDate').textContent =
    preds.createdAt
      ? new Date(preds.createdAt).toLocaleDateString('tr-TR')
      : '—';
}

function renderPredictions(preds) {
  const container = document.getElementById('predictions-container');
  container.innerHTML = '';

  if (!preds.predictions?.length) {
    container.innerHTML = '<p style="color:#5a5a72;padding:24px">Tahmin bulunamadı.</p>';
    return;
  }

  preds.predictions.forEach((pred, i) => {
    const card = document.createElement('div');
    card.className = 'pred-card';

    const mainBalls = pred.numbers
      .map(n => `<div class="ball ball-main">${n}</div>`)
      .join('');

    const superBall = pred.superstar != null
      ? `<div class="ball ball-super">${pred.superstar}</div>`
      : '';

    card.innerHTML = `
      <span class="pred-label">Tahmin ${i + 1}</span>
      <div class="pred-numbers">${mainBalls}</div>
      <div class="pred-extras">${superBall}</div>
    `;

    container.appendChild(card);
  });
}

function renderPerformance(perf) {
  if (!perf.evaluatedPredictions) return;

  document.getElementById('performance-section').style.display = 'block';

  document.getElementById('avgHit').textContent =
    perf.avgNumbersHit != null ? perf.avgNumbersHit.toFixed(2) : '—';

  document.getElementById('bestHit').textContent =
    perf.bestEverHitScore ?? '—';

  document.getElementById('evaluated').textContent =
    perf.evaluatedPredictions ?? '—';

  const imp = perf.improvementOverRandom;
  document.getElementById('improvement').textContent =
    imp != null ? `${imp > 0 ? '+' : ''}${imp}` : '—';
}

function renderComponentAnalysis(data) {
  if (!data.available) return;

  document.getElementById('analysis-section').style.display = 'block';
  document.getElementById('analysisLogsUsed').textContent = data.logsUsed;

  const container = document.getElementById('analysis-container');
  container.innerHTML = '';

  const components = [
    { key: 'baseFreq',   label: 'Tarihsel Sıklık', desc: 'Tüm çekilişlerdeki frekans' },
    { key: 'recentFreq', label: 'Son 50 Çekiliş',  desc: 'Yakın dönem frekansı' },
    { key: 'dayFreq',    label: 'Gün Frekansı',     desc: 'Aynı gün frekansı' },
    { key: 'hitRate',    label: 'İsabet Oranı',     desc: 'Sabit — tahmin geçmişi', fixed: true },
  ];

  const card = document.createElement('div');
  card.className = 'analysis-card';

  components.forEach(comp => {
    const row = document.createElement('div');
    row.className = 'comp-row';

    const label = document.createElement('div');
    label.className = 'comp-label';
    label.innerHTML = `<div class="comp-name">${comp.label}</div><div class="comp-desc">${comp.desc}</div>`;
    row.appendChild(label);

    if (comp.fixed) {
      const fixed = document.createElement('div');
      fixed.className = 'comp-fixed';
      fixed.textContent = 'sabit';
      row.appendChild(fixed);
    } else {
      const pct = data.avgPercentiles[comp.key];

      const barWrap = document.createElement('div');
      barWrap.className = 'comp-bar-wrap';

      const bar = document.createElement('div');
      bar.className = 'comp-bar';
      bar.style.width = `${(pct * 100).toFixed(1)}%`;
      bar.style.background = pct >= 0.60 ? 'var(--super)' : pct >= 0.52 ? 'var(--primary)' : 'var(--muted)';

      const baseline = document.createElement('div');
      baseline.className = 'comp-bar-baseline';

      barWrap.appendChild(bar);
      barWrap.appendChild(baseline);
      row.appendChild(barWrap);

      const pctEl = document.createElement('div');
      pctEl.className = 'comp-pct';
      pctEl.style.color = bar.style.background;
      pctEl.textContent = `%${Math.round(pct * 100)}`;
      row.appendChild(pctEl);
    }

    const weight = document.createElement('div');
    weight.className = 'comp-weight';
    weight.textContent = `×${data.currentWeights[comp.key].toFixed(2)}`;
    row.appendChild(weight);

    card.appendChild(row);
  });

  container.appendChild(card);
}

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

    const actualRow = document.createElement('div');
    actualRow.className = 'result-actual-row';
    const actualNums = document.createElement('div');
    actualNums.className = 'result-nums';
    (draw.numbers || []).forEach(n => {
      const ball = document.createElement('span');
      ball.className = 'ball ball-actual';
      ball.textContent = n;
      actualNums.appendChild(ball);
    });
    if (draw.joker != null) {
      const jball = document.createElement('span');
      jball.className = 'ball ball-joker';
      jball.textContent = draw.joker;
      actualNums.appendChild(jball);
    }
    if (draw.superstar != null) {
      const sball = document.createElement('span');
      sball.className = 'ball ball-super';
      sball.textContent = draw.superstar;
      actualNums.appendChild(sball);
    }
    actualRow.appendChild(actualNums);
    card.appendChild(actualRow);

    if (!draw.evaluation) {
      const row = document.createElement('div');
      row.className = 'result-row no-prediction';
      row.textContent = 'Bu çekiliş için tahmin yapılmamıştır.';
      card.appendChild(row);
    } else {
      // Sadece ilk 6 ana sayı — joker/süperstar ana sayılar kümesine dahil edilmez
      const actualSet = new Set((draw.numbers || []).slice(0, 6));
      // Joker, süperstar ile aynı değere sahipse işaretlenmez (parse hatası koruması)
      const drawnJoker = (draw.joker != null && draw.joker !== draw.superstar) ? draw.joker : null;

      draw.evaluation.predictions.forEach(pred => {
        const row = document.createElement('div');
        row.className = 'result-row';

        const numsWrap = document.createElement('div');
        numsWrap.className = 'result-nums';
        (pred.numbers || []).forEach(n => {
          const ball = document.createElement('span');
          const isMainHit  = actualSet.has(n);
          const isJokerHit = drawnJoker != null && n === drawnJoker;
          ball.className = 'ball ball-main'
            + (isMainHit  ? ' ball-hit'      : '')
            + (isJokerHit ? ' ball-hit-joker' : '');
          ball.textContent = n;
          numsWrap.appendChild(ball);
        });

        // Eski tahminlerde pred.joker açıkça saklanmıştı — geriye dönük uyumluluk için göster
        if (pred.joker != null) {
          const jball = document.createElement('span');
          jball.className = 'ball ball-joker' + (pred.joker === drawnJoker ? ' ball-hit-joker' : '');
          jball.textContent = pred.joker;
          numsWrap.appendChild(jball);
        }

        if (pred.superstar != null) {
          const sball = document.createElement('span');
          sball.className = 'ball ball-super' + (pred.superstar === draw.superstar ? ' ball-hit-super' : '');
          sball.textContent = pred.superstar;
          numsWrap.appendChild(sball);
        }
        row.appendChild(numsWrap);

        if (pred.prizeCategory) {
          const badge = document.createElement('span');
          badge.className = 'prize-badge';
          badge.textContent = pred.prizeCategory.replace(' kişi sayısı', '');
          row.appendChild(badge);

          const amount = document.createElement('span');
          amount.className = 'prize-amount';
          amount.textContent = pred.prizeAmount ?? '—';
          row.appendChild(amount);
        } else {
          const noPrize = document.createElement('span');
          noPrize.className = 'no-prize';
          noPrize.textContent = 'Ödül kazanılamamıştır.';
          row.appendChild(noPrize);
        }

        card.appendChild(row);
      });
    }

    container.appendChild(card);
  });
}

// Güncelle butonu
const updateBtn   = document.getElementById('updateButton');
const spinner     = document.getElementById('loadingSpinner');
const statusEl    = document.getElementById('update-status');
const btnText     = document.querySelector('.btn-text');

function setUpdateIdle() {
  btnText.textContent      = 'Güncelle';
  updateBtn.disabled       = false;
  spinner.style.display    = 'none';
  statusEl.style.display   = 'none';
  statusEl.className       = 'update-status';
}

updateBtn.addEventListener('click', async () => {
  updateBtn.disabled    = true;
  btnText.textContent   = 'Başlatılıyor...';
  spinner.style.display = 'inline-block';
  statusEl.style.display = 'block';
  statusEl.className     = 'update-status';
  statusEl.textContent   = 'Sunucuya bağlanılıyor...';

  try {
    await fetch(`${API}/api/update`);
  } catch {
    statusEl.textContent = 'Bağlantı hatası.';
    statusEl.className   = 'update-status update-error';
    setTimeout(setUpdateIdle, 4000);
    return;
  }

  btnText.textContent = 'Güncelleniyor...';

  const poll = setInterval(async () => {
    try {
      const res    = await fetch(`${API}/api/update/status`);
      const status = await res.json();
      statusEl.textContent = status.message;

      if (!status.running) {
        clearInterval(poll);
        const isError = status.message.startsWith('Hata:');
        statusEl.className = 'update-status' + (isError ? ' update-error' : ' update-done');
        setTimeout(async () => {
          setUpdateIdle();
          if (!isError) await loadAll();
        }, 3000);
      }
    } catch { /* geçici ağ hatası — polling devam eder */ }
  }, 2000);
});

document.getElementById('year').textContent = new Date().getFullYear();

function setDrawDateTitle() {
  const day = new Date().getDay();
  // 0=Paz,1=Pzt,2=Sal,3=Çar,4=Per,5=Cum,6=Cmt
  // Pazartesi(1), Çarşamba(3) ve Cumartesi(6) çekiliş günleri
  const daysUntil = [1, 0, 1, 0, 2, 1, 0][day];
  const nextDraw = new Date();
  nextDraw.setDate(nextDraw.getDate() + daysUntil);
  const label = nextDraw.toLocaleDateString('tr-TR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  document.getElementById('drawDateTitle').textContent = `${label} Çekilişi Tahminleri`;
}
setDrawDateTitle();

loadAll();
