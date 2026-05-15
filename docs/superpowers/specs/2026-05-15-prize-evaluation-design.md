# Ödül Değerlendirme ve Son Çekilişler Özelliği — Tasarım

**Tarih:** 2026-05-15  
**Proje:** Sayısal Loto Tahmin (piyango-backend + piyango frontend)

---

## Özet

Yeni bir çekiliş kaydedildiğinde ödül tablosu da fotomac.com.tr'den çekilip `Result`'a yazılacak. Evaluation sırasında her tahminin hangi ödül kategorisine girdiği (varsa) hesaplanıp `Prediction`'a kaydedilecek. Frontend'in altında son 3 çekiliş, her tahmin için ödül durumu gösterecek.

---

## Ödül Kategorileri

Kullanıcının tanımladığı 14 kategori (fotomac'taki etiket formatı):

| Kategori etiketi (sitedeki metin) | Koşul |
|---|---|
| `6+SüperStar bilen kişi sayısı` | 6 ana + superstar |
| `6 bilen kişi sayısı` | 6 ana |
| `5+1+SüperStar bilen kişi sayısı` | 5 ana + joker + superstar |
| `5+1 bilen kişi sayısı` | 5 ana + joker (superstar yok) |
| `5+SüperStar bilen kişi sayısı` | 5 ana + superstar (joker yok) |
| `5 bilen kişi sayısı` | 5 ana (joker yok, superstar yok) |
| `4+SüperStar bilen kişi sayısı` | 4 ana + superstar |
| `4 bilen kişi sayısı` | 4 ana |
| `3+SüperStar bilen kişi sayısı` | 3 ana + superstar |
| `3 bilen kişi sayısı` | 3 ana |
| `2+SüperStar bilen kişi sayısı` | 2 ana + superstar |
| `2 bilen kişi sayısı` | 2 ana |
| `1+SüperStar bilen kişi sayısı` | 1 ana + superstar |
| `0+SüperStar bilen kişi sayısı` | 0 ana + superstar |
| `null` | Hiçbir koşul sağlanmıyor → ödül yok |

---

## Veritabanı Şema Değişiklikleri

### `Result` modeli — `prizeTable` alanı ekleniyor

```js
prizeTable: [{
  category:     String,  // "6 bilen kişi sayısı"
  winnersCount: Number,  // kazanan kişi sayısı (0 da olabilir)
  prizeAmount:  String,  // "997.574.249,91 TL" (sitenin ham metni)
}]
```

- Varsayılan: `[]` (eski çekilişlerde alan boş kalır — geriye dönük scrape yapılmaz)
- `winnersCount === 0` olabilir (o kategoride kazanan yoksa site "0" yazar)

### `Prediction.evaluationResultSchema` — iki alan ekleniyor

```js
prizeCategory: { type: String, default: null }
prizeAmount:   { type: String, default: null }
```

---

## Backend Bileşenleri

### 1. `services/scraper.js` — `fetchDrawDetails` genişletiliyor

`${BASE_URL}/${drawId}` sayfası zaten çekiliyor. Aynı Cheerio parse'ında `.lottery-wins-money-item` div'leri de okunacak.

HTML yapısı:
```html
<div class="lottery-wins-money-item">
  <span>
    6 bilen kişi sayısı:
    <strong>1</strong>
  </span>
  <span>
    Kişi başına düşen ikramiye tutarı:
    <strong>997.574.249,91 TL</strong>
  </span>
</div>
```

Parse mantığı:
- Her `.lottery-wins-money-item` için:
  - İlk `<span>` içindeki `<strong>` öncesi metin → `category` (baştaki/sondaki boşluk ve `:` temizlenir)
  - İlk `<span>` içindeki `<strong>` metni → `winnersCount` (Number)
  - İkinci `<span>` içindeki `<strong>` metni → `prizeAmount` (String, ham hali korunur)
- `prizeTable` boş array dönebilir (site bazen göstermeyebilir)

### 2. `controllers/lotteryController.js` — `updateResults`

`Result.create` çağrısına `prizeTable: details.prizeTable` ekleniyor.

### 3. `services/learner.js` — `evaluatePrediction` genişletiliyor

Yeni yardımcı fonksiyon `determinePrizeCategory(numbersHit, jokerHit, superstarHit)`:
- Öncelik sırası (üstten alta):
  1. `6 + superstar` → "6+SüperStar bilen kişi sayısı"
  2. `6` → "6 bilen kişi sayısı"
  3. `5 + joker + superstar` → "5+1+SüperStar bilen kişi sayısı"
  4. `5 + joker` → "5+1 bilen kişi sayısı"
  5. `5 + superstar` → "5+SüperStar bilen kişi sayısı"
  6. `5` → "5 bilen kişi sayısı"
  7. `4 + superstar` → "4+SüperStar bilen kişi sayısı"
  8. `4` → "4 bilen kişi sayısı"
  9. `3 + superstar` → "3+SüperStar bilen kişi sayısı"
  10. `3` → "3 bilen kişi sayısı"
  11. `2 + superstar` → "2+SüperStar bilen kişi sayısı"
  12. `2` → "2 bilen kişi sayısı"
  13. `1 + superstar` → "1+SüperStar bilen kişi sayısı"
  14. `0 + superstar` → "0+SüperStar bilen kişi sayısı"
  15. Hiçbiri → `null`
- İlk eşleşen kategori etiketini döndürür

`evaluatePrediction` içinde:
- Her tahmin için `prizeCategory` hesaplanır
- `actualDraw.prizeTable` içinde `category` alanıyla string eşleştirme yapılır → `prizeAmount` bulunur
- `evaluationResults[i]` nesnesine `prizeCategory` ve `prizeAmount` eklenir

### 4. `controllers/lotteryController.js` — yeni endpoint

`GET /api/results/recent`

Döndürdüğü yapı:
```json
{
  "results": [
    {
      "drawId": 1234,
      "drawDate": "12.05.2026",
      "numbers": [3, 12, 25, 47, 68, 83],
      "joker": 45,
      "superstar": 71,
      "evaluation": {
        "predictions": [
          {
            "index": 0,
            "numbers": [...],
            "joker": 33,
            "superstar": 12,
            "prizeCategory": "3+SüperStar bilen kişi sayısı",
            "prizeAmount": "97.075,00 TL"
          },
          { "index": 1, ..., "prizeCategory": null, "prizeAmount": null },
          { "index": 2, ..., "prizeCategory": "2 bilen kişi sayısı", "prizeAmount": "..." }
        ]
      }
    },
    {
      "drawId": 1233,
      "drawDate": "10.05.2026",
      ...,
      "evaluation": null
    }
  ]
}
```

- Son 3 `Result` dokümanı `drawId` desc sıralamasıyla çekilir
- Her biri için `evaluatedAgainstDrawId === result.drawId` olan `Prediction` aranır
- Bulunamazsa `evaluation: null`

### 5. `routes/api.js`

```js
router.get('/api/results/recent', wrap(getRecentResults));
```

---

## Frontend

### Yeni section — `index.html`

Performance section'ın altına, footer'ın üstüne:

```html
<section class="section" id="results-section" style="display:none;">
  <h2 class="section-title">Son Çekiliş Sonuçları</h2>
  <div id="results-container"></div>
</section>
```

### `script.js` — `renderRecentResults(data)`

Her çekiliş için bir `.result-draw-card` oluşturulur.

Kart içeriği:
- Başlık: çekiliş tarihi
- Tahmin yapılmamışsa: tek satır "Bu çekiliş için tahmin yapılmamıştır."
- Tahmin yapılmışsa: 3 satır, her biri için:
  - `prizeCategory !== null` → yeşil badge + `prizeCategory` (kısa format) + `prizeAmount`
  - `prizeCategory === null` → soluk metin "Ödül kazanılamamıştır."

**Kategori kısaltma:** Frontend'de "6 bilen kişi sayısı" yerine "6 bilen" gösterilir (` kişi sayısı` kırpılır).

### `style.css` — yeni stiller

Mevcut tasarım diline uygun:
- `.result-draw-card` — `pred-card` ile aynı border/radius/background
- `.prize-badge` — yeşil (`var(--super)`) arkaplan, beyaz metin, küçük border-radius
- `.no-prize` — `var(--muted)` rengi
- `.no-prediction` — italik, `var(--muted)` rengi

---

## Sınır Durumları

- **Eski çekilişler:** `prizeTable: []` → evaluation sırasında `prizeAmount` bulunamaz → `null` yazılır (doğru davranış)
- **winnersCount === 0:** Ödül kategorisi var ama kazanan yok; `prizeAmount` sitede yine de gösterilir (jackpot havuzunda birikir), bu yüzden normal şekilde saklanır
- **Scrape hatası:** `prizeTable` boş array ile devam edilir, draw kaydı engellenmez
- **Tahmin yapılmamış draw:** `evaluation: null` → frontend "tahmin yapılmamıştır" gösterir
- **Mevcut değerlendirilen tahminler:** `prizeCategory/prizeAmount` alanları yoksa `null` olarak okunur — geriye dönük uyumlu

---

## Etkilenen Dosyalar

| Dosya | Repo | Değişiklik türü |
|---|---|---|
| `functions/models/Result.js` | backend | alan ekle |
| `functions/models/Prediction.js` | backend | alan ekle |
| `functions/services/scraper.js` | backend | fetchDrawDetails genişlet |
| `functions/controllers/lotteryController.js` | backend | updateResults + yeni endpoint |
| `functions/routes/api.js` | backend | yeni route |
| `functions/services/learner.js` | backend | evaluatePrediction genişlet |
| `public/index.html` | frontend | yeni section |
| `public/script.js` | frontend | yeni render fonksiyonu + API çağrısı |
| `public/style.css` | frontend | yeni stiller |
