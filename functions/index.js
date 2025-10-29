// @ts-nocheck
require("dotenv").config(); // 👈 .env dosyasını yükle
const functions = require("firebase-functions");
const express = require("express");
const mongoose = require("mongoose");
const axios = require("axios");
const cheerio = require("cheerio");
const cron = require("node-cron");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// =========================
//  MongoDB bağlantısı (.env'den)
// =========================
const mongoURI = process.env.MONGO_URI;

mongoose
  .connect(mongoURI, { dbName: "lotodb" })
  .then(() => console.log("✅ MongoDB bağlantısı başarılı"))
  .catch((err) => console.error("❌ MongoDB bağlantı hatası:", err));

// =========================
//  Mongoose Schema
// =========================
const resultSchema = new mongoose.Schema({
  week: Number,
  numbers: [String],
});

const Result = mongoose.model("Result", resultSchema);

// =========================
//  Fotomaç'tan veri çekme fonksiyonu
// =========================
async function getNumbersFromPage(weekNumber) {
  try {
    const url = `https://www.fotomac.com.tr/sayisal-loto-sonuclari/${weekNumber}`;
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    const numbers = [];

    $(".lottery-wins-numbers span").each((index, element) => {
      const numberText = $(element).text().trim();
      if (numberText) numbers.push(numberText);
    });

    console.log(`📥 ${weekNumber}. hafta için ${numbers.length} sayı çekildi.`);
    return numbers;
  } catch (error) {
    console.error(`❌ ${weekNumber}. hafta çekilemedi: ${error.message}`);
    return [];
  }
}

// =========================
//  Tüm haftaları güncelle
// =========================
async function main() {
  console.log("🚀 Veri güncelleme başlatıldı...");
  let successCount = 0;

  for (let i = 1; i <= 500; i++) {
    const existing = await Result.findOne({ week: i });
    if (existing) continue;

    const numbers = await getNumbersFromPage(i);
    if (numbers.length > 0) {
      await Result.create({ week: i, numbers });
      successCount++;
    }
  }

  console.log(`✅ Güncelleme tamamlandı. ${successCount} yeni kayıt eklendi.`);
}

// =========================
//  CRON: Her Pazartesi 09:00'da güncelle
// =========================
cron.schedule("0 9 * * 1", async () => {
  console.log("🕘 Haftalık otomatik güncelleme başlatıldı...");
  await main();
});

// =========================
//  API: TÜM SONUÇLAR
// =========================
app.get("/api/results", async (req, res) => {
  try {
    const data = await Result.find();
    res.json(data);
  } catch (err) {
    console.error("Sonuç API hatası:", err);
    res.status(500).json({ error: "Veriler alınamadı." });
  }
});

// =========================
//  API: TAHMİN ÜRET
// =========================
function getTopFrequent(obj, limit) {
  return Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([num]) => num);
}

function getRandomElements(arr, count) {
  const shuffled = arr.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

app.get("/api/predictions", async (req, res) => {
  try {
    const data = await Result.find();

    const numbersFrequency = {};
    const jokerFrequency = {};
    const superstarFrequency = {};

    for (const result of data) {
      const numbers = result.numbers;
      if (!numbers || numbers.length < 8) continue;

      // 6 normal sayı
      for (let i = 0; i < 6; i++) {
        const num = numbers[i];
        numbersFrequency[num] = (numbersFrequency[num] || 0) + 1;
      }

      // Joker
      const joker = numbers[6];
      jokerFrequency[joker] = (jokerFrequency[joker] || 0) + 1;

      // SüperStar
      const superstar = numbers[7];
      superstarFrequency[superstar] = (superstarFrequency[superstar] || 0) + 1;
    }

    const topNumbers = getTopFrequent(numbersFrequency, 10);
    const topJokers = getTopFrequent(jokerFrequency, 3);
    const topSuperstars = getTopFrequent(superstarFrequency, 3);

    const predictions = [];
    for (let i = 0; i < 3; i++) {
      predictions.push(getRandomElements(topNumbers, 6));
    }

    res.json({
      topNumbers,
      topJokers,
      topSuperstars,
      predictions,
    });
  } catch (error) {
    console.error("Tahmin API hatası:", error);
    res.status(500).json({ error: "Tahmin oluşturulamadı." });
  }
});

// =========================
//  API: MANUEL GÜNCELLEME (Buton)
// =========================
app.get("/api/update-results", async (req, res) => {
  console.log("🧭 Manuel güncelleme isteği alındı...");
  try {
    await main();
    console.log("✅ Manuel veri güncelleme tamamlandı.");
    res.json({ message: "Sonuçlar başarıyla güncellendi." });
  } catch (err) {
    console.error("💥 Manuel güncelleme hatası:", err);
    res.status(500).json({ error: "Güncelleme sırasında hata oluştu." });
  }
});

// =========================
//  Firebase Export
// =========================
exports.api = functions.https.onRequest(app);
