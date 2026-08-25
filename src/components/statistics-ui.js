export class StatisticsUI {
  async loadStatistics() {
    const diag = await window.api.getDiagnostics();
    const lifetime = window.api.getLifetimeStats ? await window.api.getLifetimeStats() : null;
    if (!diag) return;

    const elDn = document.getElementById('statLifetimeDn');
    const elUp = document.getElementById('statLifetimeUp');
    const elDays = document.getElementById('statActiveDays');

    if (elDn) elDn.textContent = this.formatBytes(lifetime?.totalDownloaded || 0);
    if (elUp) elUp.textContent = this.formatBytes(lifetime?.totalUploaded || 0);
    if (elDays) elDays.textContent = `${lifetime?.activeDays || 1} Active Day${(lifetime?.activeDays || 1) === 1 ? '' : 's'}`;
  }

  formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0; let val = bytes;
    while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
    return `${val.toFixed(2)} ${units[i]}`;
  }
}
