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