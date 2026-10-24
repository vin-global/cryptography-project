/**
 * BlockchainModule.js
 * Blockchain simulation with block creation, chain visualization,
 * integrity verification, and tamper demonstration.
 */

const BlockchainModule = {
  chain: [],
  selectedBlockId: null,

  init() {
    const bind = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', fn);
    };

    bind('create-block-btn', () => this.showNewBlockForm());
    bind('verify-chain-btn', () => this.verifyChain());
    bind('refresh-chain-btn', () => this.loadChain(true));
    bind('reset-chain-btn', () => this.resetChain());
    bind('cancel-block-btn', () => this.hideNewBlockForm());
    bind('add-block-tx-btn', () => this.addBlockTxInput());
    bind('submit-block-btn', () => this.createBlock());

    // Close modal — header X button
    bind('close-block-modal', () => this.closeBlockModal());
    // Close modal — footer Close button
    bind('close-block-modal-footer', () => this.closeBlockModal());
    // Tamper button
    bind('tamper-block-btn', () => this.tamperBlock());
    // Close modal on overlay click
    bind('block-modal-overlay', () => this.closeBlockModal());
  },

  async loadChain(notify = false) {
    const btn = document.getElementById('refresh-chain-btn');
    if (btn) { btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...'; btn.disabled = true; }

    const statusDiv = document.getElementById('chain-status');
    if (statusDiv) {
      statusDiv.style.display = 'none';
      statusDiv.innerHTML = '';
    }

    try {
      const result = await API.get('/api/blockchain/chain');
      if (result.success) {
        this.chain = result.chain;
        this.renderChain();
        if (notify) {
          showToast(`Blockchain loaded (${this.chain.length} block${this.chain.length === 1 ? '' : 's'}).`, 'info');
        }
      } else {
        showToast('Failed to load chain.', 'error');
      }
    } finally {
      if (btn) { btn.innerHTML = '<i class="fas fa-sync"></i> Refresh'; btn.disabled = false; }
    }
  },

  renderChain() {
    const container = document.getElementById('chain-visualization');
    container.innerHTML = '';

    if (this.chain.length === 0) {
      container.innerHTML = `
        <div class="empty-chart-state" style="width:100%;padding:3rem;">
          <i class="fas fa-link" style="font-size:3rem;"></i>
          <p>No blocks in the chain yet. Click <strong>Create New Block</strong> to start the simulation.</p>
        </div>
      `;
      return;
    }

    this.chain.forEach((block, i) => {
      if (i > 0) {
        const arrow = document.createElement('div');
        arrow.className = 'chain-arrow';
        arrow.innerHTML = '<i class="fas fa-arrow-right"></i>';
        container.appendChild(arrow);
      }

      const card = document.createElement('div');
      card.className = 'block-card';
      card.dataset.blockId = block.block_id;
      card.title = 'Click to view block details';

      card.innerHTML = `
        <h4><i class="fas fa-cube"></i> Block #${block.block_id}</h4>
        <div class="block-field">
          <span class="label">Hash</span>
          <span class="value" title="${block.block_hash}">${truncateHash(block.block_hash, 10)}</span>
        </div>
        <div class="block-field">
          <span class="label">Prev Hash</span>
          <span class="value" title="${block.previous_hash}">${truncateHash(block.previous_hash, 10)}</span>
        </div>
        <div class="block-field">
          <span class="label">Merkle Root</span>
          <span class="value" title="${block.merkle_root}">${truncateHash(block.merkle_root, 10)}</span>
        </div>
        <div class="block-field">
          <span class="label">Transactions</span>
          <span class="value">${block.tx_count || 0}</span>
        </div>
        <div class="block-field">
          <span class="label">Nonce</span>
          <span class="value">${block.nonce}</span>
        </div>
        <div class="block-field">
          <span class="label">Timestamp</span>
          <span class="value" style="font-family:var(--font-sans);font-size:0.72rem;">${new Date(block.timestamp).toLocaleString()}</span>
        </div>
        <div style="margin-top:0.8rem;text-align:center;">
          <span style="font-size:0.75rem;color:var(--accent-blue);cursor:pointer;">
            <i class="fas fa-search"></i> View Details
          </span>
        </div>
      `;

      card.addEventListener('click', () => this.showBlockDetail(block.block_id));
      container.appendChild(card);
    });
  },

  showNewBlockForm() {
    const form = document.getElementById('new-block-form');
    form.style.display = 'block';
    const inputs = document.getElementById('block-tx-inputs');
    inputs.innerHTML = '';
    // Start with two empty transaction inputs
    this.addBlockTxInput();
    this.addBlockTxInput();
    form.scrollIntoView({ behavior: 'smooth' });
  },

  hideNewBlockForm() {
    document.getElementById('new-block-form').style.display = 'none';
  },

  addBlockTxInput() {
    const container = document.getElementById('block-tx-inputs');
    const idx = container.children.length;
    const div = document.createElement('div');
    div.className = 'block-tx-input';
    div.innerHTML = `
      <span style="font-size:0.82rem;color:var(--text-muted);min-width:40px;">Tx ${idx + 1}</span>
      <input type="text" placeholder="e.g., Alice sends 5 BTC to Bob" class="block-tx-data">
      <button class="btn-icon" title="Remove" onclick="this.parentElement.remove()">
        <i class="fas fa-trash-alt"></i>
      </button>
    `;
    container.appendChild(div);
    // Focus the new input
    setTimeout(() => div.querySelector('input').focus(), 50);
  },

  async createBlock() {
    const inputs = document.querySelectorAll('.block-tx-data');
    const transactions = [];

    for (const input of inputs) {
      const txData = input.value.trim();
      if (txData) {
        const hash = await this.sha256(txData);
        transactions.push({ tx_data: txData, tx_hash: hash });
      }
    }

    if (transactions.length === 0) {
      showToast('Add at least one transaction with data.', 'error');
      return;
    }

    const btn = document.getElementById('submit-block-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';

    try {
      const result = await API.post('/api/blockchain/block', { transactions });

      if (result.success) {
        this.hideNewBlockForm();
        showToast(`Block #${result.block.block_id} created with ${result.block.tx_count} transactions!`, 'success');
        await this.loadChain();
      } else {
        showToast(result.error || 'Block creation failed.', 'error');
      }
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-check"></i> Create Block';
    }
  },

  async showBlockDetail(blockId) {
    const result = await API.get(`/api/blockchain/block/${blockId}`);
    if (!result.success) {
      showToast('Failed to load block details.', 'error');
      return;
    }

    this.selectedBlockId = blockId;
    const block = result.block;

    const body = document.getElementById('block-detail-body');
    const txRows = (block.transactions || []).map(tx => `
      <tr>
        <td>${tx.tx_id}</td>
        <td>${escapeHtml(tx.tx_data)}</td>
        <td class="mono" title="${tx.tx_hash}">${truncateHash(tx.tx_hash, 8)}</td>
        <td class="mono">${tx.public_key ? truncateHash(tx.public_key, 6) : '—'}</td>
      </tr>
    `).join('');

    body.innerHTML = `
      <div class="sig-field">
        <label>Block Hash</label>
        <code class="hash-output" style="display:block;padding:0.6rem;background:var(--bg-input);border-radius:4px;word-break:break-all;">
          ${block.block_hash}
        </code>
      </div>
      <div class="sig-fields-row">
        <div class="sig-field">
          <label>Previous Hash</label>
          <code class="hash-output small" style="display:block;padding:0.4rem;background:var(--bg-input);border-radius:4px;word-break:break-all;">
            ${block.previous_hash}
          </code>
        </div>
        <div class="sig-field">
          <label>Merkle Root</label>
          <code class="hash-output small" style="display:block;padding:0.4rem;background:var(--bg-input);border-radius:4px;color:var(--accent-orange);word-break:break-all;">
            ${block.merkle_root}
          </code>
        </div>
      </div>
      <div class="sig-fields-row">
        <div class="sig-field">
          <label>Nonce</label>
          <span class="metric-value">${block.nonce}</span>
        </div>
        <div class="sig-field">
          <label>Timestamp</label>
          <span style="font-size:0.85rem;color:var(--text-secondary);">${formatDate(block.timestamp)}</span>
        </div>
      </div>

      <h4 style="margin-top:1.2rem;margin-bottom:0.8rem;font-size:0.95rem;color:var(--text-heading);">
        <i class="fas fa-exchange-alt" style="color:var(--accent-blue);"></i> Transactions (${(block.transactions || []).length})
      </h4>
      ${(block.transactions || []).length > 0 ? `
        <div class="table-container">
          <table class="data-table">
            <thead><tr><th>ID</th><th>Data</th><th>Hash</th><th>Public Key</th></tr></thead>
            <tbody>${txRows}</tbody>
          </table>
        </div>
      ` : '<p style="color:var(--text-muted);font-size:0.85rem;">No transactions in this block.</p>'}
    `;

    document.getElementById('block-detail-modal').style.display = 'flex';
  },

  closeBlockModal() {
    document.getElementById('block-detail-modal').style.display = 'none';
    this.selectedBlockId = null;
  },

  async resetChain() {
    const btn = document.getElementById('reset-chain-btn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Resetting...';
    }

    try {
      const result = await API.post('/api/blockchain/reset');
      if (result.success) {
        showToast('Blockchain reset to initial genesis block.', 'success');
        await this.loadChain(false);
      } else {
        showToast(result.error || 'Failed to reset blockchain.', 'error');
      }
    } catch (e) {
      showToast('Error resetting blockchain.', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-undo"></i> Reset Chain';
      }
    }
  },

  async verifyChain() {
    const btn = document.getElementById('verify-chain-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';

    try {
      const result = await API.get('/api/blockchain/verify');
      if (!result.success) {
        showToast('Verification request failed.', 'error');
        return;
      }

      const statusDiv = document.getElementById('chain-status');
      statusDiv.style.display = 'block';

      // Reset existing badges & styles on all cards
      document.querySelectorAll('.block-card').forEach(card => {
        card.classList.remove('valid', 'invalid');
        const oldBadge = card.querySelector('.block-status-badge');
        if (oldBadge) oldBadge.remove();
      });

      // Apply verification state to every block card in the DOM
      result.results.forEach(r => {
        const card = document.querySelector(`.block-card[data-block-id="${r.block_id}"]`);
        if (card) {
          const isBlockValid = Boolean(r.hashValid && r.linkValid);
          card.classList.add(isBlockValid ? 'valid' : 'invalid');

          const h4 = card.querySelector('h4');
          if (h4) {
            const badge = document.createElement('span');
            badge.className = `block-status-badge ${isBlockValid ? 'valid' : 'invalid'}`;
            badge.innerHTML = isBlockValid
              ? '<i class="fas fa-check-circle"></i> Verified'
              : `<i class="fas fa-times-circle"></i> ${!r.hashValid ? 'Hash Error' : 'Link Broken'}`;
            h4.appendChild(badge);
          }
        }
      });

      const totalBlocks = result.results.length;
      const validBlocksCount = result.results.filter(r => r.hashValid && r.linkValid).length;
      const invalidBlocks = result.results.filter(r => !r.hashValid || !r.linkValid);

      // Render comprehensive verification table for ALL blocks
      const blockRows = result.results.map(r => {
        const isBlockValid = r.hashValid && r.linkValid;
        return `
          <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
            <td style="padding:0.5rem 0.8rem;font-weight:600;">Block #${r.block_id}</td>
            <td style="padding:0.5rem 0.8rem;">
              ${r.hashValid
                ? '<span style="color:var(--accent-green);"><i class="fas fa-check-circle"></i> Hash Valid</span>'
                : '<span style="color:var(--accent-red);font-weight:600;"><i class="fas fa-times-circle"></i> Hash Mismatch</span>'}
            </td>
            <td style="padding:0.5rem 0.8rem;">
              ${r.linkValid
                ? '<span style="color:var(--accent-green);"><i class="fas fa-link"></i> Linked</span>'
                : '<span style="color:var(--accent-red);font-weight:600;"><i class="fas fa-unlink"></i> Broken Link</span>'}
            </td>
            <td style="padding:0.5rem 0.8rem;">
              ${isBlockValid
                ? '<span class="badge badge-green"><i class="fas fa-shield-alt"></i> Passed</span>'
                : '<span class="badge badge-red"><i class="fas fa-exclamation-triangle"></i> Failed</span>'}
            </td>
          </tr>
        `;
      }).join('');

      if (result.valid) {
        statusDiv.innerHTML = `
          <div class="verify-success" style="margin:1rem;">
            <h4><i class="fas fa-check-circle"></i> Chain Integrity Valid (${validBlocksCount}/${totalBlocks} Blocks Verified)</h4>
            <p>Every block has been cryptographically validated: SHA-256 block hashes match stored data and previous block hashes form an unbroken chain.</p>
            <div class="table-container" style="margin-top:0.8rem;background:rgba(0,0,0,0.2);border-radius:6px;overflow-x:auto;">
              <table class="data-table" style="width:100%;font-size:0.8rem;text-align:left;">
                <thead>
                  <tr style="border-bottom:1px solid rgba(255,255,255,0.1);">
                    <th style="padding:0.5rem 0.8rem;">Block</th>
                    <th style="padding:0.5rem 0.8rem;">Hash Integrity</th>
                    <th style="padding:0.5rem 0.8rem;">Parent Link</th>
                    <th style="padding:0.5rem 0.8rem;">Result</th>
                  </tr>
                </thead>
                <tbody>${blockRows}</tbody>
              </table>
            </div>
          </div>
        `;
      } else {
        statusDiv.innerHTML = `
          <div class="verify-failure" style="margin:1rem;">
            <h4><i class="fas fa-times-circle"></i> Chain Integrity BROKEN (${invalidBlocks.length} of ${totalBlocks} Blocks Failed)</h4>
            <p>Tampering or corruption detected! The blockchain verification evaluated all ${totalBlocks} block(s):</p>
            <div class="table-container" style="margin-top:0.8rem;background:rgba(0,0,0,0.2);border-radius:6px;overflow-x:auto;">
              <table class="data-table" style="width:100%;font-size:0.8rem;text-align:left;">
                <thead>
                  <tr style="border-bottom:1px solid rgba(255,255,255,0.1);">
                    <th style="padding:0.5rem 0.8rem;">Block</th>
                    <th style="padding:0.5rem 0.8rem;">Hash Integrity</th>
                    <th style="padding:0.5rem 0.8rem;">Parent Link</th>
                    <th style="padding:0.5rem 0.8rem;">Result</th>
                  </tr>
                </thead>
                <tbody>${blockRows}</tbody>
              </table>
            </div>
            <div style="margin-top:0.8rem;">
              <button class="btn btn-sm btn-outline" onclick="BlockchainModule.resetChain()">
                <i class="fas fa-undo"></i> Restore Clean Blockchain
              </button>
            </div>
          </div>
        `;
      }

      showToast(
        result.valid
          ? `All ${totalBlocks} block(s) verified valid!`
          : `Chain integrity broken: ${invalidBlocks.length} of ${totalBlocks} block(s) failed verification!`,
        result.valid ? 'success' : 'error'
      );
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-check-double"></i> Verify Chain Integrity';
    }
  },

  async tamperBlock() {
    if (!this.selectedBlockId) {
      showToast('No block selected.', 'error');
      return;
    }

    const btn = document.getElementById('tamper-block-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Tampering...';

    try {
      // Generate a fake merkle root to demonstrate tampering
      const fakeRoot = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0')).join('');

      const result = await API.post('/api/blockchain/tamper', {
        blockId: this.selectedBlockId,
        newMerkleRoot: fakeRoot
      });

      if (result.success) {
        this.closeBlockModal();
        showToast(`Block #${this.selectedBlockId} tampered! Click "Verify Chain Integrity" to see the broken chain.`, 'info');
        await this.loadChain();
      } else {
        showToast(result.error || 'Tamper failed.', 'error');
      }
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-bug"></i> Tamper with Block';
    }
  },

  async sha256(message) {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
};
