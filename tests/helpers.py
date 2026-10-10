from app import models

ADDRESS = {
    "full_name": "Test User",
    "phone": "9876543210",
    "address": "12 MG Road, Sector 5",
    "city": "Jamshedpur",
    "pincode": "831001",
}


def signup(client, email, password="abc12345"):
    client.post("/register", json={"name": "Test User", "email": email, "password": password})
    res = client.post("/login", json={"email": email, "password": password})
    return {"Authorization": "Bearer " + res.json()["access_token"]}


def make_admin(factory, email):
    db = factory()
    user = db.query(models.User).filter(models.User.email == email).first()
    user.role = "admin"
    db.commit()
    db.close()


def add_product(factory, name="Test Product", price=100, stock=10, category="Books"):
    db = factory()
    category_row = db.query(models.Category).filter(models.Category.name == category).first()
    if category_row is None:
        category_row = models.Category(name=category)
        db.add(category_row)
        db.flush()

    product = models.Product(
        category_id=category_row.id,
        name=name,
        description="",
        price_paise=price * 100,
        stock=stock,
    )
    db.add(product)
    db.commit()
    product_id = product.id
    db.close()
    return product_id


def get_stock(factory, product_id):
    db = factory()
    stock = db.query(models.Product).filter(models.Product.id == product_id).first().stock
    db.close()
    return stock


def add_to_cart(client, headers, product_id, quantity=1):
    return client.post(
        "/cart/items",
        json={"product_id": product_id, "quantity": quantity},
        headers=headers,
    )