from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.routes.products import to_product_out
from app.security import require_admin

# Is router ke saare routes ke upar admin ka guard apne aap lag jata hai
router = APIRouter(prefix="/admin", dependencies=[Depends(require_admin)])


@router.get("/ping")
def ping(admin: models.User = Depends(require_admin)):
    return {"message": f"Namaste admin {admin.name}"}


@router.post("/categories", response_model=schemas.CategoryOut)
def create_category(data: schemas.CategoryCreate, db: Session = Depends(get_db)):
    name = data.name.strip()
    existing = db.query(models.Category).filter(models.Category.name == name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Category already exists")

    category = models.Category(name=name)
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.post("/products", response_model=schemas.ProductOut)
def create_product(data: schemas.ProductCreate, db: Session = Depends(get_db)):
    category = db.query(models.Category).filter(models.Category.id == data.category_id).first()
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found")

    product = models.Product(
        category_id=data.category_id,
        name=data.name.strip(),
        description=data.description,
        price_paise=round(data.price * 100),
        stock=data.stock,
        image_url=data.image_url,
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return to_product_out(product)


@router.put("/products/{product_id}", response_model=schemas.ProductOut)
def update_product(product_id: int, data: schemas.ProductUpdate, db: Session = Depends(get_db)):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")

    if data.category_id is not None:
        category = db.query(models.Category).filter(models.Category.id == data.category_id).first()
        if category is None:
            raise HTTPException(status_code=404, detail="Category not found")
        product.category_id = data.category_id
    if data.name is not None:
        product.name = data.name.strip()
    if data.description is not None:
        product.description = data.description
    if data.price is not None:
        product.price_paise = round(data.price * 100)
    if data.stock is not None:
        product.stock = data.stock
    if data.image_url is not None:
        product.image_url = data.image_url

    db.commit()
    db.refresh(product)
    return to_product_out(product)