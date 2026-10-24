/**
 * Utility Functions
 * Shared helpers for API calls, DOM manipulation, and notifications.
 */

const API = {
  async post(url, data = {}) {
    if (typeof ClientBackend !== 'undefined' && ClientBackend.isStandalone) {
      return await ClientBackend.handle('POST', url, data);
    }
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(data)
      });
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok && (res.status === 404 || !contentType.includes('application/json'))) {
        if (typeof ClientBackend !== 'undefined') {
          ClientBackend.activate();
          return await ClientBackend.handle('POST', url, data);
        }
      }
      return await res.json();
    } catch (err) {
      if (typeof ClientBackend !== 'undefined') {
        ClientBackend.activate();
        return await ClientBackend.handle('POST', url, data);
      }
      throw err;
    }
  },

  async get(url) {
    if (typeof ClientBackend !== 'undefined' && ClientBackend.isStandalone) {
      return await ClientBackend.handle('GET', url);
    }
    try {
      const res = await fetch(url, {
        credentials: 'same-origin'
      });
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok && (res.status === 404 || !contentType.includes('application/json'))) {
        if (typeof ClientBackend !== 'undefined') {
          ClientBackend.activate();
          return await ClientBackend.handle('GET', url);
        }
      }
      return await res.json();
    } catch (err) {
      if (typeof ClientBackend !== 'undefined') {
        ClientBackend.activate();
        return await ClientBackend.handle('GET', url);
      }
      throw err;
    }
  }
};

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
  toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${message}</span>`;

  container.appendChild(toast);
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, 4000);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function truncateHash(hash, len = 8) {
  if (!hash || hash.length <= len * 2) return hash || '—';
  return hash.slice(0, len) + '...' + hash.slice(-len);
}

function formatTime(ms) {
  if (ms === null || ms === undefined) return '—';
  return parseFloat(ms).toFixed(3) + ' ms';
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleString();
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('Copied to clipboard!', 'success');
  }).catch(() => {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('Copied to clipboard!', 'success');
  });
}

// Set up copy buttons
document.addEventListener('click', e => {
  const btn = e.target.closest('.copy-btn');
  if (btn) {
    const targetId = btn.getAttribute('data-target');
    const target = document.getElementById(targetId);
    if (target) {
      copyToClipboard(target.textContent);
    }
  }
});

function getByteLength(str) {
  return new Blob([str]).size;
}
