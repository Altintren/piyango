// =========================
//  GEREKLİ MODÜLLER
// =========================
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const express = require('express'); // http yerine express
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
  useNewUrlParser: true,
  useUnifiedTopology: true,
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
app.use(express.static(__dirname)); // index.html ve script.js erişimi

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
//  YARDIMCI FONKSİYONLAR
// =========================
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

// =========================
//  ANA FONKSİYON
// =========================
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
