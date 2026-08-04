// 指尖万剑 - Electron 主进程
// 自定义 app:// 协议映射到 dist/，解决 file:// 下绝对路径(/models/...)解析失败的问题
const { app, BrowserWindow, session, protocol, net } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

const DIST_DIR = path.join(__dirname, '..', 'dist');

// 允许视频自动播放（摄像头画面需要）
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// 注册自定义协议（必须在 app ready 之前）
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      bypassCSP: true,
    },
  },
]);

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: '指尖万剑',
    autoHideMenuBar: true,
    backgroundColor: '#000011',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.loadURL('app://app/index.html');
  return win;
}

app.whenReady().then(() => {
  // 摄像头权限放行（getUserMedia 需要 media 权限）
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    const allowed = ['media', 'display-capture', 'fullscreen', 'pointerLock'];
    callback(allowed.includes(permission));
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => {
    return ['media', 'display-capture'].includes(permission);
  });

  // app:// 协议 -> dist 目录静态文件
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url);
    let relPath = decodeURIComponent(pathname);
    if (relPath === '/' || relPath === '') relPath = '/index.html';

    const filePath = path.normalize(path.join(DIST_DIR, relPath));
    // 防路径穿越
    if (!filePath.startsWith(DIST_DIR + path.sep) && filePath !== DIST_DIR) {
      return new Response('Forbidden', { status: 403 });
    }
    return net.fetch(pathToFileURL(filePath).toString());
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
