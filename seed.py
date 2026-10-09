from app import models
from app.database import Base, SessionLocal, engine

Base.metadata.create_all(bind=engine)

SAMPLE = {
    "Mobiles": [("Wireless earbuds", 1299, 25), ("Phone case", 299, 60), ("Fast charger 33W", 799, 40)],
    "Fashion": [("Cotton T-shirt", 499, 50), ("Running shoes", 1799, 15), ("Denim jacket", 1999, 10)],
    "Home": [("Steel water bottle", 349, 80), ("Study lamp", 649, 30), ("Cotton bedsheet", 899, 20)],
    "Books": [("Python basics book", 399, 35), ("DSA notes notebook", 199, 100), ("Sketchbook", 249, 45)],
}

db = SessionLocal()

for category_name, items in SAMPLE.items():
    category = db.query(models.Category).filter(models.Category.name == category_name).first()
    if category is None:
        category = models.Category(name=category_name)
        db.add(category)
        db.flush()

    for name, price, stock in items:
        exists = db.query(models.Product).filter(models.Product.name == name).first()
        if exists is None:
            db.add(
                models.Product(
                    category_id=category.id,
                    name=name,
                    description="Sample product",
                    price_paise=price * 100,
                    stock=stock,
                )
            )

db.commit()
db.close()
print("Sample products ready")