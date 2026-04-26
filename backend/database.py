from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import json

DATABASE_URL = "sqlite:///./retail_vision.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    display_name = Column(String)
    critical_level = Column(Integer, default=3)
    category = Column(String, default="Genel")
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class AnalysisRecord(Base):
    __tablename__ = "analysis_records"

    id = Column(Integer, primary_key=True, index=True)
    image_path = Column(String)
    image_filename = Column(String)
    detected_json = Column(Text)  # JSON string of detected items
    missing_json = Column(Text)   # JSON string of missing items
    ai_report = Column(Text)
    total_items = Column(Integer, default=0)
    missing_count = Column(Integer, default=0)
    source = Column(String, default="upload")  # upload / camera
    analyzed_at = Column(DateTime, default=datetime.utcnow)

    def set_detected(self, data: dict):
        self.detected_json = json.dumps(data, ensure_ascii=False)

    def get_detected(self) -> dict:
        return json.loads(self.detected_json) if self.detected_json else {}

    def set_missing(self, data: list):
        self.missing_json = json.dumps(data, ensure_ascii=False)

    def get_missing(self) -> list:
        return json.loads(self.missing_json) if self.missing_json else []


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
    # Seed default products
    db = SessionLocal()
    try:
        if db.query(Product).count() == 0:
            defaults = [
                Product(name="bottle", display_name="Su Şişesi", critical_level=5, category="İçecek"),
                Product(name="cup", display_name="Bardak", critical_level=2, category="Mutfak"),
                Product(name="apple", display_name="Elma", critical_level=3, category="Meyve"),
                Product(name="orange", display_name="Portakal", critical_level=3, category="Meyve"),
                Product(name="banana", display_name="Muz", critical_level=2, category="Meyve"),
                Product(name="book", display_name="Kitap", critical_level=4, category="Kırtasiye"),
                Product(name="cell phone", display_name="Cep Telefonu", critical_level=2, category="Elektronik"),
                Product(name="laptop", display_name="Laptop", critical_level=1, category="Elektronik"),
            ]
            db.add_all(defaults)
            db.commit()
    finally:
        db.close()
