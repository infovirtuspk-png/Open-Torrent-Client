/**
 * Open Torrent Client — Network Features Unit Tests
 */

const bandwidthManager = require('../backend/bandwidth-manager');
const diagnostics = require('../backend/diagnostics');

function runNetworkTests() {
  console.log('=== Running Network Feature Unit Tests ===');

  // 1. Speed formatter validation
  console.log('Testing speed formatter functions...');
  const cases = [
    { input: 0, expected: '0 B/s' },
    { input: 500, expected: '500.0 B/s' },
    { input: 1024, expected: '1.0 KB/s' },
    { input: 1048576, expected: '1.0 MB/s' }
  ];
  for (const c of cases) {
    const result = bandwidthManager.formatSpeed(c.input);
    if (result !== c.expected) {
      throw new Error(`formatSpeed(${c.input}) expected '${c.expected}' but got '${result}'`);
    }
  }
  console.log('✔ Speed formatter passed.');

  // 2. Bandwidth limit parsing
  console.log('Testing bandwidth limit parsing...');
  const limits = bandwidthManager.getGlobalLimits();
  if (typeof limits.downloadLimitKB !== 'number' || typeof limits.uploadLimitKB !== 'number') {
    throw new Error('getGlobalLimits() should return { downloadLimitKB, uploadLimitKB } as numbers.');
  }
  console.log('✔ Bandwidth limit parsing passed.');

  // 3. ETA calculation
  console.log('Testing ETA calculation...');
  const eta = bandwidthManager.calculateETA(1048576, 102400);
  if (eta !== 11) throw new Error(`Expected ETA of 11 seconds, got ${eta}`);
  const etaStr = bandwidthManager.formatETA(eta);
  if (!etaStr.includes('s')) throw new Error(`formatETA should include 's' for seconds, got '${etaStr}'`);
  console.log('✔ ETA calculation passed.');

  // 4. Null/unlimited ETA
  console.log('Testing unlimited ETA edge cases...');
  const noEta = bandwidthManager.calculateETA(0, 0);
  if (noEta !== null) throw new Error('calculateETA(0,0) should return null');
  const fmtNull = bandwidthManager.formatETA(null);
  if (fmtNull !== '∞') throw new Error(`formatETA(null) should return '∞', got '${fmtNull}'`);
  console.log('✔ Unlimited ETA edge cases passed.');

  // 5. Network diagnostics report structure
  console.log('Testing network diagnostics report structure...');
  const netDiag = diagnostics.getNetworkDiagnostics();
  const required = ['listeningPort', 'dhtStatus', 'downloadLimitKB', 'uploadLimitKB', 'activeNetworkInterfaces', 'hostname'];
  for (const key of required) {
    if (!(key in netDiag)) {
      throw new Error(`getNetworkDiagnostics() missing required key: ${key}`);
    }
  }
  if (!Array.isArray(netDiag.activeNetworkInterfaces)) {
    throw new Error('activeNetworkInterfaces should be an array');
  }
  console.log('✔ Network diagnostics report structure passed.');

  // 6. Bytes formatter
  console.log('Testing bytes formatter...');
  const bytesCases = [
    { input: 0, expected: '0 B' },
    { input: 1024, expected: '1.00 KB' },
    { input: 1048576, expected: '1.00 MB' }
  ];
  for (const c of bytesCases) {
    const result = bandwidthManager.formatBytes(c.input);
    if (result !== c.expected) {
      throw new Error(`formatBytes(${c.input}) expected '${c.expected}' but got '${result}'`);
    }
  }
  console.log('✔ Bytes formatter passed.');

  // 7. Realtime Tray Stats update test
  console.log('Testing Realtime Tray Stats & Live Tooltip update...');
  const trayService = require('../backend/tray-service');
  trayService.updateStats({
    downloadSpeed: 5242880,
    uploadSpeed: 1048576,
    counters: { downloading: 1, seeding: 0, paused: 0, queued: 0, all: 1 },
    torrents: [
      { name: 'FastDownload.iso', progress: 0.45, downloadSpeed: 5242880, status: 'Downloading' }
    ]
  });
  if (trayService.stats.downloadSpeed !== 5242880 || trayService.stats.torrents.length !== 1) {
    throw new Error('TrayService.updateStats failed to update internal realtime stats cache.');
  }
  console.log('✔ Realtime Tray Stats & Live Tooltip update passed.');

  // 8. Background Tray Status & Lifetime Stats query
  console.log('Testing Background Tray Status & Lifetime Stats query...');
  if (typeof trayService.isTrayOnly !== 'boolean') {
    throw new Error('TrayService.isTrayOnly should return a boolean state.');
  }
  const db = require('../database/db');
  if (typeof db.getLifetimeStats !== 'function') {
    throw new Error('db.getLifetimeStats should be a function.');
  }
  console.log('✔ Background Tray Status & Lifetime Stats query passed.');

  // 9. Realtime System Telemetry — CPU, Memory, GPU
  console.log('Testing Realtime CPU, Memory & GPU telemetry methods...');
  const cpuResult = diagnostics.getRealtimeCpuUsage();
  if (typeof cpuResult.percent !== 'number' || cpuResult.percent < 0 || cpuResult.percent > 100) {
    throw new Error(`getRealtimeCpuUsage: unexpected cpu percent value: ${cpuResult.percent}`);
  }
  if (typeof cpuResult.cores !== 'number' || cpuResult.cores < 1) {
    throw new Error(`getRealtimeCpuUsage: expected at least 1 CPU core, got: ${cpuResult.cores}`);
  }

  const memResult = diagnostics.getRealtimeMemoryUsage();
  if (typeof memResult.totalMB !== 'number' || memResult.totalMB <= 0) {
    throw new Error(`getRealtimeMemoryUsage: unexpected totalMB: ${memResult.totalMB}`);
  }
  if (typeof memResult.percent !== 'number' || memResult.percent < 0 || memResult.percent > 100) {
    throw new Error(`getRealtimeMemoryUsage: unexpected memory percent: ${memResult.percent}`);
  }
  if (memResult.usedMB > memResult.totalMB) {
    throw new Error(`getRealtimeMemoryUsage: usedMB (${memResult.usedMB}) exceeds totalMB (${memResult.totalMB})`);
  }

  const gpuResult = diagnostics.getGpuStatus();
  if (typeof gpuResult.status !== 'string' || gpuResult.status.length === 0) {
    throw new Error(`getGpuStatus: expected a non-empty status string, got: ${gpuResult.status}`);
  }
  console.log('✔ Realtime CPU, Memory & GPU telemetry methods passed.');

  console.log('=== All Network Unit Tests Passed Successfully! ===\n');
}

module.exports = { runNetworkTests };
