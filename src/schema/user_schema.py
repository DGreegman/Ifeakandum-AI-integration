from datetime import datetime
from pydantic import BaseModel


class UserRegister(BaseModel):
    email: str
    username: str
    password: str
    role: str = "doctor"  # admin | doctor | viewer


class UserLogin(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: int
    email: str
    username: str
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
