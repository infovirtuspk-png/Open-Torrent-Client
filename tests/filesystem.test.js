const assert = require('assert');
const path = require('path');
const fileManager = require('../backend/file-manager');

function testPathNormalizationAndSecurity() {
  console.log('Testing File Manager Path Security & Traversal Protection...');

  const baseFolder = path.resolve('./downloads_test');
  fileManager.setAllowedRoots([baseFolder]);

  // Safe path within root
  const safeSubPath = path.join(baseFolder, 'linux-isos', 'ubuntu.iso');
  assert.strictEqual(fileManager.isPathAllowed(safeSubPath), true);

  // Path traversal attempt with ../
  const maliciousPath = path.join(baseFolder, '..', '..', 'Windows', 'System32', 'cmd.exe');
  assert.strictEqual(fileManager.isPathAllowed(maliciousPath), false);

  console.log('✔ Path traversal protection passed.');
}

function runAllFilesystemTests() {
  console.log('=== Running Filesystem Unit Tests ===');
  testPathNormalizationAndSecurity();
  console.log('=== All Filesystem Tests Passed Successfully! ===\n');
}

module.exports = { runAllFilesystemTests };
