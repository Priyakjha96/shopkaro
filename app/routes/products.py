from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app import models, schemas
from app.database import get_db

router = APIRouter()


def to_product_out(p: models.Product) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "description": p.description,
        "price": p.price_paise / 100,
        "stock": p.stock,
        "category_id": p.category_id,
        "category": p.category.name,
        "image_url": p.image_url,
    }


@router.get("/categories", response_model=list[schemas.CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    return db.query(models.Category).order_by(models.Category.name).all()


@router.get("/products", response_model=schemas.ProductPage)
def list_products(
    search: str | None = None,
    category_id: int | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    query = db.query(models.Product).options(joinedload(models.Product.category))

    if search:
        query = query.filter(models.Product.name.ilike(f"%{search.strip()}%"))
    if category_id is not None:
        query = query.filter(models.Product.category_id == category_id)

    total = query.count()
    products = (
        query.order_by(models.Product.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "items": [to_product_out(p) for p in products],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/products/{product_id}", response_model=schemas.ProductOut)
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return to_product_out(product)