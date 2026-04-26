/* ═══════════════════════════════════════════
   charts.js — Chart.js visualizations
   ═══════════════════════════════════════════ */

const Charts = (() => {
  let trendChart = null;
  let missingChart = null;

  const DEFAULTS = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: '#8b9bb4', font: { size: 12, family: 'Inter' }, boxWidth: 12 }
      }
    },
    scales: {
      x: {
        ticks: { color: '#8b9bb4', font: { size: 11 } },
        grid:  { color: 'rgba(255,255,255,0.04)' }
      },
      y: {
        ticks: { color: '#8b9bb4', font: { size: 11 } },
        grid:  { color: 'rgba(255,255,255,0.04)' },
        beginAtZero: true
      }
    }
  };

  function renderTrend(dailyData) {
    const canvas = document.getElementById('trendChart');
    if (!canvas) return;

    const labels   = Object.keys(dailyData);
    const analyses = labels.map(d => dailyData[d].analyses);
    const missing  = labels.map(d => dailyData[d].missing);
    const items    = labels.map(d => dailyData[d].items);

    if (trendChart) trendChart.destroy();

    trendChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Analiz Sayısı',
            data: analyses,
            borderColor: '#00d4aa',
            backgroundColor: 'rgba(0,212,170,0.08)',
            tension: 0.4,
            fill: true,
            pointBackgroundColor: '#00d4aa',
            pointRadius: 4,
          },
          {
            label: 'Eksik Ürün',
            data: missing,
            borderColor: '#f43f5e',
            backgroundColor: 'rgba(244,63,94,0.08)',
            tension: 0.4,
            fill: true,
            pointBackgroundColor: '#f43f5e',
            pointRadius: 4,
          },
          {
            label: 'Tespit Edilen',
            data: items,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59,130,246,0.08)',
            tension: 0.4,
            fill: true,
            pointBackgroundColor: '#3b82f6',
            pointRadius: 4,
          }
        ]
      },
      options: {
        ...DEFAULTS,
        plugins: {
          ...DEFAULTS.plugins,
          tooltip: {
            backgroundColor: '#111827',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            titleColor: '#f0f4ff',
            bodyColor: '#8b9bb4',
          }
        }
      }
    });
  }

  function renderMissing(freqData) {
    const canvas = document.getElementById('missingChart');
    if (!canvas) return;

    const sorted  = Object.entries(freqData || {}).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const labels  = sorted.map(([k]) => k);
    const values  = sorted.map(([, v]) => v);

    const colors = [
      '#f43f5e','#f59e0b','#8b5cf6','#3b82f6',
      '#10b981','#00d4aa','#ec4899','#14b8a6'
    ];

    if (missingChart) missingChart.destroy();

    if (!sorted.length) {
      canvas.parentElement.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:40px">Henüz veri yok</p>';
      return;
    }

    missingChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors.map(c => c + '33'),
          borderColor: colors,
          borderWidth: 2,
          hoverOffset: 6,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#8b9bb4', font: { size: 11 }, boxWidth: 10, padding: 12 }
          },
          tooltip: {
            backgroundColor: '#111827',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            titleColor: '#f0f4ff',
            bodyColor: '#8b9bb4',
          }
        }
      }
    });
  }

  return { renderTrend, renderMissing };
})();
