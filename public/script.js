async function fetchResultsAndPredictions() {
  try {
    const [resultsResponse, predictionsResponse] = await Promise.all([
      fetch('/api/results'),
      fetch('/api/predictions')
    ]);

    const resultsData = await resultsResponse.json();
    const predictionsData = await predictionsResponse.json();

    displayResults(resultsData);
    displayPredictions(predictionsData.predictions);
    displayFrequentNumbers(
      predictionsData.topNumbers,
      predictionsData.topJokers,
      predictionsData.topSuperstars
    );
  } catch (error) {
    console.error("Veriler alınamadı:", error);
  }
}

function displayResults(data) {
  const resultsContainer = document.getElementById('results');
  resultsContainer.innerHTML = '';
  for (const result of data) {
    const numbers = result.numbers;
    if (!numbers || numbers.length < 8) continue;

    const resultItem = document.createElement('div');
    resultItem.classList.add('result-item');
    resultItem.innerHTML = `
      <h2>Hafta ${result.week}</h2>
      <p>Sayılar: ${numbers.slice(0, 6).join(', ')}</p>
      <p>Joker: ${numbers[6]}</p>
      <p>Süperstar: ${numbers[7]}</p>
    `;
    resultsContainer.appendChild(resultItem);
  }
}

function displayPredictions(predictions) {
  const predictionList = document.getElementById('prediction-list');
  predictionList.innerHTML = '';
  predictions.forEach((prediction, index) => {
    const listItem = document.createElement('li');
    listItem.innerHTML = `
      <h2>Tahmin ${index + 1}</h2>
      <p>${prediction.join(', ')}</p>
    `;
    predictionList.appendChild(listItem);
  });
}

function displayFrequentNumbers(topNumbers, topJokers, topSuperstars) {
  document.getElementById('top-numbers').textContent = topNumbers.join(', ');
  document.getElementById('top-joker').textContent = topJokers.join(', ');
  document.getElementById('top-superstar').textContent = topSuperstars.join(', ');
}

// =========================
//  Manuel Güncelleme Butonu
// =========================
const updateButton = document.getElementById('updateButton');
const loader = document.getElementById('loadingSpinner');

if (updateButton) {
  updateButton.addEventListener('click', async () => {
    updateButton.disabled = true;
    loader.style.display = 'inline-block';
    updateButton.textContent = ' Güncelleniyor...';

    try {
      const res = await fetch('/api/update-results');
      const data = await res.json();
      alert(data.message || 'Güncelleme tamamlandı.');
      await fetchResultsAndPredictions();
    } catch (err) {
      alert('❌ Güncelleme sırasında hata oluştu.');
      console.error(err);
    } finally {
      updateButton.textContent = '🔄 Sonuçları Güncelle';
      updateButton.disabled = false;
      loader.style.display = 'none';
    }
  });
}

fetchResultsAndPredictions();
