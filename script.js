async function fetchResults() {
    try {
        const response = await fetch('data.json');
        const data = await response.json();

        const numbersFrequency = {};
        const jokerFrequency = {};
        const superstarFrequency = {};

        for (const week in data) {
            const numbers = data[week];

            // İlk 6 sayı
            for (let i = 0; i < 6; i++) {
                if (numbersFrequency[numbers[i]]) {
                    numbersFrequency[numbers[i]]++;
                } else {
                    numbersFrequency[numbers[i]] = 1;
                }
            }

            // Joker sayısı
            const joker = numbers[6];
            if (jokerFrequency[joker]) {
                jokerFrequency[joker]++;
            } else {
                jokerFrequency[joker] = 1;
            }

            // Süperstar sayısı
            const superstar = numbers[7];
            if (superstarFrequency[superstar]) {
                superstarFrequency[superstar]++;
            } else {
                superstarFrequency[superstar] = 1;
            }
        }

        // En çok çıkan sayıları bulma
        const topNumbers = getTopFrequent(numbersFrequency, 10);
        const topJokers = getTopFrequent(jokerFrequency, 3);
        const topSuperstars = getTopFrequent(superstarFrequency, 3);

        // Tahminleri oluşturma
        const predictions = [];
        for (let i = 0; i < 3; i++) {
            predictions.push(getRandomElements(topNumbers, 6));
        }

        // Sonuçları ve tahminleri ekranda gösterme
        displayResults(data);
        displayPredictions(predictions);
        displayFrequentNumbers(topNumbers.slice(0, 3), topJokers, topSuperstars);
    } catch (error) {
        console.error("An error occurred:", error);
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
    for (const week in data) {
        const numbers = data[week];
        const resultItem = document.createElement('div');
        resultItem.classList.add('result-item');
        resultItem.innerHTML = `
            <h2>Hafta ${week}</h2>
            <p>Sayılar: ${numbers.slice(0, 6).join(', ')}</p>
            <p>Joker: ${numbers[6]}</p>
            <p>Süperstar: ${numbers[7]}</p>
        `;
        resultsContainer.appendChild(resultItem);
    }
}

function displayPredictions(predictions) {
    const predictionList = document.getElementById('prediction-list');
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