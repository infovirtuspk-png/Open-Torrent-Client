export class HistoryUI {
  constructor() {
    this.tbody = document.getElementById('tblHistoryBody');
    this.btnClear = document.getElementById('btnClearHistory');
    this.init();
  }

  init() {
    if (this.btnClear) {
      this.btnClear.addEventListener('click', async () => {
        if (confirm('Are you sure you want to clear download history?')) {
          await window.api.clearHistory();
          this.loadHistory();
        }
      });
    }
  }

  async loadHistory() {
    const list = await window.api.getHistory();
    if (!this.tbody) return;

    if (!list || list.length === 0) {
      this.tbody.innerHTML = `
        <tr><td colspan="7" class="text-center text-muted py-4"><em>No download history recorded.</em></td></tr>
      `;
      return;
    }

    this.tbody.innerHTML = list.map(item => `
      <tr>
        <td class="font-weight-bold">${item.name}</td>
        <td>${this.formatBytes(item.size)}</td>
        <td>${this.formatBytes(item.downloaded)}</td>
        <td>${this.formatBytes(item.uploaded)}</td>
        <td>${item.ratio || '0.00'}</td>
        <td class="small text-muted">${new Date(item.completed_at).toLocaleString()}</td>
        <td><span class="badge bg-secondary">${item.final_status}</span></td>
      </tr>
    `).join('');
  }

  formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0; let val = bytes;
    while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
    return `${val.toFixed(2)} ${units[i]}`;
  }
}
