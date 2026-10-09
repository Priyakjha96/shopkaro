from pydantic import BaseModel, Field


class UserCreate(BaseModel):
    name: str
    email: str
    password: str = Field(min_length=6)


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    role: str

    model_config = {"from_attributes": True}


class LoginRequest(BaseModel):
    email: str
    password: str


# NAYA
class CategoryCreate(BaseModel):
    name: str


# NAYA
class CategoryOut(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


# NAYA
class ProductCreate(BaseModel):
    name: str
    description: str = ""
    price: float = Field(gt=0)
    stock: int = Field(default=0, ge=0)
    category_id: int
    image_url: str | None = None


# NAYA
class ProductUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    price: float | None = Field(default=None, gt=0)
    stock: int | None = Field(default=None, ge=0)
    category_id: int | None = None
    image_url: str | None = None


# NAYA
class ProductOut(BaseModel):
    id: int
    name: str
    description: str
    price: float
    stock: int
    category_id: int
    category: str
    image_url: str | None = None


# NAYA
class ProductPage(BaseModel):
    items: list[ProductOut]
    total: int
    page: int
    page_size: int