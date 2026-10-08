from app import models
from app.database import SessionLocal

email = input("Kis user ko admin banana hai (email): ").strip().lower()

db = SessionLocal()
user = db.query(models.User).filter(models.User.email == email).first()

if user is None:
    print("Is email ka koi user nahi hai. Pehle /register karo.")
else:
    user.role = "admin"
    db.commit()
    print(user.name, "ab admin hai")

db.close()