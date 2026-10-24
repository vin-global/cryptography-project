/**
 * ProfileModule.js
 * User profile page — shows account details, activity stats,
 * and allows password change.
 */

const ProfileModule = {
  init() {
    const bind = (id, event, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener(event, fn);
    };

    bind('change-password-btn', 'click', () => {
      const form = document.getElementById('change-password-form');
      if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
    });

    bind('password-change-form', 'submit', e => this.handlePasswordChange(e));

    bind('cancel-password-btn', 'click', () => {
      const form = document.getElementById('change-password-form');
      if (form) form.style.display = 'none';
      const pwForm = document.getElementById('password-change-form');
      if (pwForm) pwForm.reset();
      const errEl = document.getElementById('password-change-error');
      if (errEl) errEl.textContent = '';
      const succEl = document.getElementById('password-change-success');
      if (succEl) succEl.textContent = '';
    });
  },

  async loadProfile() {
    const user = Auth.currentUser;
    if (!user) return;

    // Fill static info safely
    const usernameEl = document.getElementById('profile-username');
    if (usernameEl) usernameEl.textContent = user.username;

    const emailEl = document.getElementById('profile-email');
    if (emailEl) emailEl.textContent = user.email || '—';

    const userIdEl = document.getElementById('profile-user-id');
    if (userIdEl) userIdEl.textContent = '#' + (user.user_id || user.id || '—');

    const sidebarNameEl = document.getElementById('sidebar-username');
    if (sidebarNameEl) sidebarNameEl.textContent = user.username;

    const createdAtEl = document.getElementById('profile-created-at');
    if (createdAtEl) createdAtEl.textContent = user.created_at ? formatDate(user.created_at) : 'Active User';

    // Generate avatar initials
    const initials = (user.username || 'U').slice(0, 2).toUpperCase();
    const avatarEl = document.getElementById('profile-avatar-initials');
    if (avatarEl) avatarEl.textContent = initials;

    // Load stats from dashboard endpoint
    try {
      const result = await API.get('/api/dashboard');
      if (result && result.success && result.data && result.data.summary) {
        const s = result.data.summary;
        const setVal = (id, val) => {
          const el = document.getElementById(id);
          if (el) el.textContent = val !== undefined ? val : 0;
        };
        setVal('profile-stat-hashes', s.totalHashOps);
        setVal('profile-stat-signs', s.totalSignOps);
        setVal('profile-stat-merkle', s.totalMerkleOps);
        setVal('profile-stat-blocks', s.totalBlocks);
      }
    } catch (e) {
      console.warn('Profile stats fetch error:', e);
    }
  },

  async handlePasswordChange(e) {
    e.preventDefault();
    const current = document.getElementById('current-password').value;
    const newPw = document.getElementById('new-password').value;
    const confirm = document.getElementById('confirm-new-password').value;
    const errorEl = document.getElementById('password-change-error');
    const successEl = document.getElementById('password-change-success');
    const btn = document.getElementById('save-password-btn');

    errorEl.textContent = '';
    successEl.textContent = '';

    if (!current || !newPw || !confirm) {
      errorEl.textContent = 'All fields are required.';
      return;
    }
    if (newPw.length < 8) {
      errorEl.textContent = 'New password must be at least 8 characters.';
      return;
    }
    if (newPw !== confirm) {
      errorEl.textContent = 'New passwords do not match.';
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
      const result = await API.post('/api/auth/change-password', {
        currentPassword: current,
        newPassword: newPw
      });
      if (result.success) {
        successEl.textContent = 'Password changed successfully!';
        document.getElementById('password-change-form').reset();
        showToast('Password updated.', 'success');
      } else {
        errorEl.textContent = result.error || 'Failed to change password.';
      }
    } catch (err) {
      errorEl.textContent = 'Connection error. Please try again.';
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-save"></i> Save Password';
    }
  }
};
