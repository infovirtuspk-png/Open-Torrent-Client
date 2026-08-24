export class DialogsManager {
  constructor(onAddMagnetSubmitted, onAddTorrentSubmitted, onOpenTorrentSelected) {
    this.modalAddMagnet = document.getElementById('modalAddMagnet');
    this.inputMagnetUri = document.getElementById('inputMagnetUri');
    this.inputMagnetSavePath = document.getElementById('inputMagnetSavePath');

    this.modalDuplicate = document.getElementById('modalDuplicateTorrent');
    this.currentDupData = null;

    this.onAddMagnetSubmitted = onAddMagnetSubmitted;
    this.onAddTorrentSubmitted = onAddTorrentSubmitted;
    this.onOpenTorrentSelected = onOpenTorrentSelected;

    this.promptQueue = [];
    this.isShowingPrompt = false;

    this.initAddMagnetModal();
    this.initDuplicateModal();
  }

  initAddMagnetModal() {
    const btnClose = document.getElementById('btnCloseAddMagnetModal');
    const btnCancel = document.getElementById('btnCancelAddMagnet');
    const btnSubmit = document.getElementById('btnSubmitAddMagnet');
    const btnBrowse = document.getElementById('btnBrowseMagnetSavePath');

    if (btnClose) btnClose.addEventListener('click', () => this.closeAddMagnet());
    if (btnCancel) btnCancel.addEventListener('click', () => this.closeAddMagnet());

    if (btnBrowse) {
      btnBrowse.addEventListener('click', async () => {
        const folder = await window.api.selectFolderDialog();
        if (folder) {
          this.inputMagnetSavePath.value = folder;
        }
      });
    }

    if (btnSubmit) {
      btnSubmit.addEventListener('click', async () => {
        const uri = this.inputMagnetUri.value.trim();
        const savePath = this.inputMagnetSavePath.value.trim();

        if (!uri) {
          alert('Please enter a valid Magnet URI.');
          return;
        }

        if (this.onAddMagnetSubmitted) {
          await this.onAddMagnetSubmitted(uri, savePath);
        }
        this.closeAddMagnet();
      });
    }
  }

  initDuplicateModal() {
    const btnClose = document.getElementById('btnCloseDupModal');
    const btnCancel = document.getElementById('btnDupCancel');
    const btnAddAnyway = document.getElementById('btnDupAddAnyway');
    const btnDupOpen = document.getElementById('btnDupOpen');

    if (btnClose) btnClose.addEventListener('click', () => this.closeDuplicateModal());
    if (btnCancel) btnCancel.addEventListener('click', () => this.closeDuplicateModal());

    if (btnAddAnyway) {
      btnAddAnyway.addEventListener('click', async () => {
        if (this.currentDupData && this.currentDupData.rawUri && this.onAddMagnetSubmitted) {
          await this.onAddMagnetSubmitted(this.currentDupData.rawUri, this.inputMagnetSavePath.value);
        }
        this.closeDuplicateModal();
      });
    }

    if (btnDupOpen) {
      btnDupOpen.addEventListener('click', () => {
        if (this.currentDupData && this.currentDupData.infoHash && this.onOpenTorrentSelected) {
          this.onOpenTorrentSelected(this.currentDupData.infoHash);
        }
        this.closeDuplicateModal();
      });
    }
  }

  async openAddMagnet(presetData = '') {
    const data = typeof presetData === 'string' ? { rawUri: presetData } : presetData;

    if (this.isShowingPrompt) {
      this.promptQueue.push(data);
      return;
    }

    this.isShowingPrompt = true;

    if (this.modalAddMagnet) {
      this.modalAddMagnet.classList.add('active');
      this.inputMagnetUri.value = data.rawUri || '';

      // Populate preview details
      const nameEl = document.getElementById('previewMagnetName');
      const hashEl = document.getElementById('previewMagnetHash');
      const trEl = document.getElementById('previewMagnetTrackers');

      if (nameEl) nameEl.textContent = data.name || (data.rawUri ? 'Magnet Torrent' : 'New Torrent');
      if (hashEl) hashEl.textContent = data.infoHash ? (data.infoHash.substring(0, 16) + '...') : '-';
      if (trEl) trEl.textContent = `Trackers: ${data.trackerCount || (data.trackers ? data.trackers.length : 1)}`;

      // Default save path
      const settings = await window.api.getSettings();
      if (settings && settings.defaultDownloadPath) {
        this.inputMagnetSavePath.value = settings.defaultDownloadPath;
      }

      // Animate metadata progress steps
      this.animateMetadataSteps();
    }
  }

  animateMetadataSteps() {
    const sConn = document.getElementById('stepConn');
    const sPeers = document.getElementById('stepPeers');
    const sReq = document.getElementById('stepReq');
    const sDone = document.getElementById('stepDone');
    const badge = document.getElementById('previewMetadataBadge');

    if (!sConn) return;

    // Reset steps
    [sConn, sPeers, sReq, sDone].forEach(el => { if(el) el.className = 'text-muted small'; });
    if (badge) { badge.className = 'badge bg-primary px-2'; badge.textContent = 'Connecting...'; }

    sConn.className = 'text-info font-weight-bold small';

    setTimeout(() => {
      if (sPeers) sPeers.className = 'text-info font-weight-bold small';
      if (badge) badge.textContent = 'Finding peers...';
    }, 600);

    setTimeout(() => {
      if (sReq) sReq.className = 'text-info font-weight-bold small';
      if (badge) badge.textContent = 'Requesting metadata...';
    }, 1200);

    setTimeout(() => {
      if (sDone) sDone.className = 'text-success font-weight-bold small';
      if (badge) { badge.className = 'badge bg-success px-2'; badge.textContent = 'Metadata Ready'; }
    }, 1800);
  }

  closeAddMagnet() {
    if (this.modalAddMagnet) {
      this.modalAddMagnet.classList.remove('active');
    }
    this.isShowingPrompt = false;

    // Process next queued prompt if any
    if (this.promptQueue.length > 0) {
      const next = this.promptQueue.shift();
      setTimeout(() => this.openAddMagnet(next), 200);
    }
  }

  showDuplicateModal(dupData) {
    if (!this.modalDuplicate) return;

    this.currentDupData = dupData;

    document.getElementById('dupTorrentName').textContent = dupData.name || 'Torrent';
    document.getElementById('dupTorrentHash').textContent = `Info Hash: ${dupData.infoHash}`;
    document.getElementById('dupTorrentStatus').textContent = dupData.status || 'Active';

    this.modalDuplicate.classList.add('active');
  }

  closeDuplicateModal() {
    if (this.modalDuplicate) {
      this.modalDuplicate.classList.remove('active');
    }
  }

  async openAddTorrentFile(presetFilePath = null) {
    const filePath = presetFilePath || await window.api.selectFileDialog();
    if (filePath) {
      const folder = await window.api.selectFolderDialog();
      if (this.onAddTorrentSubmitted) {
        await this.onAddTorrentSubmitted(filePath, folder);
      }
    }
  }

  showMagnetToast(magnetUri) {
    const toastEl = document.getElementById('magnetToast');
    const btnAdd = document.getElementById('btnToastAddMagnet');

    if (toastEl) {
      toastEl.classList.add('show');
      if (btnAdd) {
        btnAdd.onclick = () => {
          toastEl.classList.remove('show');
          this.openAddMagnet(magnetUri);
        };
      }
    }
  }
}