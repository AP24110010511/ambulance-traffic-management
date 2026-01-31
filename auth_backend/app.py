from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import hashlib
import random
from datetime import datetime, timedelta

app = Flask(__name__)
CORS(app)

DB_FILE = "users.db"


def init_db():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            phone TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS otp (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone TEXT NOT NULL,
            otp TEXT NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            verified INTEGER DEFAULT 0
        )
    """)

    demo_users = [
        ("admin", "admin@test.com", "+919999999999",
         hashlib.sha256("Admin@123".encode()).hexdigest(), "admin"),
        ("driver", "driver@test.com", "+919999999998",
         hashlib.sha256("Driver@123".encode()).hexdigest(), "driver")
    ]

    for user in demo_users:
        try:
            cursor.execute(
                "INSERT INTO users (username, email, phone, password_hash, role) VALUES (?,?,?,?,?)",
                user
            )
        except:
            pass

    conn.commit()
    conn.close()
    print("Database initialized")


def get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


@app.route("/")
def home():
    return "Auth Server Running!"


@app.route("/api/auth/register", methods=["POST"])
def register():
    data = request.json
    username = data.get("username", "").lower()
    email = data.get("email", "").lower()
    phone = data.get("phone", "")
    password = data.get("password", "")
    role = data.get("role", "driver")

    if not all([username, email, phone, password]):
        return jsonify({"success": False, "message": "All fields required"}), 400

    pw_hash = hashlib.sha256(password.encode()).hexdigest()

    try:
        conn = get_db()
        conn.execute(
            "INSERT INTO users (username,email,phone,password_hash,role) VALUES (?,?,?,?,?)",
            (username, email, phone, pw_hash, role)
        )
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": "Registered successfully"}), 201
    except sqlite3.IntegrityError:
        return jsonify({"success": False, "message": "User already exists"}), 400


@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.json
    username = data.get("username", "").lower()
    password = data.get("password", "")
    role = data.get("role", "")

    conn = get_db()
    user = conn.execute(
        "SELECT * FROM users WHERE username=?",
        (username,)
    ).fetchone()
    conn.close()

    if not user:
        return jsonify({"success": False, "message": "User not found"}), 401

    pw_hash = hashlib.sha256(password.encode()).hexdigest()
    if pw_hash != user["password_hash"]:
        return jsonify({"success": False, "message": "Wrong password"}), 401

    if user["role"] != role:
        return jsonify({"success": False, "message": f"Account is for {user['role']}"}), 401

    return jsonify({
        "success": True,
        "message": "Login successful",
        "data": {
            "username": user["username"],
            "email": user["email"],
            "role": user["role"]
        }
    })


@app.route("/api/auth/send-otp", methods=["POST"])
def send_otp():
    data = request.json
    phone = data.get("phone", "")

    otp = str(random.randint(100000, 999999))
    expires = datetime.now() + timedelta(minutes=5)

    conn = get_db()
    conn.execute(
        "INSERT INTO otp (phone, otp, expires_at) VALUES (?,?,?)",
        (phone, otp, expires)
    )
    conn.commit()
    conn.close()

    print("OTP:", otp)
    return jsonify({"success": True, "otp": otp})


@app.route("/api/auth/verify-otp", methods=["POST"])
def verify_otp():
    data = request.json
    phone = data.get("phone")
    otp = data.get("otp")

    conn = get_db()
    record = conn.execute(
        "SELECT * FROM otp WHERE phone=? AND otp=? AND verified=0 ORDER BY id DESC LIMIT 1",
        (phone, otp)
    ).fetchone()

    if not record:
        return jsonify({"success": False, "message": "Invalid OTP"}), 400

    conn.execute(
        "UPDATE otp SET verified=1 WHERE id=?",
        (record["id"],)
    )
    conn.commit()
    conn.close()

    return jsonify({"success": True, "message": "OTP verified"})


if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=5000)
