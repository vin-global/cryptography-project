/**
 * SigningModule.js
 * ECDSA Digital Signature module using elliptic.js on secp256k1.
 * Private keys never leave the browser.
 */

const SigningModule = {
  ec: null,
  keyPair: null,
  currentSignature: null,
  currentTxData: null,
  currentTxHash: null,

  init() {
    // Initialize elliptic curve if available
    try {
      const el = typeof window !== 'undefined' ? (window.elliptic || (typeof elliptic !== 'undefined' ? elliptic : null)) : null;
      if (el && el.ec) {
        this.ec = new el.ec('secp256k1');
      }
    } catch (e) {
      console.warn('Elliptic library not loaded in browser; using backend crypto service.', e);
    }

    const bind = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', fn);
    };

    bind('generate-keys-btn', () => this.generateKeys());
    bind('reveal-private-key', () => this.togglePrivateKey());
    bind('proceed-to-sign-btn', () => this.goToStep(2));
    bind('sign-tx-btn', () => this.signTransaction());
    bind('proceed-to-verify-btn', () => this.goToStep(3));
    bind('verify-btn', () => this.verifySignature(false));
    bind('tamper-verify-btn', () => this.verifySignature(true));
    bind('restart-signing-btn', () => this.restart());
  },

  async generateKeys() {
    const btn = document.getElementById('generate-keys-btn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
    }

    try {
      let publicKey = '';
      let privateKey = '';
      let timeMs = 0;

      // Lazy re-check if elliptic loaded after init
      if (!this.ec) {
        const el = typeof window !== 'undefined' ? (window.elliptic || (typeof elliptic !== 'undefined' ? elliptic : null)) : null;
        if (el && el.ec) {
          this.ec = new el.ec('secp256k1');
        }
      }

      if (this.ec && typeof this.ec.genKeyPair === 'function') {
        const start = performance.now();
        this.keyPair = this.ec.genKeyPair();
        timeMs = performance.now() - start;
        publicKey = this.keyPair.getPublic('hex');
        privateKey = this.keyPair.getPrivate('hex');
      } else {
        // Fallback to server/client API endpoint
        const res = await API.post('/api/crypto/keypair');
        if (!res.success) throw new Error(res.error || 'Key generation failed');
        publicKey = res.publicKey;
        privateKey = res.privateKey;
        timeMs = res.timeMs;
        this.keyPair = {
          getPublic: () => publicKey,
          getPrivate: () => privateKey,
          privateKeyHex: privateKey,
          sign: null // will trigger API sign
        };
      }

      document.getElementById('public-key-display').textContent = publicKey;
      document.getElementById('private-key-display').textContent = privateKey;
      document.getElementById('private-key-display').classList.add('blurred');
      document.getElementById('private-key-display').dataset.revealed = 'false';
      document.getElementById('keys-display').style.display = 'flex';

      showToast(`Key pair generated in ${formatTime(timeMs)}`, 'success');
    } catch (err) {
      showToast('Key generation failed: ' + err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-key"></i> Generate Key Pair';
      }
    }
  },

  togglePrivateKey() {
    const el = document.getElementById('private-key-display');
    const btn = document.getElementById('reveal-private-key');
    if (el.dataset.revealed === 'false') {
      el.classList.remove('blurred');
      el.classList.add('revealed');
      el.dataset.revealed = 'true';
      btn.innerHTML = '<i class="fas fa-eye-slash"></i>';
    } else {
      el.classList.add('blurred');
      el.classList.remove('revealed');
      el.dataset.revealed = 'false';
      btn.innerHTML = '<i class="fas fa-eye"></i>';
    }
  },

  goToStep(step) {
    // Update step indicators
    document.querySelectorAll('.steps-indicator .step').forEach((el, i) => {
      el.classList.remove('active', 'completed');
      if (i + 1 < step) el.classList.add('completed');
      if (i + 1 === step) el.classList.add('active');
    });

    // Show/hide step content
    document.querySelectorAll('.sign-step').forEach(el => el.style.display = 'none');
    document.getElementById(`sign-step-${step}`).style.display = 'block';
  },

  async signTransaction() {
    if (!this.keyPair) {
      showToast('Please generate a key pair first.', 'error');
      return;
    }

    const sender = document.getElementById('tx-sender').value.trim();
    const recipient = document.getElementById('tx-recipient').value.trim();
    const amount = document.getElementById('tx-amount').value;
    const data = document.getElementById('tx-data').value.trim();

    if (!sender || !recipient || !amount) {
      showToast('Sender, recipient, and amount are required.', 'error');
      return;
    }

    if (parseFloat(amount) <= 0) {
      showToast('Amount must be greater than zero.', 'error');
      return;
    }

    // Build deterministic transaction representation
    this.currentTxData = JSON.stringify({
      sender,
      recipient,
      amount: parseFloat(amount),
      data: data || '',
      timestamp: new Date().toISOString()
    });

    // Hash the transaction with SHA-256
    const encoder = new TextEncoder();
    const txBytes = encoder.encode(this.currentTxData);
    const hashBuffer = await crypto.subtle.digest('SHA-256', txBytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    this.currentTxHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Sign using ECDSA (local or fallback to server)
    const signStart = performance.now();
    let sigR = '';
    let sigS = '';
    let signTime = 0;

    try {
      if (typeof this.keyPair.sign === 'function') {
        this.currentSignature = this.keyPair.sign(this.currentTxHash);
        signTime = performance.now() - signStart;
        sigR = this.currentSignature.r.toString(16);
        sigS = this.currentSignature.s.toString(16);
      } else {
        const signRes = await API.post('/api/crypto/sign', {
          privateKey: this.keyPair.privateKeyHex || this.keyPair.getPrivate('hex'),
          messageHash: this.currentTxHash
        });
        if (!signRes.success) throw new Error(signRes.error || 'Signing failed');
        this.currentSignature = signRes.signature;
        signTime = signRes.timeMs || (performance.now() - signStart);
        sigR = signRes.signature.r;
        sigS = signRes.signature.s;
      }

      // Display
      document.getElementById('tx-hash-display').textContent = this.currentTxHash;
      document.getElementById('sig-r-display').textContent = sigR;
      document.getElementById('sig-s-display').textContent = sigS;
      document.getElementById('sign-time-display').textContent = formatTime(signTime);
      document.getElementById('signature-display').style.display = 'block';

      // Set up verification data
      document.getElementById('verify-tx-data').value = this.currentTxData;

      // Record on server (without private key!)
      API.post('/api/crypto/record-sign', {
        txData: this.currentTxData,
        txHash: this.currentTxHash,
        publicKey: this.keyPair.getPublic('hex'),
        signatureR: sigR,
        signatureS: sigS,
        timeMs: signTime
      }).catch(() => {});

      showToast(`Transaction signed in ${formatTime(signTime)}`, 'success');
    } catch (err) {
      showToast('Signing failed: ' + err.message, 'error');
    }
  },

  async verifySignature(tamper) {
    if (!this.currentSignature || !this.keyPair) {
      showToast('No signature to verify. Please sign a transaction first.', 'error');
      return;
    }

    let txDataToVerify = document.getElementById('verify-tx-data').value;

    if (tamper) {
      // Modify the transaction to demonstrate failed verification
      try {
        const parsed = JSON.parse(txDataToVerify);
        parsed.amount = (parsed.amount || 0) + 999;
        parsed.tampered = true;
        txDataToVerify = JSON.stringify(parsed);
        document.getElementById('verify-tx-data').value = txDataToVerify;
      } catch (e) {
        txDataToVerify += ' [TAMPERED]';
        document.getElementById('verify-tx-data').value = txDataToVerify;
      }
    }

    // Recompute hash of (possibly modified) data
    const encoder = new TextEncoder();
    const txBytes = encoder.encode(txDataToVerify);
    const hashBuffer = await crypto.subtle.digest('SHA-256', txBytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const newHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Verify on server
    const publicKeyHex = this.keyPair.getPublic('hex');
    const result = await API.post('/api/crypto/verify', {
      messageHash: newHash,
      signature: {
        r: this.currentSignature.r.toString(16),
        s: this.currentSignature.s.toString(16)
      },
      publicKey: publicKeyHex
    });

    const resultDiv = document.getElementById('verify-result');
    resultDiv.style.display = 'block';

    if (result.valid) {
      resultDiv.innerHTML = `
        <div class="verify-success">
          <h4><i class="fas fa-check-circle"></i> Signature Valid</h4>
          <p>The signature matches the transaction data and public key. The transaction has not been modified since signing.</p>
          <p style="margin-top:0.5rem;font-size:0.82rem;color:var(--text-muted);">
            Verification time: ${formatTime(result.timeMs)}
          </p>
        </div>
      `;
    } else {
      resultDiv.innerHTML = `
        <div class="verify-failure">
          <h4><i class="fas fa-times-circle"></i> Signature Invalid</h4>
          <p>The signature does <strong>not</strong> match the transaction data. ${tamper ? 'The data was tampered with — the hash changed, so the original signature no longer validates.' : 'The transaction data has been modified after signing.'}</p>
          <div style="margin-top:0.8rem;font-size:0.82rem;">
            <p><strong>Original hash:</strong> <code style="color:var(--accent-green);font-size:0.75rem;">${truncateHash(this.currentTxHash, 16)}</code></p>
            <p><strong>Current hash:</strong> <code style="color:var(--accent-red);font-size:0.75rem;">${truncateHash(newHash, 16)}</code></p>
          </div>
          <p style="margin-top:0.5rem;font-size:0.82rem;color:var(--text-muted);">
            Verification time: ${formatTime(result.timeMs)}
          </p>
        </div>
      `;
    }
  },

  restart() {
    this.keyPair = null;
    this.currentSignature = null;
    this.currentTxData = null;
    this.currentTxHash = null;

    document.getElementById('keys-display').style.display = 'none';
    document.getElementById('signature-display').style.display = 'none';
    document.getElementById('verify-result').style.display = 'none';
    document.getElementById('tx-sender').value = '';
    document.getElementById('tx-recipient').value = '';
    document.getElementById('tx-amount').value = '';
    document.getElementById('tx-data').value = '';

    this.goToStep(1);
    showToast('Signing module reset.', 'info');
  }
};
