// =========================
//  GEREKLİ MODÜLLER
// =========================
const axios = require('axios');
const cheerio = require('cheerio');
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
      predictions
    });
  } catch (error) {
    console.error("Tahmin API hatası:", erro
