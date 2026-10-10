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
# NAYA
class CartAdd(BaseModel):
    product_id: int
    quantity: int = Field(default=1, ge=1, le=20)


# NAYA
class CartUpdate(BaseModel):
    quantity: int = Field(ge=1, le=20)


# NAYA
class CartItemOut(BaseModel):
    product_id: int
    name: str
    price: float
    quantity: int
    line_total: float
    stock: int
    image_url: str | None = None


# NAYA
class CartOut(BaseModel):
    items: list[CartItemOut]
    total: float
    item_count: int
    # NAYA
class CheckoutRequest(BaseModel):
    full_name: str = Field(min_length=2)
    phone: str = Field(pattern=r"^\d{10}$")
    address: str = Field(min_length=5)
    city: str = Field(min_length=2)
    pincode: str = Field(pattern=r"^\d{6}$")


# NAYA
class OrderItemOut(BaseModel):
    product_id: int
    name: str
    price: float
    quantity: int
    line_total: float


# NAYA
class OrderOut(BaseModel):
    id: int
    status: str
    total: float
    created_at: str
    full_name: str
    phone: str
    address: str
    city: str
    pincode: str
    items: list[OrderItemOut]
# NAYA
class StatusUpdate(BaseModel):
    status: str


# NAYA
class AdminOrderOut(OrderOut):
    customer_name: str
    customer_email: str