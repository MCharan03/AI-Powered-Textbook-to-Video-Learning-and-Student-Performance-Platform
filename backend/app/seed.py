from app.core.database import SessionLocal, Base, engine
from app.models.models import User, Role, SystemSettings
from app.core.security import hash_pw

def init_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # Settings
    if not db.query(SystemSettings).first():
        db.add(SystemSettings(mastery_threshold=80.0, adaptive_per_weak=3))

    # Seed Admin
    if not db.query(User).filter(User.email == "admin@example.com").first():
        admin = User(
            name="System Administrator",
            email="admin@example.com",
            hashed_password=hash_pw("AdminPass123!"),
            role=Role.ADMIN
        )
        db.add(admin)

    # Seed Student
    student = db.query(User).filter(User.email == "student@example.com").first()
    if not student:
        student = User(
            name="Alex Student",
            email="student@example.com",
            hashed_password=hash_pw("StudentPass123!"),
            role=Role.STUDENT
        )
        db.add(student)
        db.flush()

    # Seed Parent & Teacher
    if not db.query(User).filter(User.email == "parent@example.com").first():
        parent = User(
            name="Parent Jordan",
            email="parent@example.com",
            hashed_password=hash_pw("ParentPass123!"),
            role=Role.PARENT,
            linked_student_id=student.id
        )
        db.add(parent)

    if not db.query(User).filter(User.email == "teacher@example.com").first():
        teacher = User(
            name="Teacher Morgan",
            email="teacher@example.com",
            hashed_password=hash_pw("TeacherPass123!"),
            role=Role.TEACHER,
            linked_student_id=student.id
        )
        db.add(teacher)

    db.commit()
    db.close()
    print("Database initialized and seed accounts ready:")
    print("  Admin: admin@example.com / AdminPass123!")
    print("  Student: student@example.com / StudentPass123!")
    print("  Parent: parent@example.com / ParentPass123!")
    print("  Teacher: teacher@example.com / TeacherPass123!")

if __name__ == "__main__":
    init_db()
