import { ContextMenuManager } from './context-menu.js';

export class TorrentTableManager {
  constructor(onSelectTorrent, onContextMenuAction) {
    this.torrents = [];
    this.selectedInfoHash = null;
    this.currentFilter = 'all';
    this.searchQuery = '';
    this.sortColumn = 'name';
    this.sortAscending = true;
    this.onSelectTorrent = onSelectTorrent;
    this.onContextMenuAction = onContextMenuAction;

    this.tbody = document.getElementById('torrentTableBody');
    this.contextMenu = new ContextMenuManager((action, torrent) => {
      if (this.onContextMenuAction) {
        this.onContextMenuAction(action, torrent);
      }
    });

    this.initSortHeaders();
  }

  initSortHeaders() {
    const headers = document.querySelectorAll('#torrentTable th[data-sort]');
    headers.forEach(th => {
      th.addEventListener('click', () => {
        const col = th.getAttribute('data-sort');
        if (this.sortColumn === col) {
          this.sortAscending = !this.sortAscending;
        } else {
          this.sortColumn = col;
          this.sortAscending = true;
        }
        this.render();
      });
    });
  }

  setTorrents(torrents) {
    this.torrents = torrents || [];

    // Ensure selectedInfoHash exists in active torrents, or fallback to first torrent / null
    if (this.selectedInfoHash) {
      const exists = this.torrents.some(t => t.infoHash === this.selectedInfoHash);
      if (!exists) {
        this.selectedInfoHash = this.torrents.length > 0 ? this.torrents[0].infoHash : null;
      }
    } else if (this.torrents.length > 0) {
      this.selectedInfoHash = this.torrents[0].infoHash;
    }

    this.render();
  }

  setFilter(filter) {
    this.currentFilter = filter;
    this.render();
  }

  setSearchQuery(query) {
    this.searchQuery = (query || '').toLowerCase().trim();
    this.render();
  }

  formatSpeed(bytesPerSec) {
    if (!bytesPerSec || bytesPerSec <= 0) return '0 B/s';
    const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    let i = 0;
    let val = bytesPerSec;
    while (val >= 1024 && i < units.length - 1) {
      val /= 1024;
      i++;
    }
    return `${val.toFixed(1)} ${units[i]}`;
  }

  formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    let val = bytes;
    while (val >= 1024 && i < units.length - 1) {
      val /= 1024;
      i++;
    }
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

  formatDate(timestamp) {
    if (!timestamp) return 'Today';
    const num = Number(timestamp);
    if (isNaN(num) || num <= 0) return 'Today';
    const d = new Date(num);
    if (isNaN(d.getTime())) return 'Today';
    return d.toLocaleDateString();
  }

