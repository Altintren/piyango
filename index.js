const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const http = require('node:http');

http.createServer(function (req, res) {
    fs.readFile('index.html', function(err, data) {
      res.writeHead(200, {'Content-Type': 'text/html'});
      res.write(data);
      res.end();
    });
  }).listen(8080);

async function getNumbersFromPage(weekNumber) {
    try {
        const url = `https://www.fotomac.com.tr/sayisal-loto-sonuclari/${weekNumber}`;
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);
        const numbers = [];

        // Sayfa içeriğini konsola yazdır (debug amaçlı)
        console.log(`Fetched data from: ${url}`);

        // Sayıları alma
        $('.lottery-wins-numbers span').each((index, element) => {
            const numberText = $(element).text().trim();
            numbers.push(numberText);
        });

        console.log(`Numbers for ${url}:`, numbers); // Debug için
        return numbers;
    } catch (error) {
        console.error(`Failed to fetch numbers from ${url}: ${error.message}`);
        throw error;
    }
}

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getResults() {
    const base_url = "https://www.fotomac.com.tr/sayisal-loto-sonuclari/";
    const results = {};
    const maxRetries = 3; // Maksimum tekrar deneme sayısı

    // İlk olarak, ana sayfadan HTML'i alalım ve option değerlerini bulalım
    try {
        const response = await axios.get(base_url);
        const $ = cheerio.load(response.data);
        const selectElement = $('#historylistselect');
        const options = selectElement.find('option');

        for (let i = 0; i < options.length; i++) {
            const weekNumber = $(options[i]).attr('value');
            let retries = 0;

            while (retries < maxRetries) {
                try {
                    const numbers = await getNumbersFromPage(weekNumber);
                    results[weekNumber] = numbers;
                    break; // Başarılı olursa döngüden çık
                } catch (error) {
                    console.error(`Error fetching week ${weekNumber}: ${error.message}. Retrying...`);
                    retries++;
                    if (retries === maxRetries) {
                        results[weekNumber] = error.message;
                    }
                    await delay(1000 * retries); // Bekleme süresi (artarak)
                }
            }

            // İstekler arasında 2 saniye bekleme süresi
            await delay(2000);
        }

        return results;
    } catch (error) {
        console.error("Failed to fetch main page:", error.message);
        throw error;
    }
}

async function main() {
    try {
        const results = await getResults();
        const dataPath = path.join(__dirname, 'data.json');
        fs.writeFileSync(dataPath, JSON.stringify(results, null, 2), 'utf-8');
        console.log("Results written to data.json");
    } catch (error) {
        console.error("An error occurred:", error);
    }
}

main();