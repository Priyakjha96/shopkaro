from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app import models
from app.database import Base, engine
from app.routes import auth, admin

Base.metadata.create_all(bind=engine)

app = FastAPI(title="ShopKaro")
app.include_router(auth.router)
app.include_router(admin.router)

STATIC_DIR = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/", include_in_schema=False)
def home():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/health")
def health():
    return {"status": "ok"}