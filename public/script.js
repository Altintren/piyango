const API = 'https://piyango-backend.onrender.com';

async function fetchResultsAndPredictions() {
  try {
    const [resultsRes, predictionsRes] = await Promise.all([
      fetch(`${API}/api/results`),
      fetch(`${API}/api/predictions`)
    ]);

    if (!resultsRes.ok || !predictionsRes.ok) throw new Error('Sunucu hatası');

    const resultsData    = await resultsRes.json();
    const predictionsData = await predictionsRes.json();

    displayResults(resultsData);
    displayPredictions(predictionsData.predictions);
    displayFrequentNumbers(
      predictionsData.topNumbers,
      predictionsData.topJokers,
      predictionsData.topSuperstars
    );
  } catch (error) {
    console.error('Veriler alınamadı:', error);
  }
}

function displayResults(data) {
  const container = document.getElementById('results');
  container.innerHTML = '';

  for (const result of data) {
    if (!result.numbers || result.numbers.length < 6) continue;

    const date = result.drawDate
      ? new Date(result.drawDate).toLocaleDateString('tr-TR')
      : '-';

    const item = document.createElement('div');
    item.classList.add('result-item');

    let html = `<h2>${date}</h2><p>Sayılar: ${result.numbers.join(', ')}</p>`;
    if (result.joker     != null) html += `<p>Joker: ${result.joker}</p>`;
    if (result.superstar != null) html += `<p>Süperstar: ${result.superstar}</p>`;

    item.innerHTML = html;
    container.appendChild(item);
  }
}

function displayPredictions(predictions) {
  const list = document.getElementById('prediction-list');
  list.innerHTML = '';

  predictions.forEach((pred, index) => {
    const item = document.createElement('li');
    let content = `<h2>Tahmin ${index + 1}</h2><p>Sayılar: ${pred.numbers.join(', ')}`;
    if (pred.joker     != null) content += ` &nbsp;|&nbsp; Joker: ${pred.joker}`;
    if (pred.superstar != null) content += ` &nbsp;|&nbsp; Süperstar: ${pred.superstar}`;
    content += '</p>';
    item.innerHTML = content;
    list.appendChild(item);
  });
}

function displayFrequentNumbers(topNumbers, topJokers, topSuperstars) {
  document.getElementById('top-numbers').textContent   = topNumbers.join(', ');
  document.getElementById('top-joker').textContent     = topJokers.join(', ');
  document.getElementById('top-superstar').textContent = topSuperstars.join(', ');
}

// Manuel Güncelleme Butonu
const updateButton = document.getElementById('updateButton');
const loader       = document.getElementById('loadingSpinner');

if (updateButton) {
  updateButton.addEventListener('click', async () => {
    updateButton.disabled    = true;
    loader.style.display     = 'inline-block';
    updateButton.textContent = ' Güncelleniyor...';

    try {
      const res  = await fetch(`${API}/update`);
      const data = await res.json();

      if (data.success) {
        alert(`Güncelleme tamamlandı. ${data.added} yeni çekiliş eklendi.`);
        await fetchResultsAndPredictions();
      } else {
        alert('Güncelleme başarısız: ' + data.message);
      }
    } catch (err) {
      alert('Güncelleme sırasında hata oluştu.');
      console.error(err);
    } finally {
      updateButton.textContent = '🔄 Sonuçları Güncelle';
      updateButton.disabled    = false;
      loader.style.display     = 'none';
    }
  });
}

fetchResultsAndPredictions();
