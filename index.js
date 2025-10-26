// =========================
//  GEREKLİ MODÜLLER
// =========================
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const express = require('express');
const cron = require('node-cron');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = 8080;

// =========================
//  MONGODB BAĞLANTISI
// =========================
const mongoURI = process.env.MONGO_URI || 'mongodb+srv://<db_username>:<db_password>@rakamlar.s40cnjb.mongodb.net/lotodb';

mongoose.connect(mongoURI, {
  dbName: 'lotodb'
}).then(() => console.log('✅ MongoDB bağlantısı başarılı (lotodb)'))
  .catch(err => console.error('❌ MongoDB bağlantı hatası:', err));

// =========================
//  MONGOOSE MODEL
// =========================
const ResultSchema = new mongoose.Schema({
  week: { type: String, unique: true },
  numbers: [String],
  dateFetched: { type: Date, default: Date.now }
});

const Result = mongoose.model('results', ResultSchema);

// =========================
//  EXPRESS MIDDLEWARE
// =========================
app.use(express.static(__dirname));

// =========================
//  API: TÜM VERİLERİ DÖN
// =========================
app.get('/api/results', async (req, res) => {
  try {
    const data = await Result.find().sort({ week: -1 });
    res.json(data);
  } catch (error) {
    console.error("API hatası:", error);
    res.status(500).json({ error: "Veritabanından veri alınamadı." });
  }
});

// =========================
//  API: TAHMİN ÜRET
// =========================
app.get('/api/predictions', async (req, res) => {
  try {
    const data = await Result.find();

    const numbersFrequency = {};
    const jokerFrequency = {};
    const superstarFrequency = {};

    // Frekans hesaplama
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

    // En çok çıkan sayılar
    const topNumbers = getTopFrequent(numbersFrequency, 10);
    const topJokers = getTopFrequent(jokerFrequency, 3);
    const topSuperstars = getTopFrequent(superstarFrequency, 3);

    // Rastgele tahminler
    const predictions = [];
    for (let i = 0; i < 3; i++) {
      predictions.push(getRandomElements(topNumbers, 6));
    }

    res.json({
      topNumbers: topNumbers.slice(0, 3),
      topJokers,
      topSuperstars,
      predictions
    });

  } catch (error) {
    console.error("Tahmin API hatası:", error);
    res.status(500).json({ error: "Tahmin oluşturulamadı." });
  }
});

// =========================
//  DESTEK FONKSİYONLAR
// =========================
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

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getNumbersFromPage(weekNumber) {
  try {
    const url = `https://www.fotomac.com.tr/sayisal-loto-sonuclari/${weekNumber}`;
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    const numbers = [];

    $('.lottery-wins-numbers span').each((index, element) => {
      const numberText = $(element).text().trim();
      if (numberText) numbers.push(numberText);
    });

    console.log(`📥 ${weekNumber} haftası için ${numbers.length} sayı çekildi.`);
    return numbers;
  } catch (error) {
    console.error(`❌ ${weekNumber} haftası çekilemedi: ${error.message}`);
    throw error;
  }
}

async function getResults() {
  const base_url = "https://www.fotomac.com.tr/sayisal-loto-sonuclari/";
  const results = {};
  const maxRetries = 3;

  try {
    const response = await axios.get(base_url);
    const $ = cheerio.load(response.data);
    const options = $('#historylistselect').find('option');

    for (let i = 0; i < options.length; i++) {
      const weekNumber = $(options[i]).attr('value');
      let retries = 0;

      while (retries < maxRetries) {
        try {
          const numbers = await getNumbersFromPage(weekNumber);
          results[weekNumber] = numbers;
          break;
        } catch (error) {
          retries++;
          console.warn(`⚠️ ${weekNumber} haftası yeniden deneniyor (${retries})`);
          if (retries === maxRetries) results[weekNumber] = [];
          await delay(1000 * retries);
        }
      }

      await delay(2000);
    }

    return results;
  } catch (error) {
    console.error("❌ Ana sayfa verisi alınamadı:", error.message);
    throw error;
  }
}

async function main() {
  console.log('🚀 Veri çekme işlemi başlatıldı...');
  try {
    const results = await getResults();

    for (const [weekNumber, numbers] of Object.entries(results)) {
      if (!numbers || numbers.length === 0) continue;

      await Result.updateOne(
        { week: weekNumber },
        { $set: { numbers, dateFetched: new Date() } },
        { upsert: true }
      );

      console.log(`✅ Hafta ${weekNumber} MongoDB'ye kaydedildi.`);
    }

    console.log('🎯 Tüm sonuçlar MongoDB veritabanına yazıldı.');
  } catch (error) {
    console.error("💥 Bir hata oluştu:", error);
  }
}

// =========================
//  CRON GÖREVİ (Pazartesi 09:00)
// =========================
cron.schedule('0 9 * * 1', async () => {
  console.log('📆 Pazartesi sabahı: haftalık veri güncellemesi başlıyor...');
  await main();
  console.log('✅ Haftalık güncelleme tamamlandı.');
});

// =========================
//  SUNUCUYU BAŞLAT
// =========================
app.listen(PORT, () => {
  console.log(`🌐 Server running at http://localhost:${PORT}`);
});
