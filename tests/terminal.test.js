/**
 * Open Torrent Client — Terminal Service Unit Tests
 */

const terminalService = require('../backend/terminal-service');
const torrentManager = require('../backend/torrent-manager');

async function runTerminalTests() {
  console.log('=== Running Terminal & Background Worker Unit Tests ===');

  // 1. Initialise Terminal Service
  terminalService.init((channel, data) => {});

  // 2. Test Help Command
  console.log('Testing "help" CLI command parsing...');
  const helpRes = await terminalService.executeCommand('help');
  if (helpRes.type !== 'output' || !helpRes.text.includes('AVAILABLE COMMANDS')) {
    throw new Error('Terminal help command test failed.');
  }
  console.log('✔ Help command passed.');

  // 3. Test Ping Command
  console.log('Testing "ping" command...');
  const pingRes = await terminalService.executeCommand('ping');
  if (pingRes.type !== 'success' || !pingRes.text.includes('PONG!')) {
    throw new Error('Ping command failed.');
  }
  console.log('✔ Ping command passed.');

  // 4. Test Background Status Command
  console.log('Testing "bg" status command...');
  const bgRes = await terminalService.executeCommand('bg');
  if (!bgRes.text.includes('Background Status:')) {
    throw new Error('Background status command failed.');
  }
  console.log('✔ Background status command passed.');

  // 5. Test Status and List Commands
  console.log('Testing "status" and "list" commands...');
  const statusRes = await terminalService.executeCommand('status');
  if (!statusRes.text.includes('ENGINE & BACKGROUND STATUS')) {
    throw new Error('Status command failed.');
  }

  const listRes = await terminalService.executeCommand('list');
  if (!listRes.text.includes('QUEUE') && !listRes.text.includes('No torrents')) {
    throw new Error('List command failed.');
  }
  console.log('✔ Status & List commands passed.');

  // 6. Test Shell Execution Command (exec)
  console.log('Testing "exec echo" shell execution command...');
  const execRes = await terminalService.executeCommand('exec echo OTC_BACKGROUND_OK');
  if (!execRes.text.includes('OTC_BACKGROUND_OK')) {
    throw new Error(`Exec command failed. Output: ${execRes.text}`);
  }
  console.log('✔ Exec shell command passed.');

  // 7. Test Log Buffer and Clear
  console.log('Testing terminal log buffer and clear...');
  terminalService.log('INFO', 'Test log message 1');
  const logsBefore = terminalService.getLogs();
  if (logsBefore.length === 0) throw new Error('Log buffer empty after write.');

  terminalService.clearLogs();
  const logsAfter = terminalService.getLogs();
  if (logsAfter.length !== 0) throw new Error('Clear logs failed.');
  console.log('✔ Log buffer and clear passed.');

  console.log('=== All Terminal Unit Tests Passed Successfully! ===\n');
}

module.exports = { runTerminalTests };
