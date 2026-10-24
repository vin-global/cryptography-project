/**
 * MerkleModule.js
 * Interactive Merkle tree construction with D3.js animated visualization
 * and Merkle proof generation/verification.
 */

const MerkleModule = {
  transactions: [],
  treeData: null,
  txHashes: [],

  init() {
    const bind = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', fn);
    };

    bind('merkle-sample-btn', () => this.loadSamples());
    bind('merkle-add-btn', () => this.addTransaction());
    bind('merkle-reset-btn', () => this.reset());
    bind('merkle-build-btn', () => this.buildTree());
  },

  addTransaction(value = '') {
    const idx = this.transactions.length;
    this.transactions.push(value);
    this.renderTxList();

    // Focus the new input
    setTimeout(() => {
      const inputs = document.querySelectorAll('.merkle-tx-item input');
      if (inputs[idx]) inputs[idx].focus();
    }, 50);
  },

  removeTransaction(idx) {
    this.transactions.splice(idx, 1);
    this.renderTxList();
  },

  renderTxList() {
    const list = document.getElementById('merkle-tx-list');
    list.innerHTML = '';

    this.transactions.forEach((tx, i) => {
      const item = document.createElement('div');
      item.className = 'merkle-tx-item';
      item.innerHTML = `
        <span class="tx-index">Tx ${i + 1}</span>
        <input type="text" value="${escapeHtml(tx)}" placeholder="Enter transaction data..."
               data-index="${i}">
        <button class="btn-icon" title="Remove" data-remove="${i}">
          <i class="fas fa-trash-alt"></i>
        </button>
      `;
      list.appendChild(item);
    });

    // Event listeners
    list.querySelectorAll('input').forEach(input => {
      input.addEventListener('input', e => {
        const idx = parseInt(e.target.dataset.index);
        this.transactions[idx] = e.target.value;
      });
    });

    list.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', e => {
        const idx = parseInt(e.target.closest('[data-remove]').dataset.remove);
        this.removeTransaction(idx);
      });
    });
  },

  loadSamples() {
    this.transactions = [
      'Alice sends 5 BTC to Bob',
      'Bob sends 2 BTC to Charlie',
      'Charlie sends 1.5 BTC to Diana',
      'Diana sends 3 BTC to Eve',
      'Eve sends 0.5 BTC to Frank'
    ];
    this.renderTxList();
    showToast('Sample transactions loaded.', 'info');
  },

  reset() {
    this.transactions = [];
    this.treeData = null;
    this.txHashes = [];
    this.renderTxList();
    document.getElementById('merkle-root-card').style.display = 'none';
    document.getElementById('merkle-tree-container').style.display = 'none';
    document.getElementById('merkle-proof-card').style.display = 'none';
    document.getElementById('merkle-tree-svg').innerHTML = '';
    showToast('Merkle tree reset.', 'info');
  },

  async buildTree() {
    // Filter out empty transactions
    const txData = this.transactions.filter(t => t.trim().length > 0);

    if (txData.length < 2) {
      showToast('At least 2 transactions are required to build a Merkle tree.', 'error');
      return;
    }

    // Hash each transaction to create leaf nodes
    this.txHashes = [];
    for (const tx of txData) {
      const hash = await this.sha256(tx);
      this.txHashes.push(hash);
    }

    // Build on server
    const result = await API.post('/api/crypto/merkle/build', { txHashes: this.txHashes });

    if (!result.success) {
      showToast(result.error || 'Failed to build Merkle tree.', 'error');
      return;
    }

    this.treeData = result;

    // Display root
    document.getElementById('merkle-root-card').style.display = 'block';
    document.getElementById('merkle-root-display').textContent = result.root;
    document.getElementById('merkle-levels').textContent = result.levels;
    document.getElementById('merkle-leaves').textContent = this.txHashes.length;
    document.getElementById('merkle-build-time').textContent = formatTime(result.timeMs);

    // Render tree visualization
    document.getElementById('merkle-tree-container').style.display = 'block';
    this.renderTree(result.tree, txData);

    showToast(`Merkle tree built: ${result.levels} levels, root: ${truncateHash(result.root)}`, 'success');
  },

  renderTree(treeLevels, txData) {
    const container = document.getElementById('merkle-tree-svg');
    container.innerHTML = '';

    if (typeof d3 === 'undefined') {
      this.renderFallbackTree(treeLevels, txData);
      return;
    }

    // Build hierarchical data for D3
    const root = this.buildHierarchy(treeLevels);
    if (!root) return;

    const margin = { top: 40, right: 30, bottom: 40, left: 30 };
    const containerWidth = container.clientWidth || 800;
    const width = Math.max(containerWidth - margin.left - margin.right, 600);
    const height = Math.max(treeLevels.length * 100, 300);

    const svg = d3.select(container)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const hierarchy = d3.hierarchy(root);
    const treeLayout = d3.tree().size([width, height - 80]);
    treeLayout(hierarchy);

    // Draw links with animation
    const links = svg.selectAll('.tree-link')
      .data(hierarchy.links())
      .join('path')
      .attr('class', 'tree-link')
      .attr('d', d3.linkVertical()
        .x(d => d.x)
        .y(d => d.y))
      .style('opacity', 0)
      .transition()
      .duration(800)
      .delay((d, i) => i * 100)
      .style('opacity', 1);

    // Draw nodes with animation
    const nodes = svg.selectAll('.tree-node')
      .data(hierarchy.descendants())
      .join('g')
      .attr('class', 'tree-node')
      .attr('transform', d => `translate(${d.x},${d.y})`)
      .style('opacity', 0);

    // Animate nodes
    nodes.transition()
      .duration(600)
      .delay((d, i) => (hierarchy.descendants().length - 1 - i) * 80)
      .style('opacity', 1);

    // Color scheme based on level
    const colorScale = d3.scaleOrdinal()
      .domain([0, 1, 2, 3, 4])
      .range(['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444']);

    nodes.append('circle')
      .attr('r', d => d.data.isRoot ? 16 : (d.data.isLeaf ? 12 : 10))
      .attr('fill', d => d.data.isRoot ? '#f59e0b' : colorScale(d.depth))
      .attr('stroke', d => d.data.isRoot ? '#fbbf24' : '#fff')
      .attr('stroke-width', d => d.data.isRoot ? 3 : 1.5)
      .attr('stroke-opacity', 0.3);

    // Hash labels
    nodes.append('text')
      .attr('dy', d => d.data.isLeaf ? 28 : -20)
      .attr('text-anchor', 'middle')
      .text(d => d.data.hash ? d.data.hash.slice(0, 8) + '...' : '')
      .style('font-size', '10px')
      .style('fill', '#9ca3b4');

    // Leaf labels (transaction data)
    nodes.filter(d => d.data.isLeaf && d.data.leafIndex !== undefined)
      .append('text')
      .attr('dy', 44)
      .attr('text-anchor', 'middle')
      .text(d => {
        const label = txData[d.data.leafIndex] || `Tx ${d.data.leafIndex + 1}`;
        return label.length > 18 ? label.slice(0, 18) + '...' : label;
      })
      .style('font-size', '9px')
      .style('fill', '#6b7280')
      .style('font-family', 'var(--font-sans)');

    // Root label
    nodes.filter(d => d.data.isRoot)
      .append('text')
      .attr('dy', -26)
      .attr('text-anchor', 'middle')
      .text('Merkle Root')
      .style('font-size', '11px')
      .style('fill', '#f59e0b')
      .style('font-weight', '600');

    // Click handler for leaf nodes (Merkle proof)
    nodes.filter(d => d.data.isLeaf)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        if (d.data.leafIndex !== undefined) {
          this.generateProof(d.data.leafIndex, txData[d.data.leafIndex]);
        }
      });

    // Duplicate indicator
    nodes.filter(d => d.data.isDuplicate)
      .append('text')
      .attr('dy', -18)
      .attr('text-anchor', 'middle')
      .text('(dup)')
      .style('font-size', '8px')
      .style('fill', '#ef4444');
  },

  buildHierarchy(treeLevels) {
    if (!treeLevels || treeLevels.length === 0) return null;

    // Top level (root) is the last array
    const rootLevel = treeLevels[treeLevels.length - 1];
    if (rootLevel.length === 0) return null;

    const rootNode = {
      hash: rootLevel[0].hash,
      isRoot: true,
      isLeaf: treeLevels.length === 1,
      isDuplicate: false
    };

    if (treeLevels.length === 1) {
      rootNode.leafIndex = 0;
      return rootNode;
    }

    // Build tree recursively from top to bottom
    const buildChildren = (level, index) => {
      if (level < 0) return null;

      const currentLevel = treeLevels[level];
      const leftIdx = index * 2;
      const rightIdx = index * 2 + 1;

      const children = [];

      if (leftIdx < currentLevel.length) {
        const leftNode = {
          hash: currentLevel[leftIdx].hash,
          isLeaf: level === 0,
          isDuplicate: currentLevel[leftIdx].isDuplicate || false,
          isRoot: false
        };
        if (level === 0) leftNode.leafIndex = leftIdx;
        if (level > 0) {
          const grandChildren = buildChildren(level - 1, leftIdx);
          if (grandChildren) leftNode.children = grandChildren;
        }
        children.push(leftNode);
      }

      if (rightIdx < currentLevel.length) {
        const rightNode = {
          hash: currentLevel[rightIdx].hash,
          isLeaf: level === 0,
          isDuplicate: currentLevel[rightIdx].isDuplicate || false,
          isRoot: false
        };
        if (level === 0) rightNode.leafIndex = rightIdx;
        if (level > 0) {
          const grandChildren = buildChildren(level - 1, rightIdx);
          if (grandChildren) rightNode.children = grandChildren;
        }
        children.push(rightNode);
      }

      return children.length > 0 ? children : null;
    };

    const children = buildChildren(treeLevels.length - 2, 0);
    if (children) rootNode.children = children;

    return rootNode;
  },

  async generateProof(leafIndex, txLabel) {
    if (!this.txHashes || this.txHashes.length === 0) {
      showToast('No tree data. Build the tree first.', 'error');
      return;
    }

    const result = await API.post('/api/crypto/merkle/proof', {
      txHashes: this.txHashes,
      leafIndex
    });

    if (!result.success || !result.valid) {
      showToast('Failed to generate proof.', 'error');
      return;
    }

    // Display proof
    const proofCard = document.getElementById('merkle-proof-card');
    proofCard.style.display = 'block';

    const proofContent = document.getElementById('merkle-proof-content');
    const proofSteps = result.proof.map((step, i) => `
      <div class="merkle-tx-item" style="margin-bottom:0.3rem;">
        <span class="tx-index">Step ${i + 1}</span>
        <code style="flex:1;font-size:0.78rem;color:var(--accent-cyan);word-break:break-all;">
          ${step.hash}
        </code>
        <span class="badge ${step.position === 'left' ? 'badge-blue' : 'badge-purple'}">
          ${step.position}
        </span>
      </div>
    `).join('');

    proofContent.innerHTML = `
      <div style="margin-bottom:1rem;">
        <p style="font-size:0.88rem;color:var(--text-secondary);margin-bottom:0.8rem;">
          <strong>Proving:</strong> "${escapeHtml(txLabel || `Transaction ${leafIndex + 1}`)}" (leaf index: ${leafIndex})
        </p>
        <div class="sig-field">
          <label>Leaf Hash</label>
          <code class="hash-output" style="display:block;padding:0.5rem;background:var(--bg-input);border-radius:4px;font-size:0.78rem;">
            ${result.leafHash}
          </code>
        </div>
      </div>

      <h4 style="font-size:0.92rem;margin-bottom:0.8rem;color:var(--text-heading);">
        <i class="fas fa-route" style="color:var(--accent-orange);"></i> Proof Path (${result.proof.length} steps)
      </h4>
      ${proofSteps}

      <div style="margin-top:1rem;padding:1rem;background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.15);border-radius:8px;">
        <p style="font-size:0.85rem;color:var(--accent-green);">
          <i class="fas fa-check-circle"></i> <strong>Proof Valid</strong> — Following this path from the leaf hash
          through ${result.proof.length} sibling hashes reconstructs the Merkle root.
        </p>
        <p style="font-size:0.82rem;color:var(--text-muted);margin-top:0.5rem;">
          This proves that the transaction is included in the block without needing all ${this.txHashes.length} transactions.
          Only ${result.proof.length} hashes are needed instead of ${this.txHashes.length} — a ${Math.round((1 - result.proof.length / this.txHashes.length) * 100)}% reduction.
        </p>
      </div>

      <div style="margin-top:1rem;">
        <button class="btn btn-outline btn-sm" id="verify-proof-btn">
          <i class="fas fa-check-double"></i> Verify This Proof
        </button>
      </div>
    `;

    // Verify proof button
    document.getElementById('verify-proof-btn').addEventListener('click', async () => {
      const btn = document.getElementById('verify-proof-btn');
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying Proof...';
      }

      try {
        const verifyResult = await API.post('/api/crypto/merkle/verify', {
          leafHash: result.leafHash,
          proof: result.proof,
          expectedRoot: result.root,
          root: result.root
        });

        if (btn) {
          if (verifyResult.valid) {
            btn.className = 'btn btn-sm btn-primary';
            btn.innerHTML = '<i class="fas fa-check-circle"></i> Proof Verified Valid!';
          } else {
            btn.className = 'btn btn-sm btn-outline btn-danger';
            btn.innerHTML = '<i class="fas fa-times-circle"></i> Proof Invalid';
          }
        }

        showToast(
          verifyResult.valid
            ? `Merkle proof verified! Computed root matches: ${truncateHash(result.root)}`
            : `Proof invalid! Computed: ${truncateHash(verifyResult.computedRoot)}`,
          verifyResult.valid ? 'success' : 'error'
        );
      } finally {
        if (btn) btn.disabled = false;
      }
    });

    proofCard.scrollIntoView({ behavior: 'smooth' });
    showToast(`Proof generated for leaf ${leafIndex + 1} (${result.proof.length} steps)`, 'success');
  },

  async sha256(message) {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },

  renderFallbackTree(treeLevels, txData) {
    const container = document.getElementById('merkle-tree-svg');
    if (!container || !treeLevels || treeLevels.length === 0) return;

    let html = `
      <div style="display:flex;flex-direction:column;gap:1.5rem;align-items:center;padding:1.5rem 0;">
    `;

    // Render levels from top (root) to bottom (leaves)
    for (let l = treeLevels.length - 1; l >= 0; l--) {
      const level = treeLevels[l];
      const isRoot = l === treeLevels.length - 1;
      const isLeaf = l === 0;

      html += `
        <div style="display:flex;flex-direction:column;align-items:center;width:100%;">
          <div style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted);margin-bottom:0.4rem;">
            ${isRoot ? 'Level ' + (l + 1) + ' — Merkle Root' : (isLeaf ? 'Level 1 — Leaf Nodes (Transactions)' : 'Level ' + (l + 1) + ' — Intermediate Hashes')}
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:0.8rem;justify-content:center;width:100%;max-width:900px;">
      `;

      level.forEach((node, idx) => {
        const bg = isRoot ? 'rgba(245,158,11,0.15)' : (isLeaf ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.15)');
        const border = isRoot ? 'var(--accent-orange)' : (isLeaf ? 'var(--accent-green)' : 'var(--accent-blue)');
        const color = isRoot ? 'var(--accent-orange)' : (isLeaf ? 'var(--accent-green)' : 'var(--accent-blue)');

        html += `
          <div class="merkle-node-card ${isLeaf ? 'clickable-leaf' : ''}" data-leaf-idx="${isLeaf ? idx : ''}"
               style="background:${bg};border:1px solid ${border};border-radius:8px;padding:0.6rem 0.9rem;text-align:center;min-width:140px;${isLeaf ? 'cursor:pointer;transition:transform 0.15s,box-shadow 0.15s;' : ''}"
               title="${isLeaf ? 'Click to generate Merkle Proof' : node.hash}">
            <div style="font-size:0.75rem;font-weight:700;color:${color};margin-bottom:0.2rem;">
              ${isRoot ? 'ROOT' : (isLeaf ? (txData[idx] || 'Tx ' + (idx + 1)) : 'Node ' + (idx + 1))}
              ${node.isDuplicate ? ' <span style="color:var(--accent-red);">(dup)</span>' : ''}
            </div>
            <code style="font-size:0.75rem;color:var(--text-primary);font-family:var(--font-mono);">${truncateHash(node.hash, 5)}</code>
            ${isLeaf ? '<div style="font-size:0.68rem;color:var(--text-muted);margin-top:0.25rem;"><i class="fas fa-route"></i> Click for Proof</div>' : ''}
          </div>
        `;
      });

      html += `
          </div>
        </div>
      `;

      if (l > 0) {
        html += `
          <div style="color:var(--border-color);font-size:1.2rem;line-height:0.8;">
            <i class="fas fa-arrows-alt-v"></i>
          </div>
        `;
      }
    }

    html += `</div>`;
    container.innerHTML = html;

    // Attach click listeners to leaf nodes
    container.querySelectorAll('.clickable-leaf').forEach(el => {
      el.addEventListener('click', () => {
        const leafIdx = parseInt(el.getAttribute('data-leaf-idx'), 10);
        if (!isNaN(leafIdx)) {
          this.generateProof(leafIdx, txData[leafIdx]);
        }
      });
      el.addEventListener('mouseenter', () => { el.style.transform = 'translateY(-2px)'; el.style.boxShadow = 'var(--shadow-md)'; });
      el.addEventListener('mouseleave', () => { el.style.transform = ''; el.style.boxShadow = ''; });
    });
  }
};
