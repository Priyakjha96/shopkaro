from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.security import hash_password

router = APIRouter()


@router.post("/register", response_model=schemas.UserOut)
def register(data: schemas.UserCreate, db: Session = Depends(get_db)):
    email = data.email.strip().lower()

    existing = db.query(models.User).filter(models.User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = models.User(
        name=data.name,
        email=email,
        password_hash=hash_password(data.password),
        role="customer",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user