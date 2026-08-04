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

echo === Clean up unused files ===
REM electron-builder 默认会生成 3 个不需要的文件：
REM   - builder-debug.yml：诊断日志
REM   - latest.yml：自动更新元数据（项目未配 electron-updater）
REM   - *.blockmap：差分更新元数据（同上）
REM 这些文件每次打包都会重新生成，必须每次手动清
if exist "release\builder-debug.yml" del "release\builder-debug.yml"
if exist "release\latest.yml" del "release\latest.yml"
for %%f in ("release\*.blockmap") do del "%%f"
echo 已清理无用的诊断/更新元数据文件
echo.

echo === Done ===
dir release\