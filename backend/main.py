from fastapi import FastAPI, File, UploadFile, Depends, HTTPException, Form
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse, HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from datetime import datetime, timedelta
from pathlib import Path
import shutil
import os
import json

from backend.database import get_db, init_db, AnalysisRecord, Product
from backend.models import (
    ProductCreate, ProductOut, ProductUpdate,
    AnalysisResult, StatsResponse, CameraStatus,
)
from backend.analyzer import analyzer
from backend.llm_client import generate_report
from backend.camera import camera_manager

# ─── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent.parent
UPLOAD_DIR = BASE_DIR / "uploads"
FRONTEND_DIR = BASE_DIR / "frontend"
UPLOAD_DIR.mkdir(exist_ok=True)

# ─── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(title="RetailVision API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve frontend
app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")


@app.on_event("startup")
async def startup():
    init_db()


# ─── Root ─────────────────────────────────────────────────────────────────────
@app.get("/", response_class=HTMLResponse)
async def root():
    html_path = FRONTEND_DIR / "index.html"
    return html_path.read_text(encoding="utf-8")


# ─── Products ─────────────────────────────────────────────────────────────────
@app.get("/api/products", response_model=list[ProductOut])
def get_products(db: Session = Depends(get_db)):
    return db.query(Product).all()


@app.post("/api/products", response_model=ProductOut)
def create_product(product: ProductCreate, db: Session = Depends(get_db)):
    existing = db.query(Product).filter(Product.name == product.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Bu ürün zaten mevcut.")
    p = Product(**product.model_dump())
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@app.put("/api/products/{product_id}", response_model=ProductOut)
def update_product(product_id: int, updates: ProductUpdate, db: Session = Depends(get_db)):
    p = db.query(Product).filter(Product.id == product_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı.")
    for field, value in updates.model_dump(exclude_none=True).items():
        setattr(p, field, value)
    db.commit()
    db.refresh(p)
    return p


@app.delete("/api/products/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db)):
    p = db.query(Product).filter(Product.id == product_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı.")
    db.delete(p)
    db.commit()
    return {"ok": True}


# ─── Analysis ─────────────────────────────────────────────────────────────────
@app.post("/api/analyze")
async def analyze_image(
    file: UploadFile = File(...),
    conf: float = Form(default=0.35),
    db: Session = Depends(get_db),
):
    # Save upload
    ext = Path(file.filename).suffix or ".jpg"
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    save_path = UPLOAD_DIR / f"upload_{ts}{ext}"
    with open(save_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        # YOLO detection
        detection = analyzer.analyze_image(str(save_path), conf=conf)
        detected = detection["detected"]
        annotated_b64 = detection["annotated_image"]
        total_items = detection["total_items"]

        # Stock status
        products = db.query(Product).filter(Product.active == True).all()
        stock = analyzer.compute_stock_status(detected, products)
        items = stock["items"]
        missing = stock["missing"]

        # AI report
        ai_report = await generate_report(missing, detected)

        # Save to DB
        record = AnalysisRecord(
            image_path=str(save_path),
            image_filename=file.filename,
            total_items=total_items,
            missing_count=len(missing),
            ai_report=ai_report,
            source="upload",
        )
        record.set_detected(detected)
        record.set_missing(missing)
        db.add(record)
        db.commit()
        db.refresh(record)

        return {
            "id": record.id,
            "detected": detected,
            "items": items,
            "missing": missing,
            "ai_report": ai_report,
            "total_items": total_items,
            "missing_count": len(missing),
            "annotated_image": annotated_b64,
            "analyzed_at": record.analyzed_at.isoformat(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/analyze/camera")
async def analyze_camera_frame(db: Session = Depends(get_db)):
    """Capture current camera frame and analyze it."""
    frame = camera_manager.get_frame()
    if frame is None:
        raise HTTPException(status_code=400, detail="Kamera aktif değil veya kare alınamadı.")

    detection = analyzer.analyze_frame(frame)
    detected = detection["detected"]
    annotated_b64 = detection["annotated_image"]
    total_items = detection["total_items"]

    products = db.query(Product).filter(Product.active == True).all()
    stock = analyzer.compute_stock_status(detected, products)
    missing = stock["missing"]
    items = stock["items"]

    ai_report = await generate_report(missing, detected)

    record = AnalysisRecord(
        image_path="camera",
        image_filename="camera_frame.jpg",
        total_items=total_items,
        missing_count=len(missing),
        ai_report=ai_report,
        source="camera",
    )
    record.set_detected(detected)
    record.set_missing(missing)
    db.add(record)
    db.commit()
    db.refresh(record)

    return {
        "id": record.id,
        "detected": detected,
        "items": items,
        "missing": missing,
        "ai_report": ai_report,
        "total_items": total_items,
        "missing_count": len(missing),
        "annotated_image": annotated_b64,
        "analyzed_at": record.analyzed_at.isoformat(),
    }


# ─── History ──────────────────────────────────────────────────────────────────
@app.get("/api/history")
def get_history(limit: int = 50, db: Session = Depends(get_db)):
    records = (
        db.query(AnalysisRecord)
        .order_by(desc(AnalysisRecord.analyzed_at))
        .limit(limit)
        .all()
    )
    return [
        {
            "id": r.id,
            "image_filename": r.image_filename,
            "total_items": r.total_items,
            "missing_count": r.missing_count,
            "missing": r.get_missing(),
            "detected": r.get_detected(),
            "ai_report": r.ai_report,
            "source": r.source,
            "analyzed_at": r.analyzed_at.isoformat(),
        }
        for r in records
    ]


@app.delete("/api/history/{record_id}")
def delete_record(record_id: int, db: Session = Depends(get_db)):
    r = db.query(AnalysisRecord).filter(AnalysisRecord.id == record_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Kayıt bulunamadı.")
    db.delete(r)
    db.commit()
    return {"ok": True}


# ─── Stats ────────────────────────────────────────────────────────────────────
@app.get("/api/stats")
def get_stats(db: Session = Depends(get_db)):
    total = db.query(func.count(AnalysisRecord.id)).scalar() or 0
    total_items = db.query(func.sum(AnalysisRecord.total_items)).scalar() or 0
    total_missing = db.query(func.sum(AnalysisRecord.missing_count)).scalar() or 0
    avg_missing = round(total_missing / total, 2) if total else 0

    # Most missing product
    records = db.query(AnalysisRecord).all()
    missing_counter = {}
    for r in records:
        for item in r.get_missing():
            missing_counter[item] = missing_counter.get(item, 0) + 1
    most_missing = max(missing_counter, key=missing_counter.get) if missing_counter else None

    # Recent 10
    recent = (
        db.query(AnalysisRecord)
        .order_by(desc(AnalysisRecord.analyzed_at))
        .limit(10)
        .all()
    )
    recent_data = [
        {
            "id": r.id,
            "image_filename": r.image_filename,
            "total_items": r.total_items,
            "missing_count": r.missing_count,
            "source": r.source,
            "analyzed_at": r.analyzed_at.isoformat(),
        }
        for r in recent
    ]

    # Chart data: last 7 days
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    daily = {}
    for r in db.query(AnalysisRecord).filter(AnalysisRecord.analyzed_at >= seven_days_ago).all():
        day = r.analyzed_at.strftime("%d %b")
        if day not in daily:
            daily[day] = {"analyses": 0, "missing": 0, "items": 0}
        daily[day]["analyses"] += 1
        daily[day]["missing"] += r.missing_count
        daily[day]["items"] += r.total_items

    return {
        "total_analyses": total,
        "total_items_detected": total_items,
        "total_missing": total_missing,
        "avg_missing_per_analysis": avg_missing,
        "most_missing_product": most_missing,
        "recent_analyses": recent_data,
        "daily_chart": daily,
        "missing_frequency": missing_counter,
    }


# ─── Camera ───────────────────────────────────────────────────────────────────
@app.post("/api/camera/start")
def start_camera(source: str = Form(default="0")):
    src = int(source) if source.isdigit() else source
    ok = camera_manager.start(src)
    if not ok:
        raise HTTPException(status_code=500, detail="Kamera açılamadı. Bağlı kamera var mı?")
    return {"active": True, "source": str(src), "fps": camera_manager.fps}


@app.post("/api/camera/stop")
def stop_camera():
    camera_manager.stop()
    return {"active": False}


@app.get("/api/camera/status")
def camera_status():
    return {
        "active": camera_manager.active,
        "source": str(camera_manager.source),
        "fps": round(camera_manager.fps, 1),
    }


@app.get("/api/camera/stream")
def camera_stream():
    if not camera_manager.active:
        raise HTTPException(status_code=400, detail="Kamera aktif değil.")
    return StreamingResponse(
        camera_manager.generate_mjpeg(),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )
