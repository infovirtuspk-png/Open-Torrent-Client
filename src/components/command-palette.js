export class CommandPaletteUI {
  constructor(onAction) {
    this.overlay = document.getElementById('cmdPaletteOverlay');
    this.input = document.getElementById('cmdPaletteInput');
    this.list = document.getElementById('cmdPaletteList');
    this.onAction = onAction;

    this.commands = [
      { id: 'add_torrent', label: 'Add .torrent File...', shortcut: 'Ctrl+O', icon: 'file-plus' },
      { id: 'add_magnet', label: 'Add Magnet Link...', shortcut: 'Ctrl+M', icon: 'link' },
      { id: 'pause_all', label: 'Pause All Torrents', shortcut: 'Ctrl+Shift+P', icon: 'pause-circle' },
      { id: 'resume_all', label: 'Resume All Torrents', shortcut: 'Ctrl+Shift+A', icon: 'play-circle' },
      { id: 'toggle_theme', label: 'Toggle Dark / Light Theme', shortcut: '', icon: 'sun' },
      { id: 'open_settings', label: 'Open Settings', shortcut: 'Ctrl+,', icon: 'settings' },
      { id: 'open_file_manager', label: 'Open File Manager', shortcut: '', icon: 'folder' }
    ];

    this.init();
  }

  init() {
    if (!this.overlay || !this.input) return;

    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        this.open();
      } else if (e.key === 'Escape' && this.isOpen()) {
        this.close();
      }
    });

    this.input.addEventListener('input', () => this.render());

    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });
  }

  isOpen() {
    return this.overlay.classList.contains('active');
  }

  open() {
    this.overlay.classList.add('active');
    this.input.value = '';
    this.input.focus();
    this.render();
  }

  close() {
    this.overlay.classList.remove('active');
  }

  render() {
    if (!this.list) return;

    const query = this.input.value.toLowerCase().trim();
    const filtered = this.commands.filter(cmd => cmd.label.toLowerCase().includes(query));

    if (filtered.length === 0) {
      this.list.innerHTML = `
        <div class="p-3 text-center text-muted">No commands match "${query}"</div>
      `;
      return;
    }

    this.list.innerHTML = filtered.map(cmd => `
      <div class="cmd-item" data-id="${cmd.id}">
        <div class="d-flex align-items-center gap-2">
          <i data-lucide="${cmd.icon}" style="width:16px;height:16px;"></i>
          <span>${cmd.label}</span>
        </div>
        <span class="badge bg-dark border border-secondary text-secondary">${cmd.shortcut}</span>
      </div>
    `).join('');

    if (window.lucide) window.lucide.createIcons();

    this.list.querySelectorAll('.cmd-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.getAttribute('data-id');
        this.close();
        if (this.onAction) this.onAction(id);
      });
    });
  }
}
