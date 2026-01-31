"""
Ambulance Traffic Management System - Authentication Backend
Flask + SQLite + SMS OTP via Twilio
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import hashlib
import random
from datetime import datetime, timedelta
import os

app = Flask(__name__)
CORS(app)

DB_FILE = 'users.db'

# Twilio Configuration (for real SMS)
TWILIO_ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID', '')
TWILIO_AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN', '')
TWILIO_PHONE = os.environ.get('TWILIO_PHONE', '')

def init_db():
    """Initialize SQLite database"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            phone TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL,
            security_question TEXT,
            security_answer TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS otp_verification (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone TEXT NOT NULL,
            otp TEXT NOT NULL,
            purpose TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP NOT NULL,
            verified BOOLEAN DEFAULT 0
        )
    ''')
    
    # Demo users
    demo_users = [
        ('admin', 'admin@vibecraft.com', '+919999999999',
         hashlib.sha256('Admin@123'.encode()).hexdigest(), 'admin',
         'What is your favorite color?', 'blue'),
        ('driver', 'driver@vibecraft.com', '+919999999998',
         hashlib.sha256('Driver@123'.encode()).hexdigest(), 'driver',
         'What is your vehicle number?', 'ap1234'),
        ('demo', 'demo@vibecraft.com', '+919999999997',
         hashlib.sha256('Demo@123'.encode()).hexdigest(), 'admin',
         'What city were you born in?', 'hyderabad')
    ]
    
    for user in demo_users:
        try:
            cursor.execute('''
                INSERT INTO users (username, email, phone, password_hash, role, security_question, security_answer)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', user)
        except sqlite3.IntegrityError:
            pass
    
    conn.commit()
    conn.close()
    print("✅ SQLite database initialized")

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def generate_otp():
    """Generate 6-digit OTP"""
    return str(random.randint(100000, 999999))

def send_sms_twilio(phone, otp):
    """Send OTP via Twilio SMS or demo mode"""
    if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
        try:
            from twilio.rest import Client
            client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
            message = client.messages.create(
                body=f'VibeCraft OTP: {otp}\nValid for 5 minutes.',
                from_=TWILIO_PHONE,
                to=phone
            )
            print(f"✅ Real SMS sent to {phone}")
            return True
        except Exception as e:
            print(f"Twilio error: {e}")
    
    # Demo mode - show in console
    print(f"""
    ╔══════════════════════════════════════════════════════════╗
    ║                    📱 SMS OTP (Demo)                      ║
    ╠══════════════════════════════════════════════════════════╣
    ║  To: {phone:<50}   ║
    ║  OTP: {otp} (Valid for 5 minutes)                              ║
    ╚══════════════════════════════════════════════════════════╝
    """)
    return True

# ==================== AUTH ROUTES ====================

@app.route('/api/auth/login', methods=['POST'])
def login():
    """User login"""
    data = request.get_json()
    username = data.get('username', '').lower().strip()
    password = data.get('password', '')
    role = data.get('role', '')
    
    conn = get_db_connection()
    user = conn.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
    conn.close()
    
    if not user:
        return jsonify({'success': False, 'message': 'User not found.'}), 401
    
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    if password_hash != user['password_hash']:
        return jsonify({'success': False, 'message': 'Incorrect password.'}), 401
    
    if user['role'] != role:
        return jsonify({'success': False, 'message': f'This account is for {user["role"].upper()} role.'}), 401
    
    session_token = hashlib.sha256(f"{username}{datetime.now().timestamp()}".encode()).hexdigest()[:32]
    
    return jsonify({
        'success': True,
        'message': 'Login successful!',
        'data': {
            'username': user['username'],
            'role': user['role'],
            'email': user['email'],
            'session_token': session_token
        }
    }), 200

