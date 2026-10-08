from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.security import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)

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


@router.post("/login")
def login(data: schemas.LoginRequest, db: Session = Depends(get_db)):
    email = data.email.strip().lower()
    user = db.query(models.User).filter(models.User.email == email).first()

    if user is None or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Wrong email or password")

    return {
        "access_token": create_access_token(user.id),
        "token_type": "bearer",
        "role": user.role,
    }


@router.get("/me", response_model=schemas.UserOut)
def me(current_user: models.User = Depends(get_current_user)):
    return current_user