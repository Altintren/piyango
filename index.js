const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

async function getNumbersFromPage(url) {
    try {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);
        const numbers = [];

        // Sayfa içeriğini konsola yazdır (debug amaçlı)
        console.log(`Fetched data from: ${url}`);
        console.log(response.data);

        // Sayıları alma
        $('.loto-numbers.red-loto > div:not(.jolly):not(.superstar)').each((index, element) => {
            const numberText = $(element).text().trim();
            numbers.push(numberText);
        });

        // Joker sayısını alma
        const joker = $('.jolly').attr('data-content');
        if (joker) numbers.push(joker);

        // Süperstar sayısını alma
        const superstar = $('.superstar').attr('data-content');
        if (superstar) numbers.push(superstar);

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
    const base_url = "https://www.millipiyangoonline.com/sayisal-loto/cekilis-sonuclari.";
    const results = {};
    const maxRetries = 3; // Maksimum tekrar deneme sayısı

    for (let week = 1; week <= 68; week++) {
        const url = `${base_url}${week}.2024`;
        let retries = 0;

        while (retries < maxRetries) {
            try {
                const numbers = await getNumbersFromPage(url);
                results[week] = numbers;
                break; // Başarılı olursa döngüden çık
            } catch (error) {
                console.error(`Error fetching week ${week}: ${error.message}. Retrying...`);
                retries++;
                if (retries === maxRetries) {
                    results[week] = error.message;
                }
                await delay(1000 * retries); // Bekleme süresi (artarak)
            }
        }

        // İstekler arasında 2 saniye bekleme süresi
        await delay(2000);
    }

    return results;
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