@app.route('/api/auth/register', methods=['POST'])
def register():
    """Register new user"""
    data = request.get_json()
    username = data.get('username', '').lower().strip()
    email = data.get('email', '').strip().lower()
    phone = data.get('phone', '').strip()
    password = data.get('password', '')
    role = data.get('role', 'driver')
    
    if len(password) < 8 or not any(c.isupper() for c in password) or not any(c.isdigit() for c in password):
        return jsonify({'success': False, 'message': 'Password must be 8+ chars with uppercase and number'}), 400
    
    conn = get_db_connection()
    try:
        password_hash = hashlib.sha256(password.encode()).hexdigest()
        conn.execute('''
            INSERT INTO users (username, email, phone, password_hash, role, security_question, security_answer)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (username, email, phone, password_hash, role, 'Color?', 'blue'))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Registration successful! Please login.'}), 201
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({'success': False, 'message': 'Username, email, or phone already exists.'}), 400

@app.route('/api/auth/send-sms-otp', methods=['POST'])
def send_sms_otp():
    """Send OTP to phone"""
    data = request.get_json()
    phone = data.get('phone', '').strip()
    purpose = data.get('purpose', 'reset')
    
    conn = get_db_connection()
    user = conn.execute('SELECT * FROM users WHERE phone = ?', (phone,)).fetchone()
    conn.close()
    
    if not user:
        return jsonify({'success': False, 'message': 'Phone number not registered.'}), 404
    
    # Generate OTP
    otp = generate_otp()
    expires_at = datetime.now() + timedelta(minutes=5)
    
    conn = get_db_connection()
    conn.execute('''
        INSERT INTO otp_verification (phone, otp, purpose, expires_at)
        VALUES (?, ?, ?, ?)
    ''', (phone, otp, purpose, expires_at))
    conn.commit()
    conn.close()
    
    # Send SMS
    send_sms_twilio(phone, otp)
    
    return jsonify({
        'success': True,
        'message': f'OTP sent to {phone} via SMS!',
        'debug_otp': otp
    }), 200

@app.route('/api/auth/verify-sms-otp', methods=['POST'])
def verify_sms_otp():
    """Verify OTP"""
    data = request.get_json()
    phone = data.get('phone', '').strip()
    otp = data.get('otp', '')
    purpose = data.get('purpose', 'reset')
    
    conn = get_db_connection()
    otp_record = conn.execute('''
        SELECT * FROM otp_verification 
        WHERE phone = ? AND otp = ? AND purpose = ? AND verified = 0
        ORDER BY created_at DESC LIMIT 1
    ''', (phone, otp, purpose)).fetchone()
    
    if not otp_record:
        conn.close()
        return jsonify({'success': False, 'message': 'Invalid or expired OTP.'}), 400
    
    expires_at = datetime.strptime(otp_record['expires_at'], '%Y-%m-%d %H:%M:%S.%f')
    if datetime.now() > expires_at:
        conn.close()
        return jsonify({'success': False, 'message': 'OTP expired. Request new one.'}), 400
    
    conn.execute('UPDATE otp_verification SET verified = 1 WHERE id = ?', (otp_record['id'],))
    conn.commit()
    conn.close()
    
    return jsonify({'success': True, 'message': 'OTP verified!'}), 200

@app.route('/api/auth/reset-password-phone', methods=['POST'])
def reset_password_phone():
    """Reset password after OTP verification"""
    data = request.get_json()
    phone = data.get('phone', '').strip()
    new_password = data.get('password', '')
    
    if len(new_password) < 8 or not any(c.isupper() for c in new_password) or not any(c.isdigit() for c in new_password):
        return jsonify({'success': False, 'message': 'Password must be 8+ chars with uppercase and number'}), 400
    
    conn = get_db_connection()
    otp_verified = conn.execute('''
        SELECT id FROM otp_verification 
        WHERE phone = ? AND verified = 1 AND purpose = 'reset'
        ORDER BY created_at DESC LIMIT 1
    ''', (phone,)).fetchone()
    
    if not otp_verified:
        conn.close()
        return jsonify({'success': False, 'message': 'Verify OTP first.'}), 400
    
    password_hash = hashlib.sha256(new_password.encode()).hexdigest()
    conn.execute('UPDATE users SET password_hash = ? WHERE phone = ?', (password_hash, phone))
    conn.commit()
    conn.close()
    
    return jsonify({'success': True, 'message': 'Password reset successful!'}), 200

@app.route('/api/users', methods=['GET'])
def get_users():
    """Get all users"""
    conn = get_db_connection()
    users = conn.execute('SELECT id, username, email, phone, role, created_at FROM users').fetchall()
    conn.close()
    return jsonify({'success': True, 'users': [dict(u) for u in users]}), 200

if __name__ == '__main__':
    init_db()
    print("\n" + "="*60)
    print("  🚑 VibeCraft Auth Server")
    print("  📍 Running on http://localhost:5000")
    print("="*60)
    print("\n📝 Demo Users:")
    print("   admin  / Admin@123  → 📱 +919999999999")
    print("   driver / Driver@123 → 📱 +919999999998")
    print("\n🔧 For real SMS, configure Twilio:")
    print("   export TWILIO_ACCOUNT_SID='your_sid'")
    print("   export TWILIO_AUTH_TOKEN='your_token'")
    print("   export TWILIO_PHONE='+1234567890'")
    print("="*60 + "\n")
    
    app.run(host='0.0.0.0', port=5000, debug=True)
