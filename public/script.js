const API = 'https://piyango-backend.onrender.com';

async function loadAll() {
  try {
    const [predsRes, statsRes, perfRes] = await Promise.all([
      fetch(`${API}/api/predictions`),
      fetch(`${API}/api/stats`),
      fetch(`${API}/api/performance`),
    ]);

    const preds = await predsRes.json();
    const stats = await statsRes.json();
    const perf  = await perfRes.json();

    renderStats(stats, preds);
    renderPredictions(preds);
    renderPerformance(perf);
  } catch (err) {
    console.error('Veri yüklenemedi:', err);
    document.getElementById('predictions-container').innerHTML =
      '<p style="color:#5a5a72;text-align:center;padding:32px">Veriler yüklenirken hata oluştu.</p>';
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

    const jokerBall = pred.joker != null
      ? `<div class="ball ball-joker">${pred.joker}</div>`
      : '';

    const superBall = pred.superstar != null
      ? `<div class="ball ball-super">${pred.superstar}</div>`
      : '';

    card.innerHTML = `
      <span class="pred-label">Tahmin ${i + 1}</span>
      <div class="pred-numbers">${mainBalls}</div>
      <div class="pred-extras">${jokerBall}${superBall}</div>
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

// Güncelle butonu
const updateBtn = document.getElementById('updateButton');
const spinner   = document.getElementById('loadingSpinner');

updateBtn.addEventListener('click', async () => {
  updateBtn.disabled = true;
  document.querySelector('.btn-text').textContent = 'Başlatılıyor...';
  spinner.style.display = 'inline-block';

  try {
    await fetch(`${API}/api/update`);
    alert('Güncelleme arka planda başlatıldı. Birkaç dakika içinde tamamlanır.');
  } catch {
    alert('Bağlantı hatası.');
  } finally {
    document.querySelector('.btn-text').textContent = 'Güncelle';
    updateBtn.disabled = false;
    spinner.style.display = 'none';
  }
});

document.getElementById('year').textContent = new Date().getFullYear();

function setDrawDateTitle() {
  const day = new Date().getDay();
  // 0=Paz,1=Pzt,2=Sal,3=Çar,4=Per,5=Cum,6=Cmt
  // Çarşamba(3) ve Cumartesi(6) çekiliş günleri
  const daysUntil = [3, 2, 1, 0, 2, 1, 0][day];
  const nextDraw = new Date();
  nextDraw.setDate(nextDraw.getDate() + daysUntil);
  const label = nextDraw.toLocaleDateString('tr-TR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  document.getElementById('drawDateTitle').textContent = `${label} Çekilişi Tahminleri`;
}
setDrawDateTitle();

loadAll();