  render() {
    if (!this.tbody) return;

    let filtered = this.torrents.filter(t => {
      if (this.currentFilter === 'downloading' && !t.status.startsWith('Downloading')) return false;
      if (this.currentFilter === 'seeding' && t.status !== 'Seeding') return false;
      if (this.currentFilter === 'completed' && t.progress < 1 && t.status !== 'Completed') return false;
      if (this.currentFilter === 'paused' && !t.isPaused && t.status !== 'Paused' && t.status !== 'Stopped') return false;
      if (this.currentFilter === 'queued' && t.status !== 'Queued') return false;
      if (this.currentFilter === 'error' && t.status !== 'Error') return false;

      if (this.searchQuery && !t.name.toLowerCase().includes(this.searchQuery)) return false;

      return true;
    });

    filtered.sort((a, b) => {
      let valA = a[this.sortColumn];
      let valB = b[this.sortColumn];

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return this.sortAscending ? -1 : 1;
      if (valA > valB) return this.sortAscending ? 1 : -1;
      return 0;
    });

    if (filtered.length === 0) {
      this.tbody.innerHTML = `
        <tr class="no-torrents-row">
          <td colspan="11" class="text-center py-4 text-muted">
            <em>No torrents match the current filter/search.</em>
          </td>
        </tr>
      `;
      return;
    }

    const placeholder = this.tbody.querySelector('.no-torrents-row');
    if (placeholder) placeholder.remove();

    const existingRowMap = new Map();
    Array.from(this.tbody.querySelectorAll('tr[data-hash]')).forEach(r => {
      existingRowMap.set(r.getAttribute('data-hash'), r);
    });

    const activeHashes = new Set(filtered.map(t => t.infoHash));

    // Remove deleted/unmatched rows
    existingRowMap.forEach((row, hash) => {
      if (!activeHashes.has(hash)) {
        row.remove();
      }
    });

    // Create or update active rows smoothly
    filtered.forEach((t, index) => {
      const isSelected = t.infoHash === this.selectedInfoHash;
      const pct = (t.progress || 0) * 100;
      const pctStr = pct.toFixed(1);
      const isDone = pct >= 100 || t.status === 'Completed' || t.status === 'Seeding';
      const isPaused = t.isPaused || t.status === 'Paused' || t.status === 'Stopped';

      let fillClass = 'downloading';
      if (isDone) fillClass = 'completed';
      else if (isPaused) fillClass = 'paused';

      let rowEl = existingRowMap.get(t.infoHash);

      if (!rowEl) {
        rowEl = document.createElement('tr');
        rowEl.setAttribute('data-hash', t.infoHash);
        rowEl.className = isSelected ? 'selected' : '';
        rowEl.innerHTML = this._createRowInnerHTML(t, pctStr, isDone, isPaused, fillClass);
        this.tbody.appendChild(rowEl);
        this._bindRowEvents(rowEl, t);
        if (window.lucide) window.lucide.createIcons({ targets: [rowEl] });
      } else {
        if ((rowEl.className.includes('selected')) !== isSelected) {
          rowEl.className = isSelected ? 'selected' : '';
        }
        this._updateRowInner(rowEl, t, pctStr, isDone, isPaused, fillClass);
      }

      if (this.tbody.children[index] !== rowEl) {
        this.tbody.insertBefore(rowEl, this.tbody.children[index] || null);
      }
    });
  }

  _createRowInnerHTML(t, pctStr, isDone, isPaused, fillClass) {
    const statusBadge = `<span class="badge-status badge-${t.status.toLowerCase().replace(/[^a-z]/g, '')}">${t.status}</span>`;
    return `
      <td class="font-weight-bold" title="${t.name}">
        <div class="d-flex align-items-center">
          <div class="row-quick-actions">
            <button class="btn-row-action btn-quick-toggle" title="${isPaused ? 'Resume' : 'Pause'}">
              <i data-lucide="${isPaused ? 'play' : 'pause'}" style="width:12px;height:12px;"></i>
            </button>
            <button class="btn-row-action btn-quick-folder" title="Open Folder">
              <i data-lucide="folder" style="width:12px;height:12px;"></i>
            </button>
            <button class="btn-row-action btn-quick-menu" title="Context Menu">
              <i data-lucide="more-vertical" style="width:12px;height:12px;"></i>
            </button>
          </div>
          <span class="text-truncate torrent-display-name" style="max-width:280px;">${t.name}</span>
        </div>
      </td>
      <td class="cell-status">${statusBadge}</td>
      <td>
        <div class="progress-cell-container">
          <div class="progress-text-row">
            <span class="font-weight-bold pct-val" style="color: #f8fafc;">${pctStr}%</span>
            <span class="tbl-progress-text small" style="color: #cbd5e1; font-weight: 500;">${this.formatBytes(t.downloaded)} / ${this.formatBytes(t.size)}</span>
          </div>
          <div class="tbl-progress-bar">
            <div class="tbl-progress-fill ${fillClass}" style="width: ${Math.max(parseFloat(pctStr), 1)}%"></div>
          </div>
        </div>
      </td>
      <td style="color: #f8fafc; font-weight: 500;" class="cell-size">${this.formatBytes(t.size)}</td>
      <td class="text-info font-weight-bold cell-dnspeed" style="color: #38bdf8 !important;">${this.formatSpeed(t.downloadSpeed)}</td>
      <td class="text-success font-weight-bold cell-upspeed" style="color: #34d399 !important;">${this.formatSpeed(t.uploadSpeed)}</td>
      <td style="color: #cbd5e1;" class="cell-eta">${isDone ? 'Done' : this.formatETA(t.eta)}</td>
      <td style="color: #f8fafc;" class="cell-seeds">${t.seeds || 0}</td>
      <td style="color: #f8fafc;" class="cell-peers">${t.peers || 0}</td>
      <td style="color: #f8fafc;" class="cell-ratio">${t.ratio || '0.00'}</td>
      <td class="small cell-date" style="color: #cbd5e1; font-weight: 500;">${this.formatDate(t.addedAt)}</td>
    `;
  }

