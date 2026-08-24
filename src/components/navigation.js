export class NavigationManager {
  constructor(onSectionChange, onFilterChange) {
    this.currentView = 'torrents';
    this.currentFilter = 'all';
    this.onSectionChange = onSectionChange;
    this.onFilterChange = onFilterChange;
    this.init();
  }

  init() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        navItems.forEach(n => n.classList.remove('active'));
        item.classList.add('active');

        const view = item.getAttribute('data-view');
        const filter = item.getAttribute('data-filter');

        this.switchView(view);

        if (filter && this.onFilterChange) {
          this.currentFilter = filter;
          this.onFilterChange(filter);
        }
      });
    });

    const btnSidebar = document.getElementById('btnSidebarToggle');
    const sidebar = document.querySelector('.app-sidebar');
    if (btnSidebar && sidebar) {
      btnSidebar.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
      });

      document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
          e.preventDefault();
          sidebar.classList.toggle('collapsed');
        }
      });
    }
  }

  switchView(viewName) {
    this.currentView = viewName;
    const views = document.querySelectorAll('.view-panel');
    views.forEach(v => v.classList.remove('active'));

    const targetView = document.getElementById(`view${viewName.charAt(0).toUpperCase() + viewName.slice(1)}`);
    if (targetView) {
      targetView.classList.add('active');
    }

    if (this.onSectionChange) {
      this.onSectionChange(viewName);
    }
  }

  updateCounters(counters) {
    if (!counters) return;
    const setBadge = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val || 0;
    };

    setBadge('badgeAll', counters.all);
    setBadge('badgeDownloading', counters.downloading);
    setBadge('badgeSeeding', counters.seeding);
    setBadge('badgeCompleted', counters.completed);
    setBadge('badgePaused', counters.paused);
    setBadge('badgeQueued', counters.queued);
    setBadge('badgeError', counters.error);
  }
}
