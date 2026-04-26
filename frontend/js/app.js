/* ═══════════════════════════════════════════
   app.js — Core application logic
   ═══════════════════════════════════════════ */

const API = 'http://localhost:8000';

/* ── Toast ─────────────────────────────── */
const Toast = {
  show(msg, type = 'info', duration = 3500) {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), duration);
  }
};

/* ── Modal ─────────────────────────────── */
const Modal = {
  open(title, html) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = html;
    document.getElementById('modal-overlay').classList.add('open');
  },
  close() {
    document.getElementById('modal-overlay').classList.remove('open');
  }
};

/* ── Time badge ─────────────────────────── */
function updateClock() {
  const el = document.getElementById('live-time');
  if (el) el.textContent = new Date().toLocaleTimeString('tr-TR');
}
setInterval(updateClock, 1000);
updateClock();

/* ── Sidebar toggle ─────────────────────── */
document.getElementById('sidebar-toggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

/* ══════════════════════════════════════════
   App — Tab management + Dashboard
══════════════════════════════════════════ */
const App = {
  currentTab: 'dashboard',
  statsCache: null,
  historyCache: [],

  init() {
    // Nav click
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
    });
    this.refreshDashboard();
    this.checkLLMStatus();
  },

  switchTab(tab) {
    this.currentTab = tab;
    document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');
    document.getElementById(`nav-${tab}`).classList.add('active');

    const titles = {
      dashboard: 'Dashboard',
      analyze: 'Analiz Et',
      camera: 'Kamera',
      history: 'Geçmiş',
      products: 'Ürünler'
    };
    document.getElementById('page-title').textContent = titles[tab] || tab;

    if (tab === 'history') History.load();
    if (tab === 'products') Products.load();
  },

  async refreshDashboard() {
    try {
      const res = await fetch(`${API}/api/stats`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      this.statsCache = data;

      document.getElementById('sv-analyses').textContent = data.total_analyses;
      document.getElementById('sv-items').textContent = data.total_items_detected;
      document.getElementById('sv-missing').textContent = data.total_missing;
      document.getElementById('sv-most-missing').textContent =
        data.most_missing_product ? data.most_missing_product.toUpperCase() : '—';

      this._renderRecentTable(data.recent_analyses);
      Charts.renderTrend(data.daily_chart);
      Charts.renderMissing(data.missing_frequency);
    } catch {
      Toast.show('Backend\'e bağlanılamadı. Sunucunun çalıştığından emin ol.', 'error');
    }
  },

  _renderRecentTable(rows) {
    const tbody = document.getElementById('recent-tbody');
    if (!rows || rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Henüz analiz yok. Analiz Et sekmesinden başla!</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td><span style="color:var(--text-muted)">#${r.id}</span></td>
        <td>${r.image_filename || '—'}</td>
        <td><span style="color:var(--teal);font-weight:600">${r.total_items}</span></td>
        <td>
          <span style="color:${r.missing_count > 0 ? 'var(--rose)' : 'var(--emerald)'}; font-weight:600">
            ${r.missing_count}
          </span>
        </td>
        <td>${sourceBadge(r.source)}</td>
        <td style="color:var(--text-secondary)">${fmtDate(r.analyzed_at)}</td>
      </tr>
    `).join('');
  },

  async checkLLMStatus() {
    const dot = document.getElementById('llm-status-dot');
    const txt = document.getElementById('llm-status-text');
    try {
      const r = await fetch('http://localhost:1234/v1/models', { signal: AbortSignal.timeout(3000) });
      if (r.ok) {
        dot.className = 'status-dot online';
        txt.textContent = 'LLM: Aktif';
      } else throw new Error();
    } catch {
      dot.className = 'status-dot offline';
      txt.textContent = 'LLM: Kapalı';
    }
    setTimeout(() => this.checkLLMStatus(), 15000);
  }
};

/* ══════════════════════════════════════════
   Analyze
══════════════════════════════════════════ */
const Analyze = {
  file: null,

  init() {
    const fileInput = document.getElementById('file-input');
    const dropZone  = document.getElementById('drop-zone');
    const slider    = document.getElementById('conf-slider');
    const confVal   = document.getElementById('conf-val');

    fileInput.addEventListener('change', e => {
      if (e.target.files[0]) this.setFile(e.target.files[0]);
    });

    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragging'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragging'));
    dropZone.addEventListener('drop', e => {
      e.preventDefault();
      dropZone.classList.remove('dragging');
      const f = e.dataTransfer.files[0];
      if (f && f.type.startsWith('image/')) this.setFile(f);
    });

    slider.addEventListener('input', () => {
      confVal.textContent = parseFloat(slider.value).toFixed(2);
    });
  },

  setFile(file) {
    this.file = file;
    document.getElementById('analyze-btn').disabled = false;
    // Preview
    const reader = new FileReader();
    reader.onload = e => {
      const img = document.getElementById('result-img');
      img.src = e.target.result;
      document.getElementById('preview-card').style.display = '';
      document.getElementById('img-loader').classList.remove('hidden');
      document.getElementById('img-loader').style.display = 'flex';
    };
    reader.readAsDataURL(file);
  },

  async run() {
    if (!this.file) return;
    const btn = document.getElementById('analyze-btn');
    btn.disabled = true;
    btn.textContent = '⏳ Analiz Ediliyor…';

    // Show loaders
    document.getElementById('preview-card').style.display = '';
    document.getElementById('img-loader').style.display = 'flex';
    document.getElementById('stock-grid-card').style.display = 'none';
    document.getElementById('ai-report-card').style.display = 'none';

    const conf = parseFloat(document.getElementById('conf-slider').value);
    const fd = new FormData();
    fd.append('file', this.file);
    fd.append('conf', conf.toString());

    try {
      const res = await fetch(`${API}/api/analyze`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      this._renderResult(data);
      Toast.show(`✅ Analiz tamamlandı — ${data.total_items} ürün tespit edildi.`, 'success');
    } catch (e) {
      Toast.show('Analiz başarısız: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><polygon points="5,3 19,12 5,21 5,3"/></svg> Analizi Başlat';
    }
  },

  _renderResult(data) {
    // Annotated image
    const img = document.getElementById('result-img');
    img.src = `data:image/jpeg;base64,${data.annotated_image}`;
    document.getElementById('img-loader').style.display = 'none';

    // Stock grid
    const grid = document.getElementById('stock-grid');
    grid.innerHTML = (data.items || []).map(item => {
      const cls = item.status.toLowerCase();
      return `
        <div class="stock-item ${cls}">
          <span class="stock-name">${item.display_name}</span>
          <span class="stock-count ${cls}">${item.count}</span>
          <span class="stock-critical-line">Kritik: ${item.critical_level}</span>
          <span class="stock-badge ${cls}">${item.status}</span>
        </div>`;
    }).join('') || '<p class="empty-state">Hiç ürün tespit edilemedi.</p>';

    document.getElementById('analysis-summary').textContent =
      `${data.total_items} ürün, ${data.missing_count} eksik`;
    document.getElementById('stock-grid-card').style.display = '';

    // AI report
    document.getElementById('ai-report-card').style.display = '';
    const reportEl = document.getElementById('ai-report-text');
    reportEl.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
    setTimeout(() => {
      reportEl.textContent = data.ai_report || 'Rapor oluşturulamadı.';
    }, 800);

    App.refreshDashboard();
  }
};

/* ══════════════════════════════════════════
   History
══════════════════════════════════════════ */
const History = {
  all: [],

  async load() {
    try {
      const res = await fetch(`${API}/api/history?limit=100`);
      this.all = await res.json();
      this.render(this.all);
    } catch {
      Toast.show('Geçmiş yüklenemedi.', 'error');
    }
  },

  filter() {
    const q     = document.getElementById('history-search').value.toLowerCase();
    const src   = document.getElementById('history-source-filter').value;
    const rows  = this.all.filter(r => {
      const matchQ   = !q || r.image_filename.toLowerCase().includes(q);
      const matchSrc = !src || r.source === src;
      return matchQ && matchSrc;
    });
    this.render(rows);
  },

  render(rows) {
    const tbody = document.getElementById('history-tbody');
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Kayıt bulunamadı.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td><span style="color:var(--text-muted)">#${r.id}</span></td>
        <td>${r.image_filename || '—'}</td>
        <td><span style="color:var(--teal);font-weight:600">${r.total_items}</span></td>
        <td><span style="color:${r.missing_count>0?'var(--rose)':'var(--emerald)'};font-weight:600">${r.missing_count}</span></td>
        <td>${sourceBadge(r.source)}</td>
        <td style="color:var(--text-secondary)">${fmtDate(r.analyzed_at)}</td>
        <td>
          <button class="btn btn-ghost" style="padding:4px 10px;font-size:12px"
            onclick="History.detail(${r.id})">Detay</button>
          <button class="btn btn-danger" style="padding:4px 10px;font-size:12px;margin-left:4px"
            onclick="History.delete(${r.id})">Sil</button>
        </td>
      </tr>
    `).join('');
  },

  detail(id) {
    const r = this.all.find(x => x.id === id);
    if (!r) return;
    const det = Object.entries(r.detected || {})
      .map(([k,v]) => `<span style="color:var(--teal)">${k}</span>: ${v}`).join(', ') || '—';
    const mis = (r.missing || []).join(', ') || 'Yok';
    Modal.open(`Analiz #${r.id} Detayı`, `
      <p><strong>Dosya:</strong> ${r.image_filename}</p>
      <p style="margin-top:8px"><strong>Tespit:</strong> ${det}</p>
      <p style="margin-top:8px"><strong>Eksik:</strong> <span style="color:var(--rose)">${mis}</span></p>
      <p style="margin-top:8px"><strong>Tarih:</strong> ${fmtDate(r.analyzed_at)}</p>
      <p style="margin-top:8px"><strong>Kaynak:</strong> ${r.source}</p>
      <div style="margin-top:16px;padding:14px;background:var(--bg-card2);border-radius:8px;font-size:13px;color:var(--text-secondary);line-height:1.7">
        <strong style="color:var(--text-primary)">🤖 AI Raporu:</strong><br>${r.ai_report || '—'}
      </div>
    `);
  },

  async delete(id) {
    if (!confirm('Bu kaydı silmek istediğinden emin misin?')) return;
    try {
      await fetch(`${API}/api/history/${id}`, { method: 'DELETE' });
      this.all = this.all.filter(r => r.id !== id);
      this.render(this.all);
      Toast.show('Kayıt silindi.', 'info');
      App.refreshDashboard();
    } catch {
      Toast.show('Silinemedi.', 'error');
    }
  }
};

