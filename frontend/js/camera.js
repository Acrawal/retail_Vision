/* ═══════════════════════════════════════════
   camera.js — Live camera stream
   ═══════════════════════════════════════════ */

const Camera = {
  active: false,
  pollInterval: null,

  async start() {
    const source = document.getElementById('cam-source').value.trim() || '0';

    const fd = new FormData();
    fd.append('source', source);

    try {
      const res = await fetch(`${API}/api/camera/start`, { method: 'POST', body: fd });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Kamera açılamadı');
      }
      this.active = true;
      this._setUI(true);

      // Show MJPEG stream
      const feed = document.getElementById('camera-feed');
      feed.src = `${API}/api/camera/stream?t=${Date.now()}`;
      feed.style.display = 'block';
      document.getElementById('camera-placeholder').style.display = 'none';

      // Poll FPS
      this.pollInterval = setInterval(() => this._pollStatus(), 2000);
      Toast.show('📷 Kamera başlatıldı.', 'success');
    } catch (e) {
      Toast.show('Kamera Hatası: ' + e.message, 'error');
    }
  },

  async stop() {
    try {
      await fetch(`${API}/api/camera/stop`, { method: 'POST' });
    } catch { /* ignore */ }

    this.active = false;
    clearInterval(this.pollInterval);
    this._setUI(false);

    const feed = document.getElementById('camera-feed');
    feed.src = '';
    feed.style.display = 'none';
    document.getElementById('camera-placeholder').style.display = 'flex';
    Toast.show('Kamera durduruldu.', 'info');
  },

  async analyzeFrame() {
    const btn = document.getElementById('cam-analyze-btn');
    btn.disabled = true;
    btn.textContent = '⏳ Analiz…';

    try {
      const res = await fetch(`${API}/api/analyze/camera`, { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      this._renderCameraResult(data);
      Toast.show(`📸 Kare analiz edildi — ${data.total_items} ürün.`, 'success');
      App.refreshDashboard();
    } catch (e) {
      Toast.show('Analiz hatası: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '📸 Anlık Analiz';
    }
  },

  _renderCameraResult(data) {
    const card = document.getElementById('cam-result-card');
    card.style.display = '';

    const grid = document.getElementById('cam-stock-grid');
    grid.innerHTML = (data.items || []).map(item => {
      const cls = item.status.toLowerCase();
      return `
        <div class="stock-item ${cls}">
          <span class="stock-name">${item.display_name}</span>
          <span class="stock-count ${cls}">${item.count}</span>
          <span class="stock-critical-line">Kritik: ${item.critical_level}</span>
          <span class="stock-badge ${cls}">${item.status}</span>
        </div>`;
    }).join('') || '<p class="empty-state">Ürün tespit edilemedi.</p>';

    const report = document.getElementById('cam-ai-report');
    report.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
    setTimeout(() => { report.textContent = data.ai_report || ''; }, 800);
  },

  async _pollStatus() {
    try {
      const res = await fetch(`${API}/api/camera/status`);
      const data = await res.json();
      document.getElementById('fps-badge').textContent = `${data.fps} FPS`;
      if (!data.active) this.stop();
    } catch { /* ignore */ }
  },

  _setUI(active) {
    document.getElementById('cam-start-btn').disabled  = active;
    document.getElementById('cam-stop-btn').disabled   = !active;
    document.getElementById('cam-analyze-btn').disabled = !active;
    const dot = document.getElementById('cam-dot');
    const txt = document.getElementById('cam-status-text');
    if (active) {
      dot.className = 'cam-dot active';
      txt.textContent = 'Aktif';
    } else {
      dot.className = 'cam-dot';
      txt.textContent = 'Kapalı';
      document.getElementById('fps-badge').textContent = '— FPS';
    }
  }
};
