from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..core.database import get_db
from ..core.security import verify_pw, create_token, hash_pw, get_current_user
from ..models.models import User, Role
from ..schemas.schemas import LoginIn, TokenOut, UserOut, UserCreate

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=TokenOut)
def login(login_in: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == login_in.email).first()
    if not user or not verify_pw(login_in.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    role_str = user.role.value if hasattr(user.role, "value") else str(user.role)
    token = create_token(sub=str(user.id), role=role_str)
    return TokenOut(
        access_token=token,
        token_type="bearer",
        role=role_str,
        user_id=user.id,
        name=user.name
    )

@router.get("/me", response_model=UserOut)
def get_me(user: User = Depends(get_current_user)):
    return user