/* ══════════════════════════════════════════
   Products
══════════════════════════════════════════ */
const Products = {
  list: [],

  async load() {
    try {
      const res = await fetch(`${API}/api/products`);
      this.list = await res.json();
      this.render();
    } catch {
      Toast.show('Ürünler yüklenemedi.', 'error');
    }
  },

  render() {
    const container = document.getElementById('product-list');
    if (!this.list.length) {
      container.innerHTML = '<div class="empty-state">Ürün bulunamadı.</div>';
      return;
    }
    container.innerHTML = this.list.map(p => `
      <div class="product-item ${p.active ? '' : 'inactive'}" id="product-${p.id}">
        <div class="product-info">
          <div class="product-name">${p.display_name} <span style="color:var(--text-muted);font-weight:400;font-size:12px">(${p.name})</span></div>
          <div class="product-meta">${p.category}</div>
        </div>
        <span class="product-critical">Kritik: ${p.critical_level}</span>
        <div class="product-actions">
          <button class="btn btn-ghost" style="padding:4px 8px;font-size:12px"
            onclick="Products.toggleActive(${p.id}, ${!p.active})">${p.active ? '⏸' : '▶'}</button>
          <button class="btn btn-danger" style="padding:4px 8px;font-size:12px"
            onclick="Products.delete(${p.id})">✕</button>
        </div>
      </div>
    `).join('');
  },

  async add(e) {
    e.preventDefault();
    const body = {
      name:           document.getElementById('p-name').value.trim().toLowerCase(),
      display_name:   document.getElementById('p-display').value.trim(),
      critical_level: parseInt(document.getElementById('p-critical').value),
      category:       document.getElementById('p-category').value.trim() || 'Genel',
    };
    try {
      const res = await fetch(`${API}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.detail); }
      Toast.show(`"${body.display_name}" eklendi.`, 'success');
      document.getElementById('add-product-form').reset();
      document.getElementById('p-category').value = 'Genel';
      await this.load();
    } catch (err) {
      Toast.show('Hata: ' + err.message, 'error');
    }
  },

  async toggleActive(id, active) {
    try {
      await fetch(`${API}/api/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active })
      });
      await this.load();
    } catch {
      Toast.show('Güncellenemedi.', 'error');
    }
  },

  async delete(id) {
    if (!confirm('Bu ürünü silmek istediğinden emin misin?')) return;
    try {
      await fetch(`${API}/api/products/${id}`, { method: 'DELETE' });
      Toast.show('Ürün silindi.', 'info');
      await this.load();
    } catch {
      Toast.show('Silinemedi.', 'error');
    }
  }
};

/* ══════════════════════════════════════════
   Helpers
══════════════════════════════════════════ */
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('tr-TR', {
    day:'2-digit', month:'2-digit', year:'numeric',
    hour:'2-digit', minute:'2-digit'
  });
}

function sourceBadge(source) {
  if (source === 'camera') return `<span style="color:var(--blue);font-size:11px;font-weight:600">📷 Kamera</span>`;
  return `<span style="color:var(--teal);font-size:11px;font-weight:600">📁 Yükleme</span>`;
}

/* ── Boot ── */
App.init();
Analyze.init();
