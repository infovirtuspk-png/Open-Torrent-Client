export class ContextMenuManager {
  constructor(onAction) {
    this.menuEl = null;
    this.currentHash = null;
    this.onAction = onAction;
    this.createMenuElement();
  }

  createMenuElement() {
    let el = document.getElementById('torrentContextMenu');
    if (!el) {
      el = document.createElement('div');
      el.id = 'torrentContextMenu';
      el.className = 'custom-context-menu';
      document.body.appendChild(el);
    }
    this.menuEl = el;

    document.addEventListener('click', () => this.hide());
    window.addEventListener('blur', () => this.hide());
    window.addEventListener('resize', () => this.hide());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.hide();
    });
  }

  show(x, y, torrent) {
    if (!torrent || !this.menuEl) return;
    this.currentHash = torrent.infoHash;

    const isPaused = torrent.isPaused || torrent.status === 'Paused' || torrent.status === 'Stopped';
    const isDone = torrent.progress >= 1 || torrent.status === 'Completed' || torrent.status === 'Seeding';

    this.menuEl.innerHTML = `
      <div class="menu-item font-weight-bold border-bottom border-secondary py-1 text-info text-truncate" style="max-width: 210px;">
        <i data-lucide="file-text" style="width:13px;height:13px;"></i> ${this.truncate(torrent.name, 26)}
      </div>

      <!-- State-Aware Control -->
      ${isPaused ? `
        <div class="menu-item" data-action="resume">
          <i data-lucide="play" style="width:13px;height:13px;" class="text-success"></i> Resume / Start
        </div>
      ` : `
        <div class="menu-item" data-action="pause">
          <i data-lucide="pause" style="width:13px;height:13px;" class="text-warning"></i> Pause
        </div>
      `}
      <div class="menu-item" data-action="stop">
        <i data-lucide="square" style="width:13px;height:13px;" class="text-danger"></i> Stop
      </div>
      <div class="menu-item" data-action="force_start">
        <i data-lucide="zap" style="width:13px;height:13px;" class="text-warning"></i> Force Start
      </div>

      <div class="menu-divider"></div>

      <!-- Verification & Trackers -->
      <div class="menu-item" data-action="recheck">
        <i data-lucide="refresh-cw" style="width:13px;height:13px;"></i> Force Recheck
      </div>
      <div class="menu-item" data-action="reannounce">
        <i data-lucide="radio" style="width:13px;height:13px;"></i> Force Reannounce
      </div>

      <div class="menu-divider"></div>

      <!-- Files & Clipboard -->
      <div class="menu-item" data-action="open_folder">
        <i data-lucide="folder" style="width:13px;height:13px;" class="text-warning"></i> Open Download Folder
      </div>
      <div class="menu-item" data-action="open_files">
        <i data-lucide="file-text" style="width:13px;height:13px;"></i> Open Files
      </div>
      <div class="menu-item" data-action="copy_magnet">
        <i data-lucide="link" style="width:13px;height:13px;" class="text-info"></i> Copy Magnet Link
      </div>
      <div class="menu-item" data-action="copy_hash">
        <i data-lucide="key" style="width:13px;height:13px;"></i> Copy Info Hash
      </div>

      <div class="menu-divider"></div>

      <!-- Submenu Toggles / Quick Actions -->
      <div class="menu-item has-submenu">
        <span class="d-flex align-items-center gap-2">
          <i data-lucide="sliders" style="width:13px;height:13px;"></i> Priority
        </span>
        <span class="submenu-arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="priority_maximum">Maximum</div>
          <div class="menu-item" data-action="priority_high">High</div>
          <div class="menu-item" data-action="priority_normal">Normal</div>
          <div class="menu-item" data-action="priority_low">Low</div>
        </div>
      </div>

      <div class="menu-item has-submenu">
        <span class="d-flex align-items-center gap-2">
          <i data-lucide="arrow-down" style="width:13px;height:13px;" class="text-info"></i> Speed Limit
        </span>
        <span class="submenu-arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="dn_limit_0">Unlimited</div>
          <div class="menu-item" data-action="dn_limit_100">100 KB/s</div>
          <div class="menu-item" data-action="dn_limit_500">500 KB/s</div>
          <div class="menu-item" data-action="dn_limit_1000">1 MB/s</div>
          <div class="menu-item" data-action="dn_limit_5000">5 MB/s</div>
        </div>
      </div>

      <div class="menu-item has-submenu">
        <span class="d-flex align-items-center gap-2">
          <i data-lucide="arrow-up" style="width:13px;height:13px;" class="text-success"></i> Queue Order
        </span>
        <span class="submenu-arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="move_top">Move to Top</div>
          <div class="menu-item" data-action="move_up">Move Up</div>
          <div class="menu-item" data-action="move_down">Move Down</div>
          <div class="menu-item" data-action="move_bottom">Move to Bottom</div>
        </div>
      </div>

      <div class="menu-divider"></div>

      <!-- Path & Name -->
      <div class="menu-item" data-action="change_location">
        <i data-lucide="map-pin" style="width:13px;height:13px;"></i> Change Download Location
      </div>
      <div class="menu-item" data-action="rename">
        <i data-lucide="edit-3" style="width:13px;height:13px;"></i> Rename Torrent
      </div>

      <div class="menu-divider"></div>

      <!-- Navigation Inspectors -->
      <div class="menu-item" data-action="view_details">
        <i data-lucide="bar-chart-2" style="width:13px;height:13px;"></i> Details
      </div>
      <div class="menu-item" data-action="view_peers">
        <i data-lucide="users" style="width:13px;height:13px;"></i> Peers
      </div>
      <div class="menu-item" data-action="view_trackers">
        <i data-lucide="radio" style="width:13px;height:13px;"></i> Trackers
      </div>
      <div class="menu-item" data-action="view_pieces">
        <i data-lucide="grid" style="width:13px;height:13px;"></i> Pieces Map
      </div>

      <div class="menu-divider"></div>

      <!-- Destructive Actions -->
      <div class="menu-item text-danger" data-action="remove">
        <i data-lucide="trash-2" style="width:13px;height:13px;"></i> Remove Torrent
      </div>
      <div class="menu-item text-danger font-weight-bold" data-action="remove_delete">
        <i data-lucide="skull" style="width:13px;height:13px;"></i> Remove + Delete Files
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    // Position calculation
    this.menuEl.style.display = 'block';
    this.menuEl.style.visibility = 'hidden';

    const menuWidth = 230;
    const submenuWidth = 180;
    const menuHeight = this.menuEl.offsetHeight || 420;

    let posX = x;
    let posY = y;

    // Check right edge for context menu + submenu expansion
    if (x + menuWidth + submenuWidth > window.innerWidth) {
      this.menuEl.classList.add('flip-left');
      if (x + menuWidth > window.innerWidth) {
        posX = Math.max(8, window.innerWidth - menuWidth - 12);
      }
    } else {
      this.menuEl.classList.remove('flip-left');
    }

    // Check bottom edge
    if (y + menuHeight > window.innerHeight) {
      posY = Math.max(8, window.innerHeight - menuHeight - 12);
    }

    this.menuEl.style.left = `${posX}px`;
    this.menuEl.style.top = `${posY}px`;
    this.menuEl.style.visibility = 'visible';
    this.menuEl.classList.add('active');

    // Attach click listeners to action items
    this.menuEl.querySelectorAll('.menu-item[data-action]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = item.getAttribute('data-action');
        this.hide();
        if (this.onAction) this.onAction(action, torrent);
      });
    });
  }

  hide() {
    if (this.menuEl) {
      this.menuEl.classList.remove('active');
      this.menuEl.style.display = 'none';
    }
  }

  truncate(str, len) {
    if (!str) return '';
    return str.length > len ? str.substring(0, len) + '...' : str;
  }
}
