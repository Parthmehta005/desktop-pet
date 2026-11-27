// Runs the Electron tests (npm run test:electron), or with `-c <config>` another
// Electron suite (npm run test:packaged). On Linux without a display they run inside a
// virtual one (xvfb-run). Extra arguments are passed on to Playwright.
import { spawnSync } from 'node:child_process';

const extra = process.argv.slice(2);
const hasConfig = extra.some((a) => a === '-c' || a === '--config' || a.startsWith('--config='));
const config = hasConfig ? [] : ['-c', 'playwright.electron.config.js'];
const playwright = ['playwright', 'test', ...config, '--trace', 'off', ...extra];
const needsVirtualDisplay = process.platform === 'linux' && !process.env.DISPLAY;

const [command, args] = needsVirtualDisplay
  ? ['xvfb-run', ['-a', '--server-args=-screen 0 1920x1080x24', 'npx', ...playwright]]
  : ['npx', playwright];

const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
if (result.error) {
  console.error(`Could not start ${command}: ${result.error.message}`);
  if (needsVirtualDisplay) console.error('Install xvfb (e.g. apt-get install xvfb) or set DISPLAY.');
}
process.exit(result.status ?? 1);
