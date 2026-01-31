/**
 * VibeCraft Login Page JavaScript
 * Ambulance Traffic Management System
 */

const API_BASE = 'http://localhost:5000/api';
let selectedRole = 'admin';

// Role Selection
function selectRole(role) {
  selectedRole = role;
  document.querySelectorAll('.role-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.role === role);
  });
}

// Password Toggle
function togglePassword() {
  const input = document.getElementById('password');
  input.type = input.type === 'password' ? 'text' : 'password';
}

// Login Handler
async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('username').value.trim().toLowerCase();
  const password = document.getElementById('password').value;
  const errorMsg = document.getElementById('errorMsg');
  const loginBtn = document.getElementById('loginBtn');
  
  errorMsg.style.display = 'none';
  loginBtn.innerHTML = '<span style="margin-right: 10px;">⏳</span>Signing in...';
  loginBtn.disabled = true;
  
  try {
    const response = await fetch(API_BASE + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, role: selectedRole })
    });
    const data = await response.json();
    
    if (data.success) {
      localStorage.setItem('userRole', data.data.role);
      localStorage.setItem('username', data.data.username);
      loginBtn.innerHTML = '✅ Login Successful!';
      setTimeout(() => window.location.href = 'index.html', 1000);
    } else {
      errorMsg.textContent = data.message;
      errorMsg.style.display = 'block';
      loginBtn.innerHTML = '🔐 Sign In';
      loginBtn.disabled = false;
    }
  } catch (error) {
    errorMsg.textContent = '❌ Server offline. Start Python backend: cd auth_backend && python app.py';
    errorMsg.style.display = 'block';
    loginBtn.innerHTML = '🔐 Sign In';
    loginBtn.disabled = false;
  }
}

// Forgot Password Modal Functions
function openForgotModal() { 
  document.getElementById('forgotModal').classList.add('active'); 
  resetForgotSteps(); 
}

function closeForgotModal() { 
  document.getElementById('forgotModal').classList.remove('active'); 
  resetForgotSteps(); 
}

function resetForgotSteps() {
  document.querySelectorAll('#forgotModal .step').forEach(s => s.classList.remove('active'));
  document.getElementById('fpStep1').classList.add('active');
  document.getElementById('otpDisplay').classList.remove('show');
  document.getElementById('fpPhone').value = '+91';
  document.getElementById('fpOtp').value = '';
  document.getElementById('forgotError').style.display = 'none';
}

// Send SMS OTP
async function sendSMSOTP() {
  const phone = document.getElementById('fpPhone').value.trim();
  if (!phone || phone.length < 12) {
    document.getElementById('forgotError').textContent = 'Enter valid phone number with country code';
    document.getElementById('forgotError').style.display = 'block';
    return;
  }
  
  try {
    const response = await fetch(API_BASE + '/auth/send-sms-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, purpose: 'reset' })
    });
    const data = await response.json();
    
    if (data.success) {
      document.getElementById('otpValue').textContent = data.debug_otp;
      document.getElementById('otpDisplay').classList.add('show');
      document.getElementById('fpStep2').classList.add('active');
      document.getElementById('fpStep1').classList.remove('active');
    } else {
      document.getElementById('forgotError').textContent = data.message;
      document.getElementById('forgotError').style.display = 'block';
    }
  } catch (error) {
    document.getElementById('forgotError').textContent = '❌ Server error. Ensure Python backend is running.';
    document.getElementById('forgotError').style.display = 'block';
  }
}

// Verify SMS OTP
async function verifySMSOTP() {
  const phone = document.getElementById('fpPhone').value.trim();
  const otp = document.getElementById('fpOtp').value.trim();
  
  if (!otp || otp.length !== 6) {
    document.getElementById('forgotError').textContent = 'Enter 6-digit OTP';
    document.getElementById('forgotError').style.display = 'block';
    return;
  }
  
  try {
    const response = await fetch(API_BASE + '/auth/verify-sms-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, otp, purpose: 'reset' })
    });
    const data = await response.json();
    
    if (data.success) {
      document.getElementById('fpStep3').classList.add('active');
      document.getElementById('fpStep2').classList.remove('active');
    } else {
      document.getElementById('forgotError').textContent = data.message;
      document.getElementById('forgotError').style.display = 'block';
    }
  } catch (error) {
    document.getElementById('forgotError').textContent = '❌ Server error';
    document.getElementById('forgotError').style.display = 'block';
  }
}

// Password Strength Checker
function checkPasswordStrength() {
  const password = document.getElementById('newPassword').value;
  const strengthBar = document.getElementById('strengthBar');
  let strength = 0;
  if (password.length >= 8) strength++;
  if (/[A-Z]/.test(password)) strength++;
  if (/[0-9]/.test(password)) strength++;
  const colors = ['#ef4444', '#ef4444', '#f59e0b', '#3b82f6', '#22c55e'];
  strengthBar.style.width = (strength * 25) + '%';
  strengthBar.style.background = colors[Math.min(strength, 4)];
}

// Reset Password via Phone
async function resetPasswordPhone() {
  const phone = document.getElementById('fpPhone').value.trim();
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  
  if (newPassword !== confirmPassword) {
    document.getElementById('forgotError').textContent = 'Passwords do not match';
    document.getElementById('forgotError').style.display = 'block';
    return;
  }
  
  try {
    const response = await fetch(API_BASE + '/auth/reset-password-phone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password: newPassword })
    });
    const data = await response.json();
    
    if (data.success) {
      document.getElementById('fpStep4').classList.add('active');
      document.getElementById('fpStep3').classList.remove('active');
    } else {
      document.getElementById('forgotError').textContent = data.message;
      document.getElementById('forgotError').style.display = 'block';
    }
  } catch (error) {
    document.getElementById('forgotError').textContent = '❌ Server error';
    document.getElementById('forgotError').style.display = 'block';
  }
}

// Register Modal Functions
function openRegisterModal() { 
  document.getElementById('registerModal').classList.add('active'); 
}

function closeRegisterModal() { 
  document.getElementById('registerModal').classList.remove('active'); 
  document.getElementById('regError').style.display = 'none'; 
  document.getElementById('regSuccess').style.display = 'none'; 
}

// Register User
async function registerUser() {
  const username = document.getElementById('regUsername').value.trim().toLowerCase();
  const email = document.getElementById('regEmail').value.trim().toLowerCase();
  const phone = document.getElementById('regPhone').value.trim();
  const password = document.getElementById('regPassword').value;
  const role = document.getElementById('regRole').value;
  
  try {
    const response = await fetch(API_BASE + '/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, phone, password, role })
    });
    const data = await response.json();
    
    if (data.success) {
      document.getElementById('regSuccess').textContent = '✅ Registration successful! Please login.';
      document.getElementById('regSuccess').style.display = 'block';
      setTimeout(() => { closeRegisterModal(); document.getElementById('username').value = username; }, 2000);
    } else {
      document.getElementById('regError').textContent = data.message;
      document.getElementById('regError').style.display = 'block';
    }
  } catch (error) {
    document.getElementById('regError').textContent = '❌ Server error';
    document.getElementById('regError').style.display = 'block';
  }
}

// Check if user is already logged in
if (localStorage.getItem('username')) { 
  window.location.href = 'index.html'; 
}

