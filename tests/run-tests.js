const { runAllTorrentTests } = require('./torrent.test');
const { runAllFilesystemTests } = require('./filesystem.test');
const { runTerminalTests } = require('./terminal.test');
const { runNetworkTests } = require('./network.test');

console.log('====================================================');
console.log('       OPEN TORRENT CLIENT TEST SUITE               ');
console.log('====================================================\n');

async function main() {
  try {
    await runAllTorrentTests();
    runAllFilesystemTests();
    await runTerminalTests();
    runNetworkTests();
    console.log('✨ ALL SUITE TESTS COMPLETED WITH 100% SUCCESS PASS RATE! ✨');
  } catch (err) {
    console.error('❌ TEST SUITE FAILED:', err);
    process.exit(1);
  }
}

main();
