import { execFileSync, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { networkInterfaces, platform } from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const extraArgs = process.argv.slice(2);
const env = { ...process.env };

function wifiAddress() {
  const interfaces = networkInterfaces();
  let name = Object.keys(interfaces).find((key) => /wi-?fi|wlan/i.test(key));
  if (platform() === 'darwin') {
    try {
      const ports = execFileSync('/usr/sbin/networksetup', ['-listallhardwareports'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      name = ports.match(/Hardware Port: (?:Wi-Fi|AirPort)\r?\nDevice: (\S+)/)?.[1] ?? name;
    } catch {
      // Let Expo choose its normal LAN interface if Wi-Fi discovery is unavailable.
    }
  }
  return interfaces[name]?.find((address) => address.family === 'IPv4' && !address.internal)
    ?.address;
}

if (
  !env.REACT_NATIVE_PACKAGER_HOSTNAME &&
  !extraArgs.some((arg) => /^(--tunnel|--localhost)$/.test(arg))
) {
  const address = wifiAddress();
  if (address) {
    env.REACT_NATIVE_PACKAGER_HOSTNAME = address;
    console.log(`Expo LAN address: ${address} (Wi-Fi)`);
  }
}

const expoCli = path.join(path.dirname(require.resolve('expo/package.json')), 'bin/cli');
const hasHostFlag = extraArgs.some((arg) =>
  ['--tunnel', '--localhost', '--lan', '--host', '-m'].includes(arg),
);
const child = spawn(
  process.execPath,
  [expoCli, 'start', ...(hasHostFlag ? [] : ['--lan']), '--port', '8081', ...extraArgs],
  {
    env,
    stdio: 'inherit',
  },
);
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => child.kill(signal));
child.once('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.once('exit', (code, signal) => {
  process.exitCode = code ?? (signal === 'SIGINT' ? 130 : 1);
});
