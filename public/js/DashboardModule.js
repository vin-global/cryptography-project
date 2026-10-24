/**
 * DashboardModule.js
 * Performance dashboard with Chart.js visualizations and summary cards.
 * All data comes from actual recorded operations.
 */

const DashboardModule = {
  charts: {},

  init() {
    // Charts will be created when the page is shown
  },

  async loadDashboard() {
    const loading = document.getElementById('dashboard-loading');
    const content = document.getElementById('dashboard-content');

    loading.style.display = 'flex';
    content.style.display = 'none';

    try {
      const result = await API.get('/api/dashboard');
      if (result.success) {
        this.renderDashboard(result.data);
        content.style.display = 'block';
      } else {
        showToast('Failed to load dashboard data.', 'error');
      }
    } catch (err) {
      showToast('Error loading dashboard.', 'error');
    } finally {
      loading.style.display = 'none';
    }
  },

  renderDashboard(data) {
    this.renderSummaryCards(data.summary);
    this.renderHashChart(data.hashPerformance);
    this.renderSigningChart(data.signingPerformance);
    this.renderMerkleChart(data.merklePerformance);
    this.renderRecentActivity(data.recentActivity);
  },

  renderSummaryCards(summary) {
    const container = document.getElementById('summary-cards');
    container.innerHTML = '';

    const cards = [
      { icon: 'fa-cube', color: 'blue', value: summary.totalBlocks, label: 'Blocks Created' },
      { icon: 'fa-exchange-alt', color: 'green', value: summary.totalTransactions, label: 'Transactions' },
      { icon: 'fa-route', color: 'purple', value: summary.totalProofs, label: 'Merkle Proofs' },
      { icon: 'fa-hashtag', color: 'cyan', value: summary.totalHashOps, label: 'Hash Operations' },
      { icon: 'fa-signature', color: 'orange', value: summary.totalSignOps, label: 'Sign/Verify Ops' },
      { icon: 'fa-project-diagram', color: 'pink', value: summary.totalMerkleOps, label: 'Merkle Ops' }
    ];

    cards.forEach(c => {
      const card = document.createElement('div');
      card.className = 'summary-card';
      card.innerHTML = `
        <div class="card-icon ${c.color}"><i class="fas ${c.icon}"></i></div>
        <div class="card-info">
          <h4>${c.value}</h4>
          <p>${c.label}</p>
        </div>
      `;
      container.appendChild(card);
    });
  },

  renderHashChart(perf) {
    const canvas = document.getElementById('hash-perf-chart');
    const emptyState = document.getElementById('hash-chart-empty');

    if (!perf || (!perf.sha256Stats.count && !perf.keccak256Stats.count)) {
      canvas.style.display = 'none';
      emptyState.style.display = 'flex';
      return;
    }

    emptyState.style.display = 'none';

    if (typeof Chart === 'undefined') {
      canvas.style.display = 'none';
      let fb = document.getElementById('hash-chart-fallback');
      if (!fb) {
        fb = document.createElement('div');
        fb.id = 'hash-chart-fallback';
        canvas.parentNode.appendChild(fb);
      }
      fb.innerHTML = `
        <div style="padding:1rem;display:flex;flex-direction:column;gap:1rem;">
          <div>
            <div style="display:flex;justify-content:space-between;font-size:0.85rem;margin-bottom:0.3rem;">
              <span style="color:var(--accent-blue);font-weight:600;"><i class="fas fa-shield-alt"></i> SHA-256 (Avg: ${formatTime(perf.sha256Stats.avgTime)})</span>
              <span style="color:var(--text-muted);">${perf.sha256Stats.count || 0} ops</span>
            </div>
            <div style="background:var(--bg-input);border-radius:4px;height:12px;overflow:hidden;">
              <div style="background:var(--accent-blue);height:100%;width:${Math.min(100, Math.max(15, (perf.sha256Stats.avgTime || 1) * 20))}%;"></div>
            </div>
          </div>
          <div>
            <div style="display:flex;justify-content:space-between;font-size:0.85rem;margin-bottom:0.3rem;">
              <span style="color:var(--accent-purple);font-weight:600;"><i class="fab fa-ethereum"></i> Keccak-256 (Avg: ${formatTime(perf.keccak256Stats.avgTime)})</span>
              <span style="color:var(--text-muted);">${perf.keccak256Stats.count || 0} ops</span>
            </div>
            <div style="background:var(--bg-input);border-radius:4px;height:12px;overflow:hidden;">
              <div style="background:var(--accent-purple);height:100%;width:${Math.min(100, Math.max(15, (perf.keccak256Stats.avgTime || 1) * 20))}%;"></div>
            </div>
          </div>
        </div>
      `;
      return;
    }

    canvas.style.display = 'block';

    // Destroy existing chart
    if (this.charts.hashChart) this.charts.hashChart.destroy();

    this.charts.hashChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: ['Avg Time (ms)', 'Min Time (ms)', 'Max Time (ms)'],
        datasets: [
          {
            label: 'SHA-256',
            data: [
              perf.sha256Stats.avgTime || 0,
              perf.sha256Stats.minTime || 0,
              perf.sha256Stats.maxTime || 0
            ],
            backgroundColor: 'rgba(59, 130, 246, 0.6)',
            borderColor: 'rgba(59, 130, 246, 1)',
            borderWidth: 1
          },
          {
            label: 'Keccak-256',
            data: [
              perf.keccak256Stats.avgTime || 0,
              perf.keccak256Stats.minTime || 0,
              perf.keccak256Stats.maxTime || 0
            ],
            backgroundColor: 'rgba(139, 92, 246, 0.6)',
            borderColor: 'rgba(139, 92, 246, 1)',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#9ca3b4', font: { family: 'Inter' } } },
          tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${parseFloat(ctx.raw).toFixed(4)} ms` } }
        },
        scales: {
          x: { ticks: { color: '#6b7280' }, grid: { color: 'rgba(255,255,255,0.03)' } },
          y: { ticks: { color: '#6b7280' }, grid: { color: 'rgba(255,255,255,0.05)' }, title: { display: true, text: 'milliseconds', color: '#6b7280' } }
        }
      }
    });
  },

  renderSigningChart(perf) {
    const canvas = document.getElementById('sign-perf-chart');
    const emptyState = document.getElementById('sign-chart-empty');

    if (!perf || (!perf.signStats.count && !perf.verifyStats.count)) {
      canvas.style.display = 'none';
      emptyState.style.display = 'flex';
      return;
    }

    emptyState.style.display = 'none';

    if (typeof Chart === 'undefined') {
      canvas.style.display = 'none';
      let fb = document.getElementById('sign-chart-fallback');
      if (!fb) {
        fb = document.createElement('div');
        fb.id = 'sign-chart-fallback';
        canvas.parentNode.appendChild(fb);
      }
      fb.innerHTML = `
        <div style="padding:1rem;display:flex;flex-direction:column;gap:1rem;">
          <div style="display:flex;justify-content:space-between;font-size:0.85rem;">
            <span><i class="fas fa-file-signature" style="color:var(--accent-green);"></i> Signing Ops: <strong>${perf.signStats.count || 0}</strong></span>
            <span>Avg Time: <strong>${formatTime(perf.signStats.avgTime)}</strong></span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:0.85rem;">
            <span><i class="fas fa-check-double" style="color:var(--accent-orange);"></i> Verification Ops: <strong>${perf.verifyStats.count || 0}</strong></span>
            <span>Avg Time: <strong>${formatTime(perf.verifyStats.avgTime)}</strong></span>
          </div>
        </div>
      `;
      return;
    }

    canvas.style.display = 'block';

    if (this.charts.signChart) this.charts.signChart.destroy();

    this.charts.signChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: ['Operations', 'Avg Time (ms)', 'Success', 'Failures'],
        datasets: [
          {
            label: 'Sign',
            data: [
              perf.signStats.count || 0,
              perf.signStats.avgTime || 0,
              perf.signStats.successCount || 0,
              perf.signStats.failCount || 0
            ],
            backgroundColor: 'rgba(16, 185, 129, 0.6)',
            borderColor: 'rgba(16, 185, 129, 1)',
            borderWidth: 1
          },
          {
            label: 'Verify',
            data: [
              perf.verifyStats.count || 0,
              perf.verifyStats.avgTime || 0,
              perf.verifyStats.successCount || 0,
              perf.verifyStats.failCount || 0
            ],
            backgroundColor: 'rgba(245, 158, 11, 0.6)',
            borderColor: 'rgba(245, 158, 11, 1)',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#9ca3b4', font: { family: 'Inter' } } } },
        scales: {
          x: { ticks: { color: '#6b7280' }, grid: { color: 'rgba(255,255,255,0.03)' } },
          y: { ticks: { color: '#6b7280' }, grid: { color: 'rgba(255,255,255,0.05)' } }
        }
      }
    });
  },

  renderMerkleChart(perf) {
    const canvas = document.getElementById('merkle-perf-chart');
    const emptyState = document.getElementById('merkle-chart-empty');

    if (!perf || (!perf.buildStats.count && !perf.proofStats.count)) {
      canvas.style.display = 'none';
      emptyState.style.display = 'flex';
      return;
    }

    emptyState.style.display = 'none';

    if (typeof Chart === 'undefined') {
      canvas.style.display = 'none';
      let fb = document.getElementById('merkle-chart-fallback');
      if (!fb) {
        fb = document.createElement('div');
        fb.id = 'merkle-chart-fallback';
        canvas.parentNode.appendChild(fb);
      }
      fb.innerHTML = `
        <div style="padding:1rem;display:flex;flex-direction:column;gap:1rem;">
          <div style="display:flex;justify-content:space-between;font-size:0.85rem;">
            <span><i class="fas fa-hammer" style="color:var(--accent-purple);"></i> Trees Built: <strong>${perf.buildStats.count || 0}</strong></span>
            <span>Avg Build Time: <strong>${formatTime(perf.buildStats.avgTime)}</strong></span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:0.85rem;">
            <span><i class="fas fa-route" style="color:var(--accent-pink);"></i> Proofs Generated: <strong>${perf.proofStats.count || 0}</strong></span>
            <span>Avg Proof Time: <strong>${formatTime(perf.proofStats.avgTime)}</strong></span>
          </div>
        </div>
      `;
      return;
    }

    canvas.style.display = 'block';

    if (this.charts.merkleChart) this.charts.merkleChart.destroy();

    this.charts.merkleChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: ['Build Ops', 'Build Avg (ms)', 'Avg Leaves', 'Proof Ops', 'Proof Avg (ms)', 'Avg Depth'],
        datasets: [{
          label: 'Merkle Operations',
          data: [
            perf.buildStats.count || 0,
            perf.buildStats.avgTime || 0,
            perf.buildStats.avgLeafCount || 0,
            perf.proofStats.count || 0,
            perf.proofStats.avgTime || 0,
            perf.proofStats.avgDepth || 0
          ],
          backgroundColor: [
            'rgba(139, 92, 246, 0.6)',
            'rgba(139, 92, 246, 0.4)',
            'rgba(139, 92, 246, 0.3)',
            'rgba(236, 72, 153, 0.6)',
            'rgba(236, 72, 153, 0.4)',
            'rgba(236, 72, 153, 0.3)'
          ],
          borderColor: [
            'rgba(139, 92, 246, 1)',
            'rgba(139, 92, 246, 0.8)',
            'rgba(139, 92, 246, 0.6)',
            'rgba(236, 72, 153, 1)',
            'rgba(236, 72, 153, 0.8)',
            'rgba(236, 72, 153, 0.6)'
          ],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#6b7280', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.03)' } },
          y: { ticks: { color: '#6b7280' }, grid: { color: 'rgba(255,255,255,0.05)' } }
        }
      }
    });
  },

  renderRecentActivity(activity) {
    const container = document.getElementById('recent-activity-table');
    const emptyState = document.getElementById('activity-empty');

    if (!activity || activity.length === 0) {
      container.innerHTML = '';
      emptyState.style.display = 'flex';
      return;
    }

    emptyState.style.display = 'none';

    const typeIcons = {
      hash: '<i class="fas fa-hashtag" style="color:var(--accent-blue);"></i>',
      signing: '<i class="fas fa-signature" style="color:var(--accent-green);"></i>',
      merkle: '<i class="fas fa-project-diagram" style="color:var(--accent-purple);"></i>'
    };

    const rows = activity.map(a => `
      <tr>
        <td>${typeIcons[a.type] || ''} ${a.type}</td>
        <td>${a.detail || '—'}</td>
        <td class="mono">${formatTime(a.time_ms)}</td>
        <td>${formatDate(a.created_at)}</td>
      </tr>
    `).join('');

    container.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Type</th><th>Detail</th><th>Time</th><th>Date</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }
};
