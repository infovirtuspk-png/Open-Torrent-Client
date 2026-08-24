const assert = require('assert');
const path = require('path');
const bandwidthManager = require('../backend/bandwidth-manager');
const torrentManager = require('../backend/torrent-manager');
const captureManager = require('../backend/capture-manager');

async function testMagnetParsingAndValidation() {
  console.log('Testing Magnet URI Parsing & Validation Rules...');
  const sampleMagnet = 'magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Ubuntu+24.04&tr=udp%3A%2F%2Ftracker.opentrackers.org%3A1337';
  
  await captureManager.initESM();

  const validated = await captureManager.validateAndParse(sampleMagnet);
  assert.strictEqual(validated.valid, true);
  assert.strictEqual(validated.infoHash, '08ada5a7a6183aae1e09d831df6748d566095a10');
  assert.strictEqual(validated.name, 'Ubuntu 24.04');
  assert.strictEqual(validated.trackerCount, 1);

  // Malformed link test
  const malformed = await captureManager.validateAndParse('http://example.com/not-a-magnet');
  assert.strictEqual(malformed.valid, false);

  console.log('✔ Magnet URI parsing & validation rules passed.');
}

function testBandwidthCalculations() {
  console.log('Testing Bandwidth Manager & Speed Formatters...');
  
  assert.strictEqual(bandwidthManager.formatSpeed(0), '0 B/s');
  assert.strictEqual(bandwidthManager.formatSpeed(1024), '1.0 KB/s');
  assert.strictEqual(bandwidthManager.formatSpeed(1048576 * 12.5), '12.5 MB/s');

  assert.strictEqual(bandwidthManager.formatBytes(500), '500.00 B');
  assert.strictEqual(bandwidthManager.formatBytes(1048576 * 2.5), '2.50 MB');

  const etaSec = bandwidthManager.calculateETA(100 * 1024 * 1024, 10 * 1024 * 1024);
  assert.strictEqual(etaSec, 10);
  assert.strictEqual(bandwidthManager.formatETA(etaSec), '10s');
  assert.strictEqual(bandwidthManager.formatETA(3665), '1h 1m');

  console.log('✔ Bandwidth calculations passed.');
}

function testQueueStateLogic() {
  console.log('Testing Torrent Queue Ordering & Status Counters...');
  
  torrentManager.torrents.clear();

  const mockTorrents = [
    { infoHash: 'hash1', name: 'Torrent 1', status: 'Downloading', queuePosition: 1, isPaused: false },
    { infoHash: 'hash2', name: 'Torrent 2', status: 'Downloading', queuePosition: 2, isPaused: false },
    { infoHash: 'hash3', name: 'Torrent 3', status: 'Downloading', queuePosition: 3, isPaused: false },
    { infoHash: 'hash4', name: 'Torrent 4', status: 'Seeding', queuePosition: 4, isPaused: false },
    { infoHash: 'hash5', name: 'Torrent 5', status: 'Paused', queuePosition: 5, isPaused: true }
  ];

  mockTorrents.forEach(t => torrentManager.addTorrentState(t));

  const counters = torrentManager.getCounters();
  assert.strictEqual(counters.all, 5);
  assert.strictEqual(counters.downloading, 3);
  assert.strictEqual(counters.seeding, 1);
  assert.strictEqual(counters.paused, 1);

  // Test forceStart status and queue bypass
  torrentManager.forceStart('hash5');
  const updatedForced = torrentManager.getTorrent('hash5');
  assert.strictEqual(updatedForced.status, 'Downloading (Forced)');
  assert.strictEqual(updatedForced.priority, 99);
  assert.strictEqual(updatedForced.isPaused, false);

  console.log('✔ Queue state & Force Start logic passed.');
}

function testIntegrationDiagnostics() {
  console.log('Testing Magnet Handler Integration Diagnostics...');
  const report = captureManager.testMagnetHandler();
  assert.strictEqual(report.success, true);
  assert.strictEqual(report.checks.length, 5);
  console.log('✔ Integration diagnostics passed.');
}

async function runAllTorrentTests() {
  console.log('=== Running Torrent Engine Unit Tests ===');
  await testMagnetParsingAndValidation();
  testBandwidthCalculations();
  testQueueStateLogic();
  testIntegrationDiagnostics();
  console.log('=== All Torrent Tests Passed Successfully! ===\n');
}

module.exports = { runAllTorrentTests };
