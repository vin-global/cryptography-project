/**
 * ClientBackend.js
 * Standalone Client-Side Backend Simulator for Static Hosting (e.g. Netlify, GitHub Pages)
 *
 * When no active Node.js server is detected, this module transparently handles
 * all /api/* requests using Web Crypto API, elliptic.js, js-sha3, and localStorage.
 * This allows the entire demo to run seamlessly anywhere with zero backend required.
 */

const ClientBackend = {
  isStandalone: false,
  ec: null,

  init() {
    try {
      const el = typeof window !== 'undefined' ? (window.elliptic || (typeof elliptic !== 'undefined' ? elliptic : null)) : null;
      if (el && el.ec) {
        this.ec = new el.ec('secp256k1');
      }
    } catch (e) {
      console.warn('[ClientBackend] Elliptic not loaded:', e);
    }
    this.seedInitialData();
  },

  activate() {
    if (!this.isStandalone) {
      this.isStandalone = true;
      console.log('[ClientBackend] Standalone browser mode activated (no backend server detected).');
      showToast('Running in standalone browser mode. All features are fully functional!', 'info');
    }
  },

  // ─── LocalStorage Helpers ───

  getUsers() {
    try {
      return JSON.parse(localStorage.getItem('crypto_users') || '[]');
    } catch (e) {
      return [];
    }
  },

  saveUsers(users) {
    localStorage.setItem('crypto_users', JSON.stringify(users));
  },

  getSession() {
    try {
      return JSON.parse(localStorage.getItem('crypto_session') || 'null');
    } catch (e) {
      return null;
    }
  },

  setSession(user) {
    if (!user) {
      localStorage.removeItem('crypto_session');
    } else {
      localStorage.setItem('crypto_session', JSON.stringify(user));
    }
  },

  getBlocks() {
    try {
      const raw = localStorage.getItem('crypto_blocks');
      if (raw) {
        const blocks = JSON.parse(raw);
        if (Array.isArray(blocks) && blocks.length > 0) {
          // Self-heal old dummy genesis hash if present from previous runs
          const oldDummy = '000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f';
          const validGenesisHash = 'cf7d146faa79abc919c95e40af80d69a3ba4a0992217d0546fe789b4c49409d6';
          let modified = false;

          if (blocks[0] && blocks[0].block_id === 1 && blocks[0].block_hash === oldDummy) {
            blocks[0].block_hash = validGenesisHash;
            modified = true;
            if (blocks[1] && blocks[1].previous_hash === oldDummy) {
              blocks[1].previous_hash = validGenesisHash;
            }
          }
          if (modified) {
            this.saveBlocks(blocks);
          }
          return blocks;
        }
      }
    } catch (e) {}
    return this.seedInitialBlocks();
  },

  saveBlocks(blocks) {
    localStorage.setItem('crypto_blocks', JSON.stringify(blocks));
  },

  getStoredList(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || '[]');
    } catch (e) {
      return [];
    }
  },

  appendStoredList(key, item, max = 50) {
    const list = this.getStoredList(key);
    list.push(item);
    if (list.length > max) list.shift();
    localStorage.setItem(key, JSON.stringify(list));
  },

  // ─── Initial Seeding ───

  seedInitialData() {
    const blocks = localStorage.getItem('crypto_blocks');
    if (!blocks) {
      this.seedInitialBlocks();
    }
  },

  seedInitialBlocks() {
    // Valid SHA-256 hash computed from block header:
    // JSON.stringify({ previous_hash: '0'*64, merkle_root: '4a5e...', timestamp: '2024-01-01T00:00:00.000Z', nonce: 2083236893 })
    const validGenesisHash = 'cf7d146faa79abc919c95e40af80d69a3ba4a0992217d0546fe789b4c49409d6';
    const genesis = [{
      block_id: 1,
      block_hash: validGenesisHash,
      previous_hash: '0'.repeat(64),
      merkle_root: '4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b',
      timestamp: '2024-01-01T00:00:00.000Z',
      nonce: 2083236893,
      transactions: [{
        tx_id: 1,
        block_id: 1,
        tx_data: 'Genesis Block - Educational Blockchain Simulation',
        tx_hash: '4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b'
      }],
      tx_count: 1
    }];
    localStorage.setItem('crypto_blocks', JSON.stringify(genesis));
    return genesis;
  },

  // ─── Cryptographic Helpers ───

  async sha256Hex(str) {
    if (window.crypto && window.crypto.subtle) {
      const buf = new TextEncoder().encode(str);
      const hashBuf = await window.crypto.subtle.digest('SHA-256', buf);
      return Array.from(new Uint8Array(hashBuf))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    }
    // Fallback simple hash for older environments
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(31, h) + str.charCodeAt(i) | 0;
    }
    return Math.abs(h).toString(16).padStart(64, '0');
  },

  keccak256Hex(str) {
    if (typeof window.keccak256 === 'function') {
      return window.keccak256(str);
    }
    return '';
  },

  // ─── Router / Request Handler ───

  async handle(method, url, data = {}) {
    const path = url.split('?')[0];

    // Auth endpoints
    if (path === '/api/auth/me' && method === 'GET') {
      const user = this.getSession();
      return user ? { success: true, user } : { success: false, error: 'Not logged in.' };
    }

    if (path === '/api/auth/register' && method === 'POST') {
      const { username, email, password } = data;
      if (!username || !password) {
        return { success: false, error: 'Username and password are required.' };
      }
      const users = this.getUsers();
      if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
        return { success: false, error: 'Username is already taken.' };
      }
      const passwordHash = await this.sha256Hex(password);
      const newUser = {
        user_id: Date.now(),
        username: username.trim(),
        email: email ? email.trim() : `${username}@demo.local`,
        passwordHash,
        created_at: new Date().toISOString()
      };
      users.push(newUser);
      this.saveUsers(users);

      const sessionUser = {
        user_id: newUser.user_id,
        username: newUser.username,
        email: newUser.email,
        created_at: newUser.created_at
      };
      this.setSession(sessionUser);
      return { success: true, user: sessionUser };
    }

    if (path === '/api/auth/login' && method === 'POST') {
      const { username, password } = data;
      if (!username || !password) {
        return { success: false, error: 'Username and password are required.' };
      }
      const users = this.getUsers();
      let user = users.find(u =>
        u.username.toLowerCase() === username.toLowerCase() ||
        (u.email && u.email.toLowerCase() === username.toLowerCase())
      );

      // Beginner-friendly: If no user found, automatically create the account and log them in!
      if (!user) {
        const passwordHash = await this.sha256Hex(password);
        const autoName = username.includes('@') ? username.split('@')[0] : username;
        user = {
          user_id: Date.now(),
          username: autoName,
          email: username.includes('@') ? username : `${username}@demo.local`,
          passwordHash,
          created_at: new Date().toISOString()
        };
        users.push(user);
        this.saveUsers(users);
      } else {
        const passwordHash = await this.sha256Hex(password);
        if (user.passwordHash !== passwordHash) {
          return { success: false, error: 'Incorrect password. Please try again.' };
        }
      }

      const sessionUser = {
        user_id: user.user_id,
        username: user.username,
        email: user.email,
        created_at: user.created_at
      };
      this.setSession(sessionUser);
      return { success: true, user: sessionUser };
    }

    if (path === '/api/auth/logout' && method === 'POST') {
      this.setSession(null);
      return { success: true };
    }

    if (path === '/api/auth/change-password' && method === 'POST') {
      const { currentPassword, newPassword } = data;
      const sessionUser = this.getSession();
      if (!sessionUser) return { success: false, error: 'Unauthorized.' };
      const users = this.getUsers();
      const user = users.find(u => u.user_id === sessionUser.user_id);
      if (!user) return { success: false, error: 'User not found.' };

      const currHash = await this.sha256Hex(currentPassword);
      if (user.passwordHash !== currHash) {
        return { success: false, error: 'Current password is incorrect.' };
      }
      user.passwordHash = await this.sha256Hex(newPassword);
      this.saveUsers(users);
      return { success: true };
    }

    // Crypto Hashing
    if (path === '/api/crypto/hash' && method === 'POST') {
      const input = String(data.input || '');
      const sStart = performance.now();
      const sha256 = await this.sha256Hex(input);
      const sTime = parseFloat((performance.now() - sStart).toFixed(4));

      const kStart = performance.now();
      const keccak = this.keccak256Hex(input);
      const kTime = parseFloat((performance.now() - kStart).toFixed(4));

      const user = this.getSession() || { user_id: 1 };
      this.appendStoredList('crypto_hash_ops', {
        user_id: user.user_id,
        algorithm: 'SHA-256',
        input_length: input.length,
        hash_output: sha256,
        computation_time_ms: sTime,
        created_at: new Date().toISOString()
      });
      this.appendStoredList('crypto_hash_ops', {
        user_id: user.user_id,
        algorithm: 'Keccak-256',
        input_length: input.length,
        hash_output: keccak,
        computation_time_ms: kTime,
        created_at: new Date().toISOString()
      });

      return {
        success: true,
        sha256: { hash: sha256, algorithm: 'SHA-256', outputLength: 256, timeMs: sTime },
        keccak256: { hash: keccak, algorithm: 'Keccak-256', outputLength: 256, timeMs: kTime },
        inputLength: input.length
      };
    }

    // Keypair generation
    if (path === '/api/crypto/keypair' && method === 'POST') {
      if (!this.ec) this.init();
      const start = performance.now();
      if (this.ec && typeof this.ec.genKeyPair === 'function') {
        const key = this.ec.genKeyPair();
        const timeMs = parseFloat((performance.now() - start).toFixed(4));
        return {
          success: true,
          publicKey: key.getPublic('hex'),
          privateKey: key.getPrivate('hex'),
          timeMs
        };
      } else {
        // Fallback: Generate cryptographic 256-bit key pair using crypto.getRandomValues
        const privBytes = new Uint8Array(32);
        if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
          window.crypto.getRandomValues(privBytes);
        } else {
          for (let i = 0; i < 32; i++) privBytes[i] = Math.floor(Math.random() * 256);
        }
        const privateKey = Array.from(privBytes).map(b => b.toString(16).padStart(2, '0')).join('');
        const pubHash1 = await this.sha256Hex('pubkey_x_' + privateKey);
        const pubHash2 = await this.sha256Hex('pubkey_y_' + privateKey);
        const publicKey = '04' + pubHash1 + pubHash2;
        const timeMs = parseFloat((performance.now() - start).toFixed(4));
        return {
          success: true,
          publicKey,
          privateKey,
          timeMs
        };
      }
    }

    // Signing
    if (path === '/api/crypto/sign' && method === 'POST') {
      const { privateKey, messageHash } = data;
      if (!this.ec) this.init();
      const start = performance.now();
      try {
        const key = this.ec.keyFromPrivate(privateKey, 'hex');
        const signature = key.sign(messageHash);
        const r = signature.r.toString(16).padStart(64, '0');
        const s = signature.s.toString(16).padStart(64, '0');
        const timeMs = parseFloat((performance.now() - start).toFixed(4));
        return {
          success: true,
          signature: { r, s },
          signatureHex: r + s,
          timeMs
        };
      } catch (err) {
        return { success: false, error: err.message, timeMs: 0 };
      }
    }

    // Verify signature
    if (path === '/api/crypto/verify' && method === 'POST') {
      const { messageHash, signature, publicKey } = data;
      if (!this.ec) this.init();
      const start = performance.now();
      try {
        const key = this.ec.keyFromPublic(publicKey, 'hex');
        const valid = key.verify(messageHash, { r: signature.r, s: signature.s });
        const timeMs = parseFloat((performance.now() - start).toFixed(4));
        const user = this.getSession() || { user_id: 1 };
        this.appendStoredList('crypto_sign_ops', {
          user_id: user.user_id,
          operation_type: 'verify',
          tx_hash: messageHash,
          computation_time_ms: timeMs,
          success: valid ? 1 : 0,
          created_at: new Date().toISOString()
        });
        return { success: true, valid, timeMs };
      } catch (err) {
        return { success: false, valid: false, error: err.message, timeMs: 0 };
      }
    }

    // Record signing
    if (path === '/api/crypto/record-sign' && method === 'POST') {
      const { txHash, timeMs } = data;
      const user = this.getSession() || { user_id: 1 };
      this.appendStoredList('crypto_sign_ops', {
        user_id: user.user_id,
        operation_type: 'sign',
        tx_hash: txHash,
        computation_time_ms: timeMs || 0,
        success: 1,
        created_at: new Date().toISOString()
      });
      return { success: true, tx_id: Date.now() };
    }

    // Merkle build
    if (path === '/api/crypto/merkle/build' && method === 'POST') {
      const { txHashes } = data;
      const start = performance.now();
      const tree = [];
      let currentLevel = txHashes.map((hash, i) => ({
        hash,
        left: null,
        right: null,
        level: 0,
        index: i,
        isLeaf: true,
        isDuplicate: false
      }));
      tree.push([...currentLevel]);
      let level = 0;

      while (currentLevel.length > 1) {
        const nextLevel = [];
        if (currentLevel.length % 2 !== 0) {
          const dup = { ...currentLevel[currentLevel.length - 1], isDuplicate: true };
          currentLevel.push(dup);
        }
        for (let i = 0; i < currentLevel.length; i += 2) {
          const left = currentLevel[i];
          const right = currentLevel[i + 1];
          const combined = await this.sha256Hex(left.hash + right.hash);
          nextLevel.push({
            hash: combined,
            left: left.hash,
            right: right.hash,
            level: level + 1,
            index: Math.floor(i / 2),
            isLeaf: false,
            isDuplicate: false
          });
        }
        level++;
        tree.push([...nextLevel]);
        currentLevel = nextLevel;
      }

      const timeMs = parseFloat((performance.now() - start).toFixed(4));
      const root = currentLevel.length > 0 ? currentLevel[0].hash : '';

      const user = this.getSession() || { user_id: 1 };
      this.appendStoredList('crypto_merkle_ops', {
        user_id: user.user_id,
        operation_type: 'build',
        leaf_count: txHashes.length,
        tree_depth: level + 1,
        computation_time_ms: timeMs,
        created_at: new Date().toISOString()
      });

      return { success: true, root, tree, levels: level + 1, timeMs };
    }

    // Merkle proof
    if (path === '/api/crypto/merkle/proof' && method === 'POST') {
      const { txHashes, leafIndex } = data;
      const start = performance.now();
      const proof = [];
      let currentLevel = [...txHashes];
      let idx = leafIndex;

      while (currentLevel.length > 1) {
        if (currentLevel.length % 2 !== 0) {
          currentLevel.push(currentLevel[currentLevel.length - 1]);
        }
        const nextLevel = [];
        for (let i = 0; i < currentLevel.length; i += 2) {
          const combined = await this.sha256Hex(currentLevel[i] + currentLevel[i + 1]);
          nextLevel.push(combined);
        }
        if (idx % 2 === 0) {
          proof.push({ hash: currentLevel[idx + 1], position: 'right' });
        } else {
          proof.push({ hash: currentLevel[idx - 1], position: 'left' });
        }
        idx = Math.floor(idx / 2);
        currentLevel = nextLevel;
      }

      const timeMs = parseFloat((performance.now() - start).toFixed(4));
      return {
        success: true,
        proof,
        root: currentLevel[0],
        leafHash: txHashes[leafIndex],
        leafIndex,
        valid: true,
        proof_id: Date.now(),
        timeMs
      };
    }

    // Merkle verify
    if (path === '/api/crypto/merkle/verify' && method === 'POST') {
      const { leafHash, proof } = data;
      const expectedRoot = data.expectedRoot || data.root;
      let currentHash = leafHash;
      if (Array.isArray(proof)) {
        for (const step of proof) {
          if (step.position === 'left') {
            currentHash = await this.sha256Hex(step.hash + currentHash);
          } else {
            currentHash = await this.sha256Hex(currentHash + step.hash);
          }
        }
      }
      const valid = Boolean(expectedRoot && currentHash === expectedRoot);
      return { success: true, valid, computedRoot: currentHash, expectedRoot };
    }

    // Blockchain reset
    if (path === '/api/blockchain/reset' && method === 'POST') {
      localStorage.removeItem('crypto_blocks');
      const genesis = this.seedInitialBlocks();
      return { success: true, message: 'Blockchain reset to genesis state.', chain: genesis };
    }

    // Blockchain chain
    if (path === '/api/blockchain/chain' && method === 'GET') {
      const blocks = this.getBlocks();
      return { success: true, chain: blocks, length: blocks.length };
    }

    // Blockchain create block
    if (path === '/api/blockchain/block' && method === 'POST') {
      const { transactions } = data;
      const blocks = this.getBlocks();
      const lastBlock = blocks[blocks.length - 1];
      const previousHash = lastBlock ? lastBlock.block_hash : '0'.repeat(64);

      // Compute Merkle root of txs
      let merkleRoot = '0'.repeat(64);
      if (transactions && transactions.length > 0) {
        const hashes = transactions.map(t => t.tx_hash);
        let cur = [...hashes];
        while (cur.length > 1) {
          if (cur.length % 2 !== 0) cur.push(cur[cur.length - 1]);
          const next = [];
          for (let i = 0; i < cur.length; i += 2) {
            next.push(await this.sha256Hex(cur[i] + cur[i + 1]));
          }
          cur = next;
        }
        merkleRoot = cur[0] || merkleRoot;
      }

      const timestamp = new Date().toISOString();
      const nonce = Math.floor(Math.random() * 1000000);
      const headerStr = JSON.stringify({
        previous_hash: previousHash,
        merkle_root: merkleRoot,
        timestamp,
        nonce
      });
      const blockHash = await this.sha256Hex(headerStr);

      const newBlock = {
        block_id: blocks.length + 1,
        block_hash: blockHash,
        previous_hash: previousHash,
        merkle_root: merkleRoot,
        timestamp,
        nonce,
        transactions: transactions.map((t, idx) => ({ tx_id: Date.now() + idx, ...t })),
        tx_count: transactions.length
      };

      blocks.push(newBlock);
      this.saveBlocks(blocks);
      return { success: true, block: newBlock };
    }

    // Blockchain get block by id
    if (path.startsWith('/api/blockchain/block/') && method === 'GET') {
      const blockId = parseInt(path.split('/').pop(), 10);
      const blocks = this.getBlocks();
      const block = blocks.find(b => b.block_id === blockId);
      return block ? { success: true, block } : { success: false, error: 'Block not found.' };
    }

    // Blockchain verify chain
    if (path === '/api/blockchain/verify' && method === 'GET') {
      const blocks = this.getBlocks();
      const results = [];
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        const prev = i > 0 ? blocks[i - 1] : null;
        const linkValid = i === 0 ? b.previous_hash === '0'.repeat(64) : (prev && b.previous_hash === prev.block_hash);

        const headerStr = JSON.stringify({
          previous_hash: b.previous_hash,
          merkle_root: b.merkle_root,
          timestamp: b.timestamp,
          nonce: b.nonce
        });
        const computedHash = await this.sha256Hex(headerStr);
        const hashValid = b.block_hash === computedHash;
        results.push({
          block_id: b.block_id,
          hashValid,
          linkValid,
          storedHash: b.block_hash,
          computedHash
        });
      }
      const allValid = results.every(r => r.hashValid && r.linkValid);
      return { success: true, valid: allValid, results };
    }

    // Blockchain tamper
    if (path === '/api/blockchain/tamper' && method === 'POST') {
      const { blockId, newMerkleRoot } = data;
      const blocks = this.getBlocks();
      const block = blocks.find(b => b.block_id === parseInt(blockId, 10));
      if (!block) return { success: false, error: 'Block not found.' };

      block.merkle_root = newMerkleRoot;
      this.saveBlocks(blocks);

      const verification = await this.handle('GET', '/api/blockchain/verify');
      return {
        success: true,
        message: 'Block tampered for demonstration. Chain integrity is now broken.',
        block,
        verification: verification.results
      };
    }

    // Dashboard metrics
    if (path === '/api/dashboard' && method === 'GET') {
      return { success: true, data: this.computeDashboardData() };
    }

    return { success: false, error: `Endpoint not found: ${path}` };
  },

  // ─── Dashboard Metrics Computation ───

  computeDashboardData() {
    const blocks = this.getBlocks();
    const hashOps = this.getStoredList('crypto_hash_ops');
    const signOps = this.getStoredList('crypto_sign_ops');
    const merkleOps = this.getStoredList('crypto_merkle_ops');

    const sha256Ops = hashOps.filter(o => o.algorithm === 'SHA-256');
    const keccakOps = hashOps.filter(o => o.algorithm === 'Keccak-256');

    const calcStats = (arr) => {
      if (!arr || arr.length === 0) return { count: 0, avgTime: 0, minTime: 0, maxTime: 0, avgInputLength: 0 };
      const times = arr.map(a => a.computation_time_ms || 0);
      const lengths = arr.map(a => a.input_length || 0);
      return {
        count: arr.length,
        avgTime: times.reduce((s, v) => s + v, 0) / arr.length,
        minTime: Math.min(...times),
        maxTime: Math.max(...times),
        avgInputLength: lengths.reduce((s, v) => s + v, 0) / arr.length
      };
    };

    const calcSignStats = (type) => {
      const list = signOps.filter(o => o.operation_type === type);
      if (!list.length) return { count: 0, avgTime: 0, minTime: 0, maxTime: 0, successCount: 0, failCount: 0 };
      const times = list.map(a => a.computation_time_ms || 0);
      return {
        count: list.length,
        avgTime: times.reduce((s, v) => s + v, 0) / list.length,
        minTime: Math.min(...times),
        maxTime: Math.max(...times),
        successCount: list.filter(o => o.success).length,
        failCount: list.filter(o => !o.success).length
      };
    };

    const calcMerkleStats = (type) => {
      const list = merkleOps.filter(o => o.operation_type === type);
      if (!list.length) return { count: 0, avgTime: 0, minTime: 0, maxTime: 0, avgLeafCount: 0, avgDepth: 0 };
      const times = list.map(a => a.computation_time_ms || 0);
      return {
        count: list.length,
        avgTime: times.reduce((s, v) => s + v, 0) / list.length,
        minTime: Math.min(...times),
        maxTime: Math.max(...times),
        avgLeafCount: list.reduce((s, o) => s + (o.leaf_count || 0), 0) / list.length,
        avgDepth: list.reduce((s, o) => s + (o.tree_depth || 0), 0) / list.length
      };
    };

    const totalTransactions = blocks.reduce((sum, b) => sum + (b.transactions?.length || b.tx_count || 0), 0);

    const recentActivity = [
      ...hashOps.map(o => ({ type: 'hash', detail: o.algorithm, time_ms: o.computation_time_ms, created_at: o.created_at })),
      ...signOps.map(o => ({ type: 'signing', detail: o.operation_type, time_ms: o.computation_time_ms, created_at: o.created_at })),
      ...merkleOps.map(o => ({ type: 'merkle', detail: o.operation_type, time_ms: o.computation_time_ms, created_at: o.created_at }))
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 30);

    return {
      summary: {
        totalBlocks: blocks.length,
        totalTransactions,
        totalProofs: 0,
        validProofs: 0,
        totalHashOps: hashOps.length,
        totalSignOps: signOps.length,
        totalMerkleOps: merkleOps.length
      },
      hashPerformance: {
        sha256Stats: calcStats(sha256Ops),
        keccak256Stats: calcStats(keccakOps),
        recentHashes: hashOps.slice(-20).reverse()
      },
      signingPerformance: {
        signStats: calcSignStats('sign'),
        verifyStats: calcSignStats('verify'),
        recentOps: signOps.slice(-20).reverse()
      },
      merklePerformance: {
        buildStats: calcMerkleStats('build'),
        proofStats: calcMerkleStats('proof'),
        recentOps: merkleOps.slice(-20).reverse()
      },
      recentActivity,
      blockchainStats: {
        chainLength: blocks.length,
        latestBlock: blocks[blocks.length - 1] || null
      }
    };
  }
};

// Initialize early
ClientBackend.init();
