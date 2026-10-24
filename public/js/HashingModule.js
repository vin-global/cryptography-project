/**
 * HashingModule.js
 * Interactive SHA-256 and Keccak-256 hashing with real-time comparison.
 * Uses Web Crypto API for SHA-256 and js-sha3 (CDN) for Keccak-256.
 */

const HashingModule = {
  debounceTimer: null,

  init() {
    const input = document.getElementById('hash-input');
    const sampleBtn = document.getElementById('hash-sample-btn');
    const clearBtn = document.getElementById('hash-clear-btn');

    input.addEventListener('input', () => this.onInputChange());
    sampleBtn.addEventListener('click', () => this.loadSample());
    clearBtn.addEventListener('click', () => this.clearInput());
  },

  onInputChange() {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.computeHashes(), 150);
    this.updateInputMeta();
  },

  updateInputMeta() {
    const input = document.getElementById('hash-input').value;
    document.getElementById('hash-input-length').textContent = `${input.length} characters`;
    document.getElementById('hash-input-bytes').textContent = `${getByteLength(input)} bytes`;
  },

  async computeHashes() {
    const input = document.getElementById('hash-input').value;

    if (input.length === 0) {
      this.resetOutputs();
      return;
    }

    try {
      // Client-side SHA-256 using Web Crypto API
      const sha256Start = performance.now();
      const sha256Hash = await this.sha256(input);
      const sha256Time = performance.now() - sha256Start;

      // Client-side Keccak-256 using js-sha3 or server fallback
      const keccakStart = performance.now();
      let keccakHash = this.keccak256(input);
      let keccakTime = performance.now() - keccakStart;

      if (!keccakHash || keccakHash === 'Keccak-256 library not available') {
        const hashRes = await API.post('/api/crypto/hash', { input });
        if (hashRes && hashRes.success && hashRes.keccak256) {
          keccakHash = hashRes.keccak256.hash;
          keccakTime = hashRes.keccak256.timeMs || (performance.now() - keccakStart);
        }
      }

      // Update display
      document.getElementById('sha256-output').textContent = sha256Hash;
      document.getElementById('sha256-length').textContent = `256 bits (${sha256Hash.length} hex chars)`;
      document.getElementById('sha256-time').textContent = formatTime(sha256Time);

      document.getElementById('keccak256-output').textContent = keccakHash;
      document.getElementById('keccak256-length').textContent = `256 bits (${keccakHash.length} hex chars)`;
      document.getElementById('keccak256-time').textContent = formatTime(keccakTime);

      // Record on server (async, no blocking)
      API.post('/api/crypto/hash', { input }).catch(() => {});

    } catch (err) {
      showToast('Hashing error: ' + err.message, 'error');
    }
  },

  async sha256(message) {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },

  keccak256(message) {
    // js-sha3's keccak_256 function — this is Ethereum's Keccak-256, NOT NIST SHA3-256
    if (typeof keccak_256 !== 'undefined') {
      return keccak_256(message);
    }
    // Fallback: try sha3_256 from the js-sha3 library which also exports keccak
    if (typeof sha3_256 !== 'undefined') {
      // Note: The js-sha3 library exports both sha3_256 (NIST) and keccak_256 (pre-NIST)
      // We need keccak_256 for Ethereum compatibility
      return keccak_256(message);
    }
    return 'Keccak-256 library not available';
  },

  loadSample() {
    const samples = [
      'Hello, Blockchain!',
      'The quick brown fox jumps over the lazy dog',
      'Bitcoin: A Peer-to-Peer Electronic Cash System',
      'Ethereum uses Keccak-256, not SHA3-256',
      '{"sender":"Alice","recipient":"Bob","amount":10.5}'
    ];
    const sample = samples[Math.floor(Math.random() * samples.length)];
    document.getElementById('hash-input').value = sample;
    this.onInputChange();
  },

  clearInput() {
    document.getElementById('hash-input').value = '';
    this.resetOutputs();
    this.updateInputMeta();
  },

  resetOutputs() {
    document.getElementById('sha256-output').textContent = 'Enter text above to compute hash...';
    document.getElementById('keccak256-output').textContent = 'Enter text above to compute hash...';
    document.getElementById('sha256-length').textContent = '—';
    document.getElementById('sha256-time').textContent = '—';
    document.getElementById('keccak256-length').textContent = '—';
    document.getElementById('keccak256-time').textContent = '—';
  }
};
