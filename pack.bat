@echo off
REM 指尖万剑 - Electron 打包脚本（Windows + 国内镜像）
REM 三个环境变量必须一起传给子进程，否则 electron-builder 会回退到 GitHub 官方源
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
set ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
set npm_config_electron_mirror=https://npmmirror.com/mirrors/electron/
set npm_config_electron_builder_binaries_mirror=https://npmmirror.com/mirrors/electron-builder-binaries/

cd /d D:\指尖万剑
echo === Mirror config ===
echo ELECTRON_MIRROR=%ELECTRON_MIRROR%
echo ELECTRON_BUILDER_BINARIES_MIRROR=%ELECTRON_BUILDER_BINARIES_MIRROR%
echo.

echo === Build vite ===
call npm run build || exit /b 1
echo.

echo === Package Windows ===
call npx electron-builder --win --config.npmRebuild=false || exit /b 1
echo.

echo === Done ===
dir release\