  _updateRowInner(rowEl, t, pctStr, isDone, isPaused, fillClass) {
    const badge = rowEl.querySelector('.cell-status .badge-status');
    if (badge) {
      badge.className = `badge-status badge-${t.status.toLowerCase().replace(/[^a-z]/g, '')}`;
      badge.textContent = t.status;
    }

    const pctVal = rowEl.querySelector('.pct-val');
    if (pctVal) pctVal.textContent = `${pctStr}%`;

    const progText = rowEl.querySelector('.tbl-progress-text');
    if (progText) progText.textContent = `${this.formatBytes(t.downloaded)} / ${this.formatBytes(t.size)}`;

    const fillBar = rowEl.querySelector('.tbl-progress-fill');
    if (fillBar) {
      fillBar.className = `tbl-progress-fill ${fillClass}`;
      fillBar.style.width = `${Math.max(parseFloat(pctStr), 1)}%`;
    }

    const dnCell = rowEl.querySelector('.cell-dnspeed');
    if (dnCell) dnCell.textContent = this.formatSpeed(t.downloadSpeed);

    const upCell = rowEl.querySelector('.cell-upspeed');
    if (upCell) upCell.textContent = this.formatSpeed(t.uploadSpeed);

    const etaCell = rowEl.querySelector('.cell-eta');
    if (etaCell) etaCell.textContent = isDone ? 'Done' : this.formatETA(t.eta);

    const seedsCell = rowEl.querySelector('.cell-seeds');
    if (seedsCell) seedsCell.textContent = t.seeds || 0;

    const peersCell = rowEl.querySelector('.cell-peers');
    if (peersCell) peersCell.textContent = t.peers || 0;

    const ratioCell = rowEl.querySelector('.cell-ratio');
    if (ratioCell) ratioCell.textContent = t.ratio || '0.00';
  }

  _bindRowEvents(rowEl, initialTorrent) {
    const hash = rowEl.getAttribute('data-hash');

    rowEl.addEventListener('click', () => {
      if (this.selectedInfoHash !== hash) {
        this.selectedInfoHash = hash;
        this.render();
        if (this.onSelectTorrent) this.onSelectTorrent(hash);
      }
    });

    rowEl.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const currentTorrent = this.torrents.find(t => t.infoHash === hash) || initialTorrent;
      this.selectedInfoHash = hash;
      this.render();
      if (this.onSelectTorrent) this.onSelectTorrent(hash);
      this.contextMenu.show(e.clientX, e.clientY, currentTorrent);
    });

    const btnToggle = rowEl.querySelector('.btn-quick-toggle');
    if (btnToggle) {
      btnToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const currentTorrent = this.torrents.find(t => t.infoHash === hash) || initialTorrent;
        const action = (currentTorrent.isPaused || currentTorrent.status === 'Paused' || currentTorrent.status === 'Stopped') ? 'resume' : 'pause';
        if (this.onContextMenuAction) this.onContextMenuAction(action, currentTorrent);
      });
    }

    const btnFolder = rowEl.querySelector('.btn-quick-folder');
    if (btnFolder) {
      btnFolder.addEventListener('click', (e) => {
        e.stopPropagation();
        const currentTorrent = this.torrents.find(t => t.infoHash === hash) || initialTorrent;
        if (this.onContextMenuAction) this.onContextMenuAction('open_folder', currentTorrent);
      });
    }

    const btnMenu = rowEl.querySelector('.btn-quick-menu');
    if (btnMenu) {
      btnMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        const currentTorrent = this.torrents.find(t => t.infoHash === hash) || initialTorrent;
        const rect = btnMenu.getBoundingClientRect();
        this.contextMenu.show(rect.left, rect.bottom, currentTorrent);
      });
    }
  }

  getSelectedHash() {
    return this.selectedInfoHash;
  }
}
