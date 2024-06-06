fetch('data.json')
    .then(response => response.json())
    .then(data => {
        const resultsDiv = document.getElementById('results');
        for (const [week, numbers] of Object.entries(data)) {
            const weekDiv = document.createElement('div');
            weekDiv.classList.add('week');

            const weekTitle = document.createElement('h2');
            weekTitle.textContent = `Hafta ${week}`;
            weekDiv.appendChild(weekTitle);

            const numbersDiv = document.createElement('div');
            numbersDiv.classList.add('numbers');

            numbers.slice(0, 6).forEach(number => {
                const numberDiv = document.createElement('div');
                numberDiv.classList.add('number');
                numberDiv.textContent = number;
                numbersDiv.appendChild(numberDiv);
            });

            weekDiv.appendChild(numbersDiv);

            if (numbers[6]) {
                const jokerDiv = document.createElement('div');
                jokerDiv.classList.add('joker');
                jokerDiv.textContent = `Joker: ${numbers[6]}`;
                weekDiv.appendChild(jokerDiv);
            }

            if (numbers[7]) {
                const superstarDiv = document.createElement('div');
                superstarDiv.classList.add('superstar');
                superstarDiv.textContent = `Süperstar: ${numbers[7]}`;
                weekDiv.appendChild(superstarDiv);
            }

            resultsDiv.appendChild(weekDiv);
        }
    })
    .catch(error => console.error('Error fetching results:', error));