/**
 * register-protocol.js
 * Native Windows Registry handler for magnet: URI protocol and .torrent file association under HKCU (no admin privileges needed).
 */
const { execSync } = require('child_process');
const path = require('path');

function getExePath() {
  const { app } = require('electron');
  if (app && app.isPackaged) {
    return process.execPath;
  }
  // Safe single string for dev
  return process.execPath;
}

function registerMagnetProtocol(customExe) {
  try {
    const exe = customExe || getExePath();
    const valCmd = `"${exe}" "%1"`;
    const valIcon = `"${exe}",0`;

    execSync(`reg add "HKCU\\Software\\Classes\\magnet" /ve /d "URL:Magnet Protocol" /f`, { stdio: 'pipe' });
    execSync(`reg add "HKCU\\Software\\Classes\\magnet" /v "URL Protocol" /d "" /f`, { stdio: 'pipe' });
    execSync(`reg add "HKCU\\Software\\Classes\\magnet\\DefaultIcon" /ve /d "${valIcon.replace(/"/g, '\\"')}" /f`, { stdio: 'pipe' });
    execSync(`reg add "HKCU\\Software\\Classes\\magnet\\shell\\open\\command" /ve /d "${valCmd.replace(/"/g, '\\"')}" /f`, { stdio: 'pipe' });

    return { success: true, message: 'Magnet protocol registered successfully in HKCU registry.' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function unregisterMagnetProtocol() {
  try {
    execSync(`reg delete "HKCU\\Software\\Classes\\magnet" /f`, { stdio: 'pipe' });
    return { success: true, message: 'Magnet protocol unregistered successfully.' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function registerTorrentAssociation(customExe) {
  try {
    const exe = customExe || getExePath();
    const valCmd = `"${exe}" "%1"`;
    const valIcon = `"${exe}",0`;

    execSync(`reg add "HKCU\\Software\\Classes\\.torrent" /ve /d "OpenTorrentClient.torrent" /f`, { stdio: 'pipe' });
    execSync(`reg add "HKCU\\Software\\Classes\\OpenTorrentClient.torrent" /ve /d "BitTorrent Document" /f`, { stdio: 'pipe' });
    execSync(`reg add "HKCU\\Software\\Classes\\OpenTorrentClient.torrent\\DefaultIcon" /ve /d "${valIcon.replace(/"/g, '\\"')}" /f`, { stdio: 'pipe' });
    execSync(`reg add "HKCU\\Software\\Classes\\OpenTorrentClient.torrent\\shell\\open\\command" /ve /d "${valCmd.replace(/"/g, '\\"')}" /f`, { stdio: 'pipe' });

    return { success: true, message: '.torrent file association registered successfully in HKCU registry.' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function checkRegistryStatus() {
  try {
    let magnetCmd = null;
    let torrentCmd = null;

    try {
      const outM = execSync(`reg query "HKCU\\Software\\Classes\\magnet\\shell\\open\\command" /ve`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      const matchM = outM.match(/REG_SZ\s+(.*)/);
      if (matchM) magnetCmd = matchM[1].trim();
    } catch (_) {}

    try {
      const outT = execSync(`reg query "HKCU\\Software\\Classes\\OpenTorrentClient.torrent\\shell\\open\\command" /ve`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      const matchT = outT.match(/REG_SZ\s+(.*)/);
      if (matchT) torrentCmd = matchT[1].trim();
    } catch (_) {}

    return {
      success: true,
      magnetRegistered: !!magnetCmd,
      torrentRegistered: !!torrentCmd,
      detail: { magnetCmd, torrentCmd }
    };
  } catch (err) {
    return { success: false, magnetRegistered: false, torrentRegistered: false, error: err.message };
  }
}

module.exports = {
  registerMagnetProtocol,
  unregisterMagnetProtocol,
  registerTorrentAssociation,
  checkRegistryStatus
};