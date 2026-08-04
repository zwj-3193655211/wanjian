@echo off
REM 刷新 Windows 图标缓存（解决 exe 图标更新后资源管理器仍显示旧图标的问题）
REM 运行方式：右键 → 以管理员身份运行
chcp 65001 >nul
echo ========================================
echo   刷新 Windows 图标缓存
echo ========================================
echo.

echo [1/3] 关闭资源管理器...
taskkill /f /im explorer.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo [2/3] 删除图标缓存数据库...
del /f /q "%LOCALAPPDATA%\IconCache.db" >nul 2>&1
del /f /q "%LOCALAPPDATA%\Microsoft\Windows\Explorer\iconcache_*.db" >nul 2>&1
echo      已清除

echo [3/3] 重启资源管理器...
start explorer.exe
timeout /t 2 /nobreak >nul

echo.
echo ========================================
echo   完成！资源管理器图标已刷新
echo   如果还有旧图标，按 F5 刷新文件夹
echo ========================================
pause