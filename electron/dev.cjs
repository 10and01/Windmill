const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');

const HOST = '127.0.0.1';
const PORT = 3000;

let electronProcess;

function run(command, args, options = {}) {
  const win = process.platform === 'win32';
  const cmd = win && command === 'npx' ? 'npx.cmd' : command;
  if (win) {
    const commandLine = [cmd, ...args].join(' ');
    return spawn('cmd.exe', ['/d', '/s', '/c', commandLine], {
      stdio: 'inherit',
      shell: false,
      ...options,
    });
  }
  return spawn(cmd, args, {
    stdio: 'inherit',
    shell: false,
    ...options,
  });
}

function checkRequiredPackages() {
  const required = ['vite', 'electron'];
  const missing = required.filter((pkg) => {
    try {
      require.resolve(path.join(pkg, 'package.json'));
      return false;
    } catch {
      return true;
    }
  });

  if (missing.length > 0) {
    console.error(`[desktop:dev] Missing dependencies: ${missing.join(', ')}`);
    console.error('[desktop:dev] Please run: npm install');
    process.exit(1);
  }
}

function waitForViteReady(timeoutMs = 60000) {
  const started = Date.now();

  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get({ host: HOST, port: PORT, path: '/' }, (res) => {
        res.resume();
        resolve();
      });

      req.on('error', () => {
        if (Date.now() - started > timeoutMs) {
          reject(new Error('Vite server did not become ready in time.'));
          return;
        }
        setTimeout(tick, 600);
      });

      req.setTimeout(1200, () => {
        req.destroy();
      });
    };

    tick();
  });
}

checkRequiredPackages();

const viteProcess = run('npx', ['vite', '--port', String(PORT)]);

viteProcess.on('exit', (code) => {
  if (electronProcess && !electronProcess.killed) {
    electronProcess.kill();
  }
  process.exit(code ?? 0);
});

waitForViteReady()
  .then(() => {
    electronProcess = run('npx', ['electron', '.']);

    electronProcess.on('exit', () => {
      if (viteProcess && !viteProcess.killed) {
        viteProcess.kill();
      }
      process.exit(0);
    });
  })
  .catch((err) => {
    console.error(`[desktop:dev] ${err.message}`);
    if (viteProcess && !viteProcess.killed) {
      viteProcess.kill();
    }
    process.exit(1);
  });

process.on('SIGINT', () => {
  if (electronProcess && !electronProcess.killed) {
    electronProcess.kill();
  }
  if (viteProcess && !viteProcess.killed) {
    viteProcess.kill();
  }
  process.exit(0);
});
