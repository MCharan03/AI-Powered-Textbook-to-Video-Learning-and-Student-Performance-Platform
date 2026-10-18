from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from typing import Optional
import json

from ..core.database import get_db
from ..core.security import verify_pw, create_token, hash_pw, get_current_user
from ..models.models import User, Student, Parent, Teacher, Role
from ..schemas.schemas import LoginIn, TokenOut, UserOut

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenOut)
async def login(request: Request, db: Session = Depends(get_db)):
    # Support both JSON payload and x-www-form-urlencoded
    content_type = request.headers.get("content-type", "")
    username_or_id: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None

    if "application/json" in content_type:
        try:
            body = await request.json()
            username_or_id = body.get("identifier") or body.get("username") or body.get("email")
            password = body.get("password")
            role = body.get("role")
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid JSON payload")
    else:
        try:
            form = await request.form()
            username_or_id = form.get("identifier") or form.get("username") or form.get("email")
            password = form.get("password")
            role = form.get("role")
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid form payload")

    if not username_or_id or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username/ID and password are required"
        )

    identifier = str(username_or_id).strip()
    user: Optional[User] = None

    if role:
        role_normalized = str(role).strip().lower()
        if role_normalized == "student":
            # Student resolution:
            # 1. Match Student.student_id (e.g. CMRIT26ECE001)
            student = db.query(Student).filter(Student.student_id == identifier).first()
            if student:
                user = db.get(User, student.user_id)
            if not user:
                user = db.query(User).filter((User.username == identifier) | (User.email == identifier)).first()
            if not user or user.role != Role.STUDENT:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid credentials for selected role"
                )

        elif role_normalized == "parent":
            # Parent resolution:
            # 1. Match Parent.parent_id (e.g. PAR-CMRIT001)
            parent = db.query(Parent).filter(Parent.parent_id == identifier).first()
            if parent:
                user = db.get(User, parent.user_id)
            if not user:
                parent_email = db.query(Parent).filter(Parent.email == identifier).first()
                if parent_email:
                    user = db.get(User, parent_email.user_id)
            if not user:
                user = db.query(User).filter((User.username == identifier) | (User.email == identifier)).first()
            if not user or user.role != Role.PARENT:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid credentials for selected role"
                )

        elif role_normalized == "teacher":
            # Teacher resolution:
            # 1. Match Teacher.teacher_id OR registered email
            teacher = db.query(Teacher).filter(Teacher.teacher_id == identifier).first()
            if teacher:
                user = db.get(User, teacher.user_id)
            if not user:
                teacher_email = db.query(Teacher).filter(Teacher.email == identifier).first()
                if teacher_email:
                    user = db.get(User, teacher_email.user_id)
            if not user:
                user = db.query(User).filter((User.email == identifier) | (User.username == identifier)).first()
            if not user or user.role != Role.TEACHER:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid credentials for selected role"
                )

        elif role_normalized == "admin":
            # Admin resolution:
            # 1. Registered admin email or username
            user = db.query(User).filter((User.email == identifier) | (User.username == identifier)).first()
            if not user or user.role != Role.ADMIN:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid credentials for selected role"
                )

        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported role '{role}'"
            )

    else:
        # Fallback canonical resolution when role is not specified (backward compatibility):
        # 1. Match User.username
        user = db.query(User).filter(User.username == identifier).first()

        # 2. Match User.email
        if not user:
            user = db.query(User).filter(User.email == identifier).first()

        # 3. Match Student.student_id (e.g. CMRIT26ECE001)
        if not user:
            student = db.query(Student).filter(Student.student_id == identifier).first()
            if student:
                user = db.get(User, student.user_id)

        # 4. Match Parent.parent_id (e.g. PAR-CMRIT001)
        if not user:
            parent = db.query(Parent).filter(Parent.parent_id == identifier).first()
            if parent:
                user = db.get(User, parent.user_id)

        # 5. Match Teacher.teacher_id (e.g. TCH001)
        if not user:
            teacher = db.query(Teacher).filter(Teacher.teacher_id == identifier).first()
            if teacher:
                user = db.get(User, teacher.user_id)

        # 6. Fallback match by Student, Teacher, or Parent email
        if not user:
            student_email = db.query(Student).filter(Student.email == identifier).first()
            if student_email:
                user = db.get(User, student_email.user_id)
        if not user:
            teacher_email = db.query(Teacher).filter(Teacher.email == identifier).first()
            if teacher_email:
                user = db.get(User, teacher_email.user_id)
        if not user:
            parent_email = db.query(Parent).filter(Parent.email == identifier).first()
            if parent_email:
                user = db.get(User, parent_email.user_id)

    if not user or not verify_pw(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email, username, ID, or password"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is inactive"
        )

    role_str = user.role.value if hasattr(user.role, "value") else str(user.role)
    token = create_token(sub=str(user.id), role=role_str)

    return TokenOut(
        access_token=token,
        token_type="bearer",
        role=role_str.lower(),
        user_id=user.id,
        username=user.username,
        name=user.display_name
    )


@router.get("/me", response_model=UserOut)
def get_me(user: User = Depends(get_current_user)):
    role_str = user.role.value if hasattr(user.role, "value") else str(user.role)
    student_id = user.student.student_id if user.student else None
    parent_id = user.parent.parent_id if user.parent else None
    teacher_id = user.teacher.teacher_id if user.teacher else None
    email = user.email or (user.student.email if user.student else (user.teacher.email if user.teacher else (user.parent.email if user.parent else None)))

    return UserOut(
        id=user.id,
        username=user.username,
        name=user.display_name,
        email=email or f"{user.username}@platform.local",
        role=role_str.lower(),
        student_id=student_id,
        parent_id=parent_id,
        teacher_id=teacher_id,
        linked_student_id=user.linked_student_id,
        is_active=user.is_active,
        created_at=user.created_at
    )
