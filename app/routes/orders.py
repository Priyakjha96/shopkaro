from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app import models, schemas
from app.database import get_db
from app.security import get_current_user

router = APIRouter(prefix="/orders")


def to_order_out(order: models.Order) -> dict:
    return {
        "id": order.id,
        "status": order.status,
        "total": order.total_paise / 100,
        "created_at": order.created_at.isoformat(),
        "full_name": order.full_name,
        "phone": order.phone,
        "address": order.address,
        "city": order.city,
        "pincode": order.pincode,
        "items": [
            {
                "product_id": i.product_id,
                "name": i.product_name,
                "price": i.price_paise / 100,
                "quantity": i.quantity,
                "line_total": i.price_paise * i.quantity / 100,
            }
            for i in order.items
        ],
    }


@router.post("", response_model=schemas.OrderOut)
def place_order(
    data: schemas.CheckoutRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    cart_items = (
        db.query(models.CartItem)
        .options(joinedload(models.CartItem.product))
        .filter(models.CartItem.user_id == current_user.id)
        .order_by(models.CartItem.product_id)
        .all()
    )
    if not cart_items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    try:
        total_paise = 0

        for item in cart_items:
            # "agar stock kam se kam utna hai, tabhi kam karo" (ek hi command me)
            updated = (
                db.query(models.Product)
                .filter(
                    models.Product.id == item.product_id,
                    models.Product.stock >= item.quantity,
                )
                .update(
                    {models.Product.stock: models.Product.stock - item.quantity},
                    synchronize_session=False,
                )
            )
            if updated == 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"Not enough stock for {item.product.name}",
                )
            total_paise += item.product.price_paise * item.quantity

        order = models.Order(
            user_id=current_user.id,
            total_paise=total_paise,
            status="placed",
            full_name=data.full_name.strip(),
            phone=data.phone,
            address=data.address.strip(),
            city=data.city.strip(),
            pincode=data.pincode,
        )
        db.add(order)
        db.flush()

        for item in cart_items:
            db.add(
                models.OrderItem(
                    order_id=order.id,
                    product_id=item.product_id,
                    product_name=item.product.name,
                    price_paise=item.product.price_paise,
                    quantity=item.quantity,
                )
            )
            db.delete(item)

        db.commit()
    except Exception:
        db.rollback()
        raise

    placed = (
        db.query(models.Order)
        .options(joinedload(models.Order.items))
        .filter(models.Order.id == order.id)
        .first()
    )
    return to_order_out(placed)


@router.get("/{order_id}", response_model=schemas.OrderOut)
def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    order = (
        db.query(models.Order)
        .options(joinedload(models.Order.items))
        .filter(models.Order.id == order_id, models.Order.user_id == current_user.id)
        .first()
    )
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    return to_order_out(order)