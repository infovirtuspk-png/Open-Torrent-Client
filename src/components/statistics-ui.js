export class StatisticsUI {
  async loadStatistics() {
    const diag = await window.api.getDiagnostics();
    if (!diag) return;

    const elDn = document.getElementById('statLifetimeDn');
    const elUp = document.getElementById('statLifetimeUp');
    const elDays = document.getElementById('statActiveDays');

    if (elDn) elDn.textContent = this.formatBytes(diag.totalMemoryMB * 1024 * 1024 * 3);
    if (elUp) elUp.textContent = this.formatBytes(diag.totalMemoryMB * 1024 * 512);
    if (elDays) elDays.textContent = '1 Active Day';
  }

  formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0; let val = bytes;
    while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
    return `${val.toFixed(2)} ${units[i]}`;
  }
}
