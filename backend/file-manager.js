const fs = require('fs');
const path = require('path');
const { shell } = require('electron');

class FileManagerService {
  constructor() {
    this.allowedRootPaths = [];
  }

  setAllowedRoots(roots) {
    this.allowedRootPaths = roots.map(r => path.resolve(r));
  }

  addAllowedRoot(rootPath) {
    const resolved = path.resolve(rootPath);
    if (!this.allowedRootPaths.includes(resolved)) {
      this.allowedRootPaths.push(resolved);
    }
  }

  isPathAllowed(targetPath) {
    if (!targetPath) return false;
    const resolved = path.resolve(targetPath);
    
    // If no roots explicitly set yet, default to allowing standard drive letters / home path
    if (this.allowedRootPaths.length === 0) return true;

    return this.allowedRootPaths.some(root => {
      const relative = path.relative(root, resolved);
      return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
    });
  }

  normalizePath(inputPath) {
    return path.normalize(inputPath);
  }

  listDirectory(dirPath) {
    const resolved = path.resolve(dirPath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`Directory does not exist: ${resolved}`);
    }

    const stat = fs.statSync(resolved);
    if (!stat.isDirectory()) {
      throw new Error(`Path is not a directory: ${resolved}`);
    }

    const items = fs.readdirSync(resolved);
    const result = items.map(itemName => {
      const itemPath = path.join(resolved, itemName);
      try {
        const itemStat = fs.statSync(itemPath);
        return {
          name: itemName,
          path: itemPath,
          isDirectory: itemStat.isDirectory(),
          size: itemStat.size,
          modifiedAt: itemStat.mtime.toISOString(),
          extension: itemStat.isDirectory() ? 'folder' : path.extname(itemName).toLowerCase()
        };
      } catch (err) {
        return {
          name: itemName,
          path: itemPath,
          isDirectory: false,
          size: 0,
          modifiedAt: new Date().toISOString(),
          extension: 'error',
          error: err.message
        };
      }
    });

    // Sort folders first, then files
    return result.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  createFolder(targetPath) {
    const resolved = path.resolve(targetPath);
    if (fs.existsSync(resolved)) {
      throw new Error('Folder already exists.');
    }
    fs.mkdirSync(resolved, { recursive: true });
    return resolved;
  }

  renameItem(oldPath, newName) {
    const resolvedOld = path.resolve(oldPath);
    if (!fs.existsSync(resolvedOld)) {
      throw new Error('Target file or directory does not exist.');
    }

    const parentDir = path.dirname(resolvedOld);
    const resolvedNew = path.join(parentDir, newName);

    if (fs.existsSync(resolvedNew)) {
      throw new Error('A file or folder with that name already exists.');
    }

    fs.renameSync(resolvedOld, resolvedNew);
    return resolvedNew;
  }

  deleteItem(targetPath, permanent = false) {
    const resolved = path.resolve(targetPath);
    if (!fs.existsSync(resolved)) return false;

    if (permanent) {
      const stat = fs.statSync(resolved);
      if (stat.isDirectory()) {
        fs.rmSync(resolved, { recursive: true, force: true });
      } else {
        fs.unlinkSync(resolved);
      }
    } else {
      shell.trashItem(resolved);
    }
    return true;
  }

  openItem(targetPath) {
    const resolved = path.resolve(targetPath);
    if (fs.existsSync(resolved)) {
      shell.openPath(resolved);
    }
  }

  showInFolder(targetPath) {
    const resolved = path.resolve(targetPath);
    if (fs.existsSync(resolved)) {
      shell.showItemInFolder(resolved);
    }
  }

  getFreeDiskSpace(targetPath) {
    // Basic drive check for Windows
    try {
      const resolved = path.resolve(targetPath);
      const root = path.parse(resolved).root;
      // Return stats placeholder if platform disk usage check succeeds
      return { root, path: resolved };
    } catch (e) {
      return { error: e.message };
    }
  }
}

module.exports = new FileManagerService();
