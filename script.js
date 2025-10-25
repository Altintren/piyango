async function fetchResults() {
  try {
    const response = await fetch('/api/results');
    const data = await response.json();

    const numbersFrequency = {};
    const jokerFrequency = {};
    const superstarFrequency = {};

    for (const result of data) {
      const numbers = result.numbers;
      if (!numbers || numbers.length < 8) continue;

      // İlk 6 sayı
      for (let i = 0; i < 6; i++) {
        const num = numbers[i];
        numbersFrequency[num] = (numbersFrequency[num] || 0) + 1;
      }

      // Joker
      const joker = numbers[6];
      jokerFrequency[joker] = (jokerFrequency[joker] || 0) + 1;

      // Süperstar
      const superstar = numbers[7];
      superstarFrequency[superstar] = (superstarFrequency[superstar] || 0) + 1;
    }

    // En sık çıkanları bul
    const topNumbers = getTopFrequent(numbersFrequency, 10);
    const topJokers = getTopFrequent(jokerFrequency, 3);
    const topSuperstars = getTopFrequent(superstarFrequency, 3);

    // Tahminler
    const predictions = [];
    for (let i = 0; i < 3; i++) {
      predictions.push(getRandomElements(topNumbers, 6));
    }

    displayResults(data);
    displayPredictions(predictions);
    displayFrequentNumbers(topNumbers.slice(0, 3), topJokers, topSuperstars);
  } catch (error) {
    console.error("Veri alınamadı:", error);
  }
}

function getTopFrequent(frequencyObject, count) {
  return Object.entries(frequencyObject)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(entry => entry[0]);
}

function getRandomElements(array, count) {
  const shuffled = array.slice().sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function displayResults(data) {
  const resultsContainer = document.getElementById('results');
  resultsContainer.innerHTML = ''; // önceki verileri temizle
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

fetchResults();
