from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app import models, schemas
from app.database import get_db
from app.security import get_current_user

router = APIRouter(prefix="/cart")


def build_cart(db: Session, user_id: int) -> dict:
    rows = (
        db.query(models.CartItem)
        .options(joinedload(models.CartItem.product))
        .filter(models.CartItem.user_id == user_id)
        .order_by(models.CartItem.id)
        .all()
    )

    items = []
    total_paise = 0
    for row in rows:
        line_paise = row.product.price_paise * row.quantity
        total_paise += line_paise
        items.append(
            {
                "product_id": row.product_id,
                "name": row.product.name,
                "price": row.product.price_paise / 100,
                "quantity": row.quantity,
                "line_total": line_paise / 100,
                "stock": row.product.stock,
                "image_url": row.product.image_url,
            }
        )

    return {
        "items": items,
        "total": total_paise / 100,
        "item_count": sum(i["quantity"] for i in items),
    }


def find_cart_item(db: Session, user_id: int, product_id: int):
    return (
        db.query(models.CartItem)
        .filter(models.CartItem.user_id == user_id, models.CartItem.product_id == product_id)
        .first()
    )


@router.get("", response_model=schemas.CartOut)
def get_cart(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return build_cart(db, current_user.id)


@router.post("/items", response_model=schemas.CartOut)
def add_to_cart(
    data: schemas.CartAdd,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    product = db.query(models.Product).filter(models.Product.id == data.product_id).first()
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    if product.stock == 0:
        raise HTTPException(status_code=400, detail="Out of stock")

    item = find_cart_item(db, current_user.id, product.id)
    new_quantity = data.quantity + (item.quantity if item else 0)

    if new_quantity > product.stock:
        raise HTTPException(status_code=400, detail=f"Only {product.stock} in stock")

    if item:
        item.quantity = new_quantity
    else:
        db.add(models.CartItem(user_id=current_user.id, product_id=product.id, quantity=new_quantity))

    db.commit()
    return build_cart(db, current_user.id)


@router.put("/items/{product_id}", response_model=schemas.CartOut)
def set_quantity(
    product_id: int,
    data: schemas.CartUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    item = find_cart_item(db, current_user.id, product_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Item not in cart")

    if data.quantity > item.product.stock:
        raise HTTPException(status_code=400, detail=f"Only {item.product.stock} in stock")

    item.quantity = data.quantity
    db.commit()
    return build_cart(db, current_user.id)


@router.delete("/items/{product_id}", response_model=schemas.CartOut)
def remove_from_cart(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    item = find_cart_item(db, current_user.id, product_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Item not in cart")

    db.delete(item)
    db.commit()
    return build_cart(db, current_user.id)