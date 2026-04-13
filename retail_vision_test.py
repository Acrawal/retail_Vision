from openai import OpenAI
from ultralytics import YOLO
import cv2
import os

# --- 1. AYARLAR: LM Studio Yerel Bağlantısı ---
# LM Studio varsayılan olarak http://localhost:1234/v1 adresini kullanır.
client = OpenAI(base_url="http://localhost:1234/v1", api_key="lm-studio")

model_yolo = YOLO('yolov8n.pt')
IMAGE_PATH = 'raf.jpg'

Kritik_Seviyeler = {"bottle": 5, "cup": 2, "apple": 3}

def analyze_photo(path):
    if not os.path.exists(path): return None
    img = cv2.imread(path)
    results = model_yolo(img, conf=0.4, verbose=False)
    
    stok_durumu = {}
    for class_id in results[0].boxes.cls.tolist():
        nesne_adi = model_yolo.names[int(class_id)]
        stok_durumu[nesne_adi] = stok_durumu.get(nesne_adi, 0) + 1

    rapor_notlari = []
    print("\n--- ANALİZ SONUCU ---")
    for urun, kritik in Kritik_Seviyeler.items():
        mevcut = stok_durumu.get(urun, 0)
        durum = "TAMAM" if mevcut >= kritik else "[EKSIK]"
        not_yazisi = f"{urun.capitalize()}: Mevcut {mevcut} / Kritik {kritik} -> {durum}"
        print(not_yazisi)
        if mevcut < kritik:
            rapor_notlari.append(not_yazisi)
            
    return stok_durumu, rapor_notlari

def get_ai_report(stok_verisi):
    print("\n--- Yerel (Llama 3.2) Raporu Hazırlanıyor... ---")
    try:
        # Gemini API kullanmıyoruz, doğrudan yerel sunucuya soruyoruz
        response = client.chat.completions.create(
            model="local-model", # LM Studio'da yüklü olan modeli kullanır
            messages=[
                {"role": "system", "content": "Sen bir perakende stok yöneticisisin. Eksik ürünleri analiz et ve Türkçe profesyonel bir rapor yaz."},
                {"role": "user", "content": f"Eksik stok listesi: {stok_verisi}"}
            ]
        )
        return response.choices[0].message.content
    except Exception as e:
        return f"Hata: Yerel sunucuya bağlanılamadı. LM Studio'da sunucunun açık olduğundan emin olun! ({e})"

# --- ÇALIŞTIR ---
sonuc = analyze_photo(IMAGE_PATH)
if sonuc:
    stok, rapor = sonuc
    rapor_metni = "\n".join(rapor) if rapor else "Tüm stoklar tamam."
    ai_analizi = get_ai_report(rapor_metni)
    
    print("\n[LOCAL AI AGENT RAPORU]:")
    print(ai_analizi)