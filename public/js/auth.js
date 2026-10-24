/**
 * Authentication Module
 * Handles login, registration, form switching, and session checks.
 */

const Auth = {
  currentUser: null,

  init() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const showRegister = document.getElementById('show-register');
    const showLogin = document.getElementById('show-login');
    const logoutBtn = document.getElementById('logout-btn');

    loginForm.addEventListener('submit', e => this.handleLogin(e));
    registerForm.addEventListener('submit', e => this.handleRegister(e));
    showRegister.addEventListener('click', e => { e.preventDefault(); this.toggleForms('register'); });
    showLogin.addEventListener('click', e => { e.preventDefault(); this.toggleForms('login'); });
    logoutBtn.addEventListener('click', () => this.handleLogout());
  },

  toggleForms(show) {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    loginForm.style.display = show === 'login' ? 'block' : 'none';
    registerForm.style.display = show === 'register' ? 'block' : 'none';
    document.getElementById('login-error').textContent = '';
    document.getElementById('register-error').textContent = '';
  },

  async handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    const submitBtn = document.getElementById('login-submit');

    errorEl.textContent = '';

    if (!username || !password) {
      errorEl.textContent = 'Please enter both username and password.';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';

    try {
      const result = await API.post('/api/auth/login', { username, password });
      if (result.success) {
        this.currentUser = result.user;
        showToast(`Welcome back, ${result.user.username}!`, 'success');
        App.showApp();
      } else {
        errorEl.textContent = result.error || 'Login failed.';
      }
    } catch (err) {
      errorEl.textContent = 'Connection error. Please try again.';
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
    }
  },

  async handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-confirm').value;
    const errorEl = document.getElementById('register-error');
    const submitBtn = document.getElementById('register-submit');

    errorEl.textContent = '';

    if (!username || !email || !password || !confirm) {
      errorEl.textContent = 'All fields are required.';
      return;
    }

    if (password !== confirm) {
      errorEl.textContent = 'Passwords do not match.';
      return;
    }

    if (password.length < 8) {
      errorEl.textContent = 'Password must be at least 8 characters.';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating account...';

    try {
      const result = await API.post('/api/auth/register', { username, email, password });
      if (result.success) {
        this.currentUser = result.user;
        showToast(`Account created! Welcome, ${result.user.username}!`, 'success');
        App.showApp();
      } else {
        errorEl.textContent = result.error || 'Registration failed.';
      }
    } catch (err) {
      errorEl.textContent = 'Connection error. Please try again.';
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-user-plus"></i> Create Account';
    }
  },

  async handleLogout() {
    try {
      await API.post('/api/auth/logout');
      this.currentUser = null;
      showToast('Logged out successfully.', 'info');
      App.showAuth();
    } catch (err) {
      showToast('Logout failed.', 'error');
    }
  },

  async checkSession() {
    try {
      const result = await API.get('/api/auth/me');
      if (result.success) {
        this.currentUser = result.user;
        return true;
      }
    } catch (err) {
      // Not authenticated
    }
    return false;
  }
};
