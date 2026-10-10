import threading
from concurrent.futures import ThreadPoolExecutor

from fastapi.testclient import TestClient

from app.main import app
from tests.helpers import ADDRESS, add_product, add_to_cart, get_stock, make_admin, signup


# ---------- login aur role ----------

def test_register_cannot_choose_admin_role(client):
    res = client.post(
        "/register",
        json={"name": "Hacker", "email": "h@test.com", "password": "abc12345", "role": "admin"},
    )
    assert res.status_code == 200
    assert res.json()["role"] == "customer"


def test_login_with_wrong_password_fails(client):
    signup(client, "a@test.com")
    res = client.post("/login", json={"email": "a@test.com", "password": "wrong-pass"})
    assert res.status_code == 401


def test_customer_cannot_open_admin_routes(client):
    headers = signup(client, "a@test.com")
    assert client.get("/admin/orders", headers=headers).status_code == 403
    assert client.get("/admin/orders").status_code in (401, 403)


# ---------- products ----------

def test_search_and_pagination(client, db_session_factory):
    for i in range(11):
        add_product(db_session_factory, name=f"Item {i}")
    add_product(db_session_factory, name="Cotton Shirt")

    page1 = client.get("/products?page=1&page_size=10").json()
    page2 = client.get("/products?page=2&page_size=10").json()
    assert page1["total"] == 12
    assert len(page1["items"]) == 10
    assert len(page2["items"]) == 2

    found = client.get("/products?search=COTTON").json()
    assert found["total"] == 1


# ---------- cart ----------

def test_cart_cannot_exceed_stock(client, db_session_factory):
    product_id = add_product(db_session_factory, stock=3)
    headers = signup(client, "a@test.com")
    res = add_to_cart(client, headers, product_id, quantity=4)
    assert res.status_code == 400


# ---------- order place karna ----------

def test_order_reduces_stock_and_clears_cart(client, db_session_factory):
    product_id = add_product(db_session_factory, price=100, stock=10)
    headers = signup(client, "a@test.com")
    add_to_cart(client, headers, product_id, quantity=2)

    res = client.post("/orders", json=ADDRESS, headers=headers)
    assert res.status_code == 200
    assert res.json()["total"] == 200
    assert get_stock(db_session_factory, product_id) == 8
    assert client.get("/cart", headers=headers).json()["items"] == []


def test_failed_order_rolls_back_everything(client, db_session_factory):
    first_id = add_product(db_session_factory, name="First", stock=5)
    last_piece_id = add_product(db_session_factory, name="Last piece", stock=1)

    buyer_a = signup(client, "a@test.com")
    buyer_b = signup(client, "b@test.com")
    for headers in (buyer_a, buyer_b):
        add_to_cart(client, headers, first_id)
        add_to_cart(client, headers, last_piece_id)

    assert client.post("/orders", json=ADDRESS, headers=buyer_a).status_code == 200
    assert get_stock(db_session_factory, first_id) == 4

    res = client.post("/orders", json=ADDRESS, headers=buyer_b)
    assert res.status_code == 400

    # buyer_b ka order fail hua: "First" ka stock sirf buyer_a ki wajah se kam hua, buyer_b ki wajah se nahi
    assert get_stock(db_session_factory, first_id) == 4
    assert len(client.get("/cart", headers=buyer_b).json()["items"]) == 2


def test_order_keeps_old_price_after_price_change(client, db_session_factory):
    product_id = add_product(db_session_factory, price=100, stock=10)
    admin = signup(client, "admin@test.com")
    make_admin(db_session_factory, "admin@test.com")
    buyer = signup(client, "a@test.com")

    add_to_cart(client, buyer, product_id)
    order_id = client.post("/orders", json=ADDRESS, headers=buyer).json()["id"]

    client.put(f"/admin/products/{product_id}", json={"price": 500}, headers=admin)

    order = client.get(f"/orders/{order_id}", headers=buyer).json()
    assert order["items"][0]["price"] == 100


def test_user_cannot_see_another_users_order(client, db_session_factory):
    product_id = add_product(db_session_factory)
    buyer = signup(client, "a@test.com")
    other = signup(client, "b@test.com")

    add_to_cart(client, buyer, product_id)
    order_id = client.post("/orders", json=ADDRESS, headers=buyer).json()["id"]

    assert client.get(f"/orders/{order_id}", headers=other).status_code == 404


# ---------- cancel aur status ----------

def test_cancel_restocks_only_once(client, db_session_factory):
    product_id = add_product(db_session_factory, stock=10)
    buyer = signup(client, "a@test.com")
    add_to_cart(client, buyer, product_id, quantity=2)
    order_id = client.post("/orders", json=ADDRESS, headers=buyer).json()["id"]
    assert get_stock(db_session_factory, product_id) == 8

    assert client.post(f"/orders/{order_id}/cancel", headers=buyer).status_code == 200
    assert get_stock(db_session_factory, product_id) == 10

    assert client.post(f"/orders/{order_id}/cancel", headers=buyer).status_code == 400
    assert get_stock(db_session_factory, product_id) == 10


def test_order_status_follows_allowed_steps(client, db_session_factory):
    product_id = add_product(db_session_factory)
    admin = signup(client, "admin@test.com")
    make_admin(db_session_factory, "admin@test.com")
    buyer = signup(client, "a@test.com")

    add_to_cart(client, buyer, product_id)
    order_id = client.post("/orders", json=ADDRESS, headers=buyer).json()["id"]
    url = f"/admin/orders/{order_id}/status"

    assert client.put(url, json={"status": "delivered"}, headers=admin).status_code == 400
    assert client.put(url, json={"status": "shipped"}, headers=admin).status_code == 200
    assert client.post(f"/orders/{order_id}/cancel", headers=buyer).status_code == 400
    assert client.put(url, json={"status": "delivered"}, headers=admin).status_code == 200
    assert client.put(url, json={"status": "cancelled"}, headers=admin).status_code == 400


# ---------- sabse zaroori: aakhri piece ----------

def test_only_one_buyer_gets_the_last_piece(client, db_session_factory):
    product_id = add_product(db_session_factory, name="Last piece", stock=1)

    buyers = 8
    all_headers = []
    for i in range(buyers):
        headers = signup(client, f"buyer{i}@test.com")
        add_to_cart(client, headers, product_id)
        all_headers.append(headers)

    barrier = threading.Barrier(buyers)

    def buy(headers):
        local_client = TestClient(app)
        barrier.wait()   # sab ek saath shuru honge
        return local_client.post("/orders", json=ADDRESS, headers=headers).status_code

    with ThreadPoolExecutor(max_workers=buyers) as pool:
        codes = list(pool.map(buy, all_headers))

    assert codes.count(200) == 1
    assert codes.count(400) == buyers - 1
    assert get_stock(db_session_factory, product_id) == 0