from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, selectinload

from app import models, schemas
from app.database import get_db
from app.routes.orders import (
    ALLOWED_NEXT,
    claim_status,
    load_order,
    restock_and_cancel,
    to_order_out,
)
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


@router.get("/orders", response_model=list[schemas.AdminOrderOut])
def list_all_orders(
    status: str | None = None,
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = (
        db.query(models.Order, models.User)
        .join(models.User, models.User.id == models.Order.user_id)
        .options(selectinload(models.Order.items))
    )
    if status:
        query = query.filter(models.Order.status == status)

    rows = query.order_by(models.Order.id.desc()).limit(limit).all()

    result = []
    for order, user in rows:
        data = to_order_out(order)
        data["customer_name"] = user.name
        data["customer_email"] = user.email
        result.append(data)
    return result


@router.put("/orders/{order_id}/status", response_model=schemas.OrderOut)
def update_order_status(
    order_id: int,
    data: schemas.StatusUpdate,
    db: Session = Depends(get_db),
):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    current = order.status
    new_status = data.status

    if new_status not in ALLOWED_NEXT.get(current, set()):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot move order from {current} to {new_status}",
        )

    try:
        if new_status == "cancelled":
            ok = restock_and_cancel(db, order_id, {current})
        else:
            ok = claim_status(db, order_id, current, new_status)

        if not ok:
            raise HTTPException(status_code=409, detail="Order was just changed. Please refresh.")
        db.commit()
    except Exception:
        db.rollback()
        raise

    return to_order_out(load_order(db, order_id))