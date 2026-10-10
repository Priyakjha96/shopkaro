from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app import models
from app.database import Base, engine
from app.routes import auth, admin, products, cart, orders

Base.metadata.create_all(bind=engine)

app = FastAPI(title="ShopKaro")
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(products.router)
app.include_router(cart.router)
app.include_router(orders.router)

STATIC_DIR = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/", include_in_schema=False)
def home():
    return FileResponse(STATIC_DIR / "index.html")


# NAYA
@app.get("/sw.js", include_in_schema=False)
def service_worker():
    return FileResponse(STATIC_DIR / "sw.js", media_type="application/javascript")


# NAYA
@app.get("/manifest.json", include_in_schema=False)
def manifest():
    return FileResponse(STATIC_DIR / "manifest.json", media_type="application/manifest+json")


@app.get("/health")
def health():
    return {"status": "ok"}