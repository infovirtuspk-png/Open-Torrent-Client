export class FileManagerUI {
  constructor() {
    this.currentPath = null;
    this.tableBody = document.getElementById('fmTableBody');
    this.pathDisplay = document.getElementById('fmCurrentPath');

    this.initButtons();
  }

  initButtons() {
    const btnRefresh = document.getElementById('btnFmRefresh');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', () => this.loadDirectory(this.currentPath));
    }

    const btnNewFolder = document.getElementById('btnFmNewFolder');
    if (btnNewFolder) {
      btnNewFolder.addEventListener('click', async () => {
        const folderName = prompt('Enter new folder name:');
        if (folderName && folderName.trim()) {
          const newFolderPath = `${this.currentPath}/${folderName.trim()}`;
          const res = await window.api.createFolder(newFolderPath);
          if (res.success) {
            this.loadDirectory(this.currentPath);
          } else {
            alert('Failed to create folder: ' + res.error);
          }
        }
      });
    }
  }

  async loadDirectory(targetPath = null) {
    const res = await window.api.listDirectory(targetPath);
    if (!res.success) {
      alert('Error loading directory: ' + res.error);
      return;
    }

    this.currentPath = res.currentPath;
    if (this.pathDisplay) this.pathDisplay.textContent = this.currentPath;

    if (!this.tableBody) return;

    if (res.items.length === 0) {
      this.tableBody.innerHTML = `
        <tr><td colspan="5" class="text-center text-muted py-4"><em>Empty directory</em></td></tr>
      `;
      return;
    }

    this.tableBody.innerHTML = res.items.map(item => `
      <tr>
        <td>
          <i data-lucide="${item.isDirectory ? 'folder' : 'file'}" style="width:16px;height:16px;margin-right:6px;" class="${item.isDirectory ? 'text-warning' : 'text-info'}"></i>
          <span class="fm-item-name" data-path="${item.path}" data-isdir="${item.isDirectory}" style="cursor:pointer;font-weight:${item.isDirectory ? '600' : 'normal'}">${item.name}</span>
        </td>
        <td>${item.isDirectory ? '-' : this.formatBytes(item.size)}</td>
        <td class="text-uppercase small text-muted">${item.extension}</td>
        <td class="small text-muted">${new Date(item.modifiedAt).toLocaleString()}</td>
        <td>
          <button class="btn btn-sm btn-outline-light btn-fm-open me-1" data-path="${item.path}">Open</button>
          <button class="btn btn-sm btn-outline-danger btn-fm-delete" data-path="${item.path}">Delete</button>
        </td>
      </tr>
    `).join('');

    if (window.lucide) window.lucide.createIcons();

    // Directory navigation
    this.tableBody.querySelectorAll('.fm-item-name').forEach(el => {
      el.addEventListener('click', () => {
        const itemPath = el.getAttribute('data-path');
        const isDir = el.getAttribute('data-isdir') === 'true';
        if (isDir) {
          this.loadDirectory(itemPath);
        } else {
          window.api.openItem(itemPath);
        }
      });
    });

    this.tableBody.querySelectorAll('.btn-fm-open').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const itemPath = e.target.getAttribute('data-path');
        window.api.openItem(itemPath);
      });
    });

    this.tableBody.querySelectorAll('.btn-fm-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const itemPath = e.target.getAttribute('data-path');
        if (confirm(`Permanently delete "${itemPath}"?`)) {
          const deleteRes = await window.api.deleteItem(itemPath, true);
          if (deleteRes.success) {
            this.loadDirectory(this.currentPath);
          }
        }
      });
    });
  }

  formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0; let val = bytes;
    while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
    return `${val.toFixed(2)} ${units[i]}`;
  }
}
