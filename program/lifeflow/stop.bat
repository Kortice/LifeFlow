@echo off
echo ========================================
echo   停止 LifeFlow 所有服务
echo ========================================
echo.

echo 正在停止服务...

REM 停止端口占用的进程
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000" ^| find "LISTENING"') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3001" ^| find "LISTENING"') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| find ":8000" ^| find "LISTENING"') do taskkill /F /PID %%a 2>nul

echo.
echo ✅ 所有服务已停止
echo.
pause
