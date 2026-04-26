# RetailVision v2.0 — AI Perakende Stok Takip Sistemi

Mağaza raflarındaki ürünleri **YOLOv8** ile tespit eden, **Llama 3.2 (yerel LLM)** ile Türkçe stok raporu üreten ve tam web dashboard'u olan profesyonel bir yapay zeka sistemi.

## 🚀 Özellikler

| Özellik | Açıklama |
|---|---|
| **YOLOv8 Tespiti** | Fotoğraf veya kameradan ürün tespiti, bounding box |
| **Web Dashboard** | Premium dark-theme 5-sekmeli dashboard |
| **Canlı Kamera** | Webcam / IP kamera MJPEG akışı + anlık analiz |
| **AI Raporu** | Llama 3.2 ile Türkçe profesyonel stok raporu |
| **Stok Geçmişi** | SQLite veritabanında tüm analizler kaydedilir |
| **Grafik & İstatistik** | Chart.js ile trend grafiği, eksik ürün analizi |
| **Ürün Yönetimi** | YOLO sınıf adı, Türkçe ad, kritik seviye tanımla |
| **REST API** | FastAPI ile tam dokümanlı OpenAPI endpoint'leri |

## 🛠️ Kurulum & Başlatma

```bash
# 1. Bağımlılıkları yükle
pip install -r requirements.txt

# 2. Sunucuyu başlat (Windows: start.bat'a çift tıkla)
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

**Tarayıcıda aç:** http://localhost:8000  
**API Docs:** http://localhost:8000/docs

## 📁 Proje Yapısı

```
retail_Vision/
├── backend/
│   ├── main.py         # FastAPI — tüm endpoint'ler
│   ├── analyzer.py     # YOLOv8 analiz motoru
│   ├── llm_client.py   # LM Studio bağlantısı
│   ├── database.py     # SQLite ORM (ürünler, analizler)
│   ├── camera.py       # Kamera akış yöneticisi
│   └── models.py       # Pydantic şemaları
├── frontend/
│   ├── index.html      # Ana dashboard (5 sekme)
│   ├── css/style.css   # Premium dark tema
│   └── js/
│       ├── app.js      # Tab, analiz, geçmiş, ürünler
│       ├── charts.js   # Chart.js grafikler
│       └── camera.js   # Kamera kontrolü
├── yolov8n.pt          # YOLOv8 modeli
├── requirements.txt
├── start.bat           # Windows tek-tık başlatma
└── retail_vision_test.py  # Eski script (korundu)
```

## 🤖 LLM Kurulumu (İsteğe Bağlı)

AI raporları için LM Studio gereklidir:
1. [LM Studio](https://lmstudio.ai) indir ve kur
2. `Llama 3.2` modelini indir
3. **Local Server → Start Server** (Port: 1234)
4. Dashboard sol alt köşede yeşil **LLM: Aktif** görünecek

> LM Studio olmadan sistem yine çalışır — fallback metin raporu üretir.

## 📡 API Endpoints

| Method | Endpoint | Açıklama |
|---|---|---|
| `POST` | `/api/analyze` | Görsel yükle + analiz et |
| `POST` | `/api/analyze/camera` | Kamera karesi analiz et |
| `GET` | `/api/history` | Analiz geçmişi |
| `GET` | `/api/stats` | İstatistikler & grafik verisi |
| `GET/POST` | `/api/products` | Ürün listesi / ekle |
| `PUT/DELETE` | `/api/products/{id}` | Ürün güncelle / sil |
| `POST` | `/api/camera/start` | Kamerayı başlat |
| `POST` | `/api/camera/stop` | Kamerayı durdur |
| `GET` | `/api/camera/stream` | MJPEG canlı akış |