const { app, BrowserWindow, Menu, Tray, nativeImage, shell } = require('electron');
const path = require('node:path');
const isDev = require('electron-is-dev');

console.log('[electron] main start', { isDev, platform: process.platform });

let mainWindow;
let tray;
let isQuitting = false;
const iconPath = path.join(__dirname, '..', 'Windmill.ico');

function attachWindowDiagnostics(window) {
  window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('[electron] did-fail-load', { errorCode, errorDescription, validatedURL });
  });

  window.webContents.on('did-finish-load', () => {
    console.log('[electron] did-finish-load');
  });

  window.webContents.on('render-process-gone', (_event, details) => {
    console.error('[electron] render-process-gone', details);
  });

  window.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    console.log('[renderer]', { level, message, line, sourceId });
  });
}

process.on('uncaughtException', (error) => {
  console.error('[electron] uncaughtException', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('[electron] unhandledRejection', reason);
});

function showMainWindow() {
  if (!mainWindow) {
    return;
  }
  mainWindow.show();
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.focus();
}

function createTray() {
  const trayIcon = nativeImage.createFromPath(iconPath);
  tray = new Tray(trayIcon.isEmpty() ? iconPath : trayIcon);
  tray.setToolTip('Windmill Focus');

  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '显示窗口', click: showMainWindow },
      {
        label: '退出',
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]),
  );

  tray.on('click', showMainWindow);
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 440,
    height: 760,
    minWidth: 380,
    minHeight: 560,
    autoHideMenuBar: true,
    alwaysOnTop: true,
    resizable: true,
    maximizable: false,
    frame: false,
    skipTaskbar: true,
    icon: iconPath,
    show: false,
    backgroundColor: '#FDF6E3',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  attachWindowDiagnostics(mainWindow);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
console.log('[electron] single instance lock', hasSingleInstanceLock);

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      showMainWindow();
    }
  });

  app.whenReady().then(() => {
    console.log('[electron] app ready');
    createMainWindow();
    createTray();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      } else {
        showMainWindow();
      }
    });
  });
}

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Keep app alive in the tray. Exit from tray menu.
  }
});
