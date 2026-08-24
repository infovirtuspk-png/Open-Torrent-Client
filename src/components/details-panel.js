export class DetailsPanelManager {
  constructor() {
    this.currentHash = null;
    this.activeTab = 'tabOverview';
    this.chart = null;
    this.speedHistory = { labels: [], download: [], upload: [] };
    this.maxChartPoints = 60;
    this.logHistory = new Map(); // infoHash -> string[]
    this.initTabs();
    this.initChart();
  }

  initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const targetTab = btn.getAttribute('data-tab');
        this.activeTab = targetTab;

        const contents = document.querySelectorAll('.tab-content');
        contents.forEach(c => c.classList.remove('active'));

        const targetContent = document.getElementById(targetTab);
        if (targetContent) targetContent.classList.add('active');

        if (this.currentHash) {
          this.loadTorrentDetails(this.currentHash);
        }
      });
    });

    const btnAddTr = document.getElementById('btnInspectorAddTracker');
    if (btnAddTr) {
      btnAddTr.addEventListener('click', async () => {
        if (!this.currentHash) return alert('Please select a torrent first.');
        const url = prompt('Enter Tracker URL (udp:// or https://):', 'udp://tracker.opentrackr.org:1337/announce');
        if (url && url.trim()) {
          const res = await window.api.addTracker(this.currentHash, url.trim());
          if (res.success) {
            alert(`✓ Tracker added successfully: ${url.trim()}`);
            this.loadTorrentDetails(this.currentHash);
          } else {
            alert(`Failed to add tracker: ${res.error}`);
          }
        }
      });
    }

    const btnAddWs = document.getElementById('btnInspectorAddWebSeed');
    if (btnAddWs) {
      btnAddWs.addEventListener('click', async () => {
        if (!this.currentHash) return alert('Please select a torrent first.');
        const url = prompt('Enter WebSeed Mirror URL (http:// or https://):');
        if (url && url.trim()) {
          const res = await window.api.addWebSeed(this.currentHash, url.trim());
          if (res.success) {
            alert(`✓ WebSeed mirror added successfully: ${url.trim()}`);
            this.loadTorrentDetails(this.currentHash);
          } else {
            alert(`Failed to add WebSeed: ${res.error}`);
          }
        }
      });
    }
  }

  initChart() {
    const ctx = document.getElementById('speedChartCanvas');
    if (!ctx) return;

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Download (KB/s)',
            data: [],
            borderColor: '#38bdf8',
            backgroundColor: 'rgba(56, 189, 248, 0.12)',
            fill: true,
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 0
          },
          {
            label: 'Upload (KB/s)',
            data: [],
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.12)',
            fill: true,
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        scales: {
          x: { display: false },
          y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#94a3b8', font: { size: 10 } } }
        },
        plugins: {
          legend: { labels: { color: '#94a3b8', font: { size: 11, weight: '600' } } }
        }
      }
    });
  }

  updateSpeedChart(dnSpeed, upSpeed) {
    if (!this.chart) return;

    const timeLabel = new Date().toLocaleTimeString();
    this.speedHistory.labels.push(timeLabel);
    this.speedHistory.download.push((dnSpeed / 1024).toFixed(1));
    this.speedHistory.upload.push((upSpeed / 1024).toFixed(1));

    if (this.speedHistory.labels.length > this.maxChartPoints) {
      this.speedHistory.labels.shift();
      this.speedHistory.download.shift();
      this.speedHistory.upload.shift();
    }

    this.chart.data.labels = this.speedHistory.labels;
    this.chart.data.datasets[0].data = this.speedHistory.download;
    this.chart.data.datasets[1].data = this.speedHistory.upload;
    this.chart.update('none');
  }

  updateRealtimeOverview(ov) {
    if (!ov) return;
    const setElem = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    setElem('ovName', ov.name || 'Retrieving metadata...');
    setElem('ovHash', ov.infoHash || '-');
    setElem('ovStatus', ov.status || 'Queued');
    setElem('ovProgress', `${((ov.progress || 0) * 100).toFixed(1)}%`);
    setElem('ovSize', this.formatBytes(ov.size));
    setElem('ovDownloaded', this.formatBytes(ov.downloaded));
    setElem('ovUploaded', this.formatBytes(ov.uploaded));
    setElem('ovDnSpeed', this.formatSpeed(ov.downloadSpeed));
    setElem('ovUpSpeed', this.formatSpeed(ov.uploadSpeed));
    setElem('ovEta', this.formatETA(ov.eta));
    setElem('ovSeedsPeers', `${ov.seeds || 0} / ${ov.peers || 0}`);
    setElem('ovRatio', (ov.ratio || 0).toFixed(2));
    if (ov.savePath) setElem('ovSavePath', ov.savePath);
  }

  async loadTorrentDetails(infoHash) {
    this.currentHash = infoHash;
    const setElem = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    if (!infoHash) {
      setElem('ovName', 'No Torrent Selected');
      setElem('ovHash', '-');
      setElem('ovStatus', '-');
      setElem('ovProgress', '0%');
      setElem('ovSize', '0 B');
      setElem('ovDownloaded', '0 B');
      setElem('ovUploaded', '0 B');
      setElem('ovDnSpeed', '0 B/s');
      setElem('ovUpSpeed', '0 B/s');
      setElem('ovEta', '∞');
      setElem('ovSeedsPeers', '0 / 0');
      setElem('ovRatio', '0.00');
      setElem('ovPieces', '0');
      setElem('ovSavePath', '-');

      const fb = document.getElementById('tblFilesBody'); if (fb) fb.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-3"><em>No torrent selected.</em></td></tr>`;
      const pb = document.getElementById('tblPeersBody'); if (pb) pb.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-3"><em>No torrent selected.</em></td></tr>`;
      const tb = document.getElementById('tblTrackersBody'); if (tb) tb.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-3"><em>No torrent selected.</em></td></tr>`;
      const la = document.getElementById('torrentLogsArea'); if (la) la.value = '';
      return;
    }

    const details = await window.api.getTorrentDetails(infoHash);
    if (!details) return;

    const ov = details.overview || {};

    // ── 1. Overview Tab ────────────────────────────────────────────────────────
    setElem('ovName', ov.name || 'Retrieving metadata...');
    setElem('ovHash', ov.infoHash || infoHash);
    setElem('ovStatus', ov.status || 'Queued');
    setElem('ovProgress', `${((ov.progress || 0) * 100).toFixed(1)}%`);
    setElem('ovSize', this.formatBytes(ov.size));
    setElem('ovDownloaded', this.formatBytes(ov.downloaded));
    setElem('ovUploaded', this.formatBytes(ov.uploaded));
    setElem('ovDnSpeed', this.formatSpeed(ov.downloadSpeed));
    setElem('ovUpSpeed', this.formatSpeed(ov.uploadSpeed));
    setElem('ovEta', this.formatETA(ov.eta));
    setElem('ovSeedsPeers', `${ov.seeds || 0} / ${ov.peers || 0}`);
    setElem('ovRatio', (ov.ratio || 0).toFixed(2));
    setElem('ovPieces', details.pieceCount || details.piecesMap?.length || 0);
    setElem('ovSavePath', ov.savePath || '-');

    // ── 2. Files Tab ───────────────────────────────────────────────────────────
    if (this.activeTab === 'tabFiles') {
      const filesBody = document.getElementById('tblFilesBody');
      if (filesBody && details.files) {
        if (details.files.length === 0) {
          filesBody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-3"><em>Fetching file list from metadata...</em></td></tr>`;
        } else {
          filesBody.innerHTML = details.files.map(f => `
            <tr>
              <td class="text-truncate" style="max-width:240px;" title="${f.path}">${f.name}</td>
              <td>${this.formatBytes(f.size)}</td>
              <td>${Math.round((f.progress || 0) * 100)}%</td>
              <td>
                <select class="form-select form-select-sm bg-dark text-light border-secondary select-file-priority" data-file="${f.path}">
                  <option value="normal" ${f.priority === 'normal' || !f.priority ? 'selected' : ''}>Normal</option>
                  <option value="high" ${f.priority === 'high' ? 'selected' : ''}>High</option>
                  <option value="none" ${f.priority === 'none' || f.priority === 'Do Not Download' ? 'selected' : ''}>Do Not Download</option>
                </select>
              </td>
              <td>
                <button class="btn btn-sm btn-outline-info btn-open-file" data-path="${f.path}">
                  <i data-lucide="external-link" style="width:12px;height:12px;"></i> Open
                </button>
              </td>
            </tr>
          `).join('');

          filesBody.querySelectorAll('.select-file-priority').forEach(sel => {
            sel.addEventListener('change', (e) => {
              const fileP = e.target.getAttribute('data-file');
              window.api.setFilePriority(infoHash, fileP, e.target.value);
            });
          });

          filesBody.querySelectorAll('.btn-open-file').forEach(btn => {
            btn.addEventListener('click', (e) => {
              const fileP = e.target.closest('button').getAttribute('data-path');
              window.api.openItem(fileP);
            });
          });
        }
      }
    }

    // ── 3. Peers Tab ───────────────────────────────────────────────────────────
    if (this.activeTab === 'tabPeers') {
      const peersBody = document.getElementById('tblPeersBody');
      if (peersBody && details.peers) {
        if (details.peers.length === 0) {
          peersBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-3"><em>Connecting to DHT swarm and tracker peers...</em></td></tr>`;
        } else {
          peersBody.innerHTML = details.peers.map(p => `
            <tr>
              <td class="font-monospace">${p.ip}</td>
              <td>${p.port}</td>
              <td>${p.client}</td>
              <td class="text-info fw-bold">${this.formatSpeed(p.downloadSpeed)}</td>
              <td class="text-success fw-bold">${this.formatSpeed(p.uploadSpeed)}</td>
              <td>${Math.round((p.progress || 0) * 100)}%</td>
            </tr>
          `).join('');
        }
      }
    }

    // ── 4. Trackers Tab ────────────────────────────────────────────────────────
    if (this.activeTab === 'tabTrackers') {
      const trackersBody = document.getElementById('tblTrackersBody');
      if (trackersBody && details.trackers) {
        trackersBody.innerHTML = details.trackers.map(tr => `
          <tr>
            <td class="text-truncate font-monospace small" style="max-width:280px;" title="${tr.url}">${tr.url}</td>
            <td><span class="badge ${tr.status === 'Working' ? 'bg-success' : 'bg-warning'}">${tr.status}</span></td>
            <td>${tr.seeders}</td>
            <td>${tr.leechers}</td>
            <td class="text-muted small">${tr.responseTime}</td>
          </tr>
        `).join('');
      }
    }

    // ── 5. Pieces Map Tab Canvas Grid ──────────────────────────────────────────
    if (this.activeTab === 'tabPieces' && details.piecesMap) {
      this.drawPiecesCanvas(details.piecesMap);
      const pText = document.getElementById('piecesStatusText');
      const completed = details.piecesMap.filter(p => p === 'completed').length;
      if (pText) pText.textContent = `Completed: ${completed} / ${details.piecesMap.length} pieces (${((completed / details.piecesMap.length) * 100).toFixed(1)}%)`;
    }

    // ── 6. Logs Tab ────────────────────────────────────────────────────────────
    if (this.activeTab === 'tabLogs') {
      const logsArea = document.getElementById('torrentLogsArea');
      if (logsArea) {
        const time = new Date().toLocaleTimeString();
        if (!this.logHistory.has(infoHash)) {
          this.logHistory.set(infoHash, [
            `[${time}] [INFO] Torrent initialized: ${ov.name}`,
            `[${time}] [INFO] Info Hash: ${ov.infoHash}`,
            `[${time}] [INFO] Save Path: ${ov.savePath}`,
            `[${time}] [INFO] DHT Swarm: Connected`
          ]);
        }
        const logs = this.logHistory.get(infoHash);
        // Append live updates if speed > 0
        if ((ov.downloadSpeed || 0) > 0 || (ov.uploadSpeed || 0) > 0) {
          const lastLog = logs[logs.length - 1];
          const newEntry = `[${time}] [STATS] Down: ${this.formatSpeed(ov.downloadSpeed)} | Up: ${this.formatSpeed(ov.uploadSpeed)} | Progress: ${((ov.progress || 0) * 100).toFixed(1)}%`;
          if (lastLog !== newEntry && logs.length < 200) {
            logs.push(newEntry);
          }
        }
        logsArea.value = logs.join('\n');
        logsArea.scrollTop = logsArea.scrollHeight;
      }
    }

    if (window.lucide) window.lucide.createIcons();
  }

  drawPiecesCanvas(piecesMap) {
    const canvas = document.getElementById('piecesCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.clientWidth || 600;
    const height = canvas.clientHeight || 180;
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    const cols = 40;
    const pieceWidth = Math.max(4, Math.floor((width - 10) / cols));
    const pieceHeight = 12;
    const padding = 2;

    for (let i = 0; i < piecesMap.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = 5 + col * (pieceWidth + padding);
      const y = 5 + row * (pieceHeight + padding);

      if (y + pieceHeight > height) break;

      const state = piecesMap[i];
      if (state === 'completed') ctx.fillStyle = '#10b981'; // Green
      else if (state === 'downloading') ctx.fillStyle = '#38bdf8'; // Blue
      else ctx.fillStyle = '#334155'; // Dark Slate

      ctx.fillRect(x, y, pieceWidth, pieceHeight);
    }
  }

  refreshDetails(infoHash) {
    if (infoHash) this.loadTorrentDetails(infoHash);
  }

  formatSpeed(bps) {
    if (!bps || bps <= 0) return '0 B/s';
    const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    let i = 0; let val = bps;
    while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
    return `${val.toFixed(1)} ${units[i]}`;
  }

  formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0; let val = bytes;
    while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
    return `${val.toFixed(2)} ${units[i]}`;
  }

  formatETA(seconds) {
    if (seconds === null || seconds === undefined || seconds < 0 || !isFinite(seconds)) return '∞';
    if (seconds === 0) return 'Done';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m`;
    return `${seconds}s`;
  }
}
