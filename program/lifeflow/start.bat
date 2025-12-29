@echo off
echo ========================================
echo   LifeFlow 启动脚本
echo ========================================
echo.

REM 检查 Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js
    pause
    exit /b 1
)

echo [1/6] 清理已占用的端口...
REM 停止可能占用端口的进程
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000" ^| find "LISTENING"') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3001" ^| find "LISTENING"') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| find ":8000" ^| find "LISTENING"') do taskkill /F /PID %%a 2>nul
timeout /t 1 >nul

echo.
echo [2/6] 检查 Python 和依赖...
cd lifeflow-backend
if not exist venv (
    echo [安装] 创建虚拟环境...
    python -m venv venv
)

echo.
echo [3/6] 启动数据库服务 (Node.js MySQL API)...
cd ..\lifeflowdbapi
start "LifeFlow Database API" cmd /k "node server.js"
timeout /t 2 >nul

echo.
echo [4/6] 启动 Python 后端服务...
cd ..\lifeflow-backend
REM 激活虚拟环境并确保依赖安装后启动后端
start "LifeFlow Backend" cmd /k "call venv\Scripts\activate.bat && python run.py"
timeout /t 3 >nul

echo.
echo [5/6] 启动前端服务...
cd ..\frontend
start "LifeFlow Frontend" cmd /k "npx http-server -p 3000"
timeout /t 2 >nul

echo.
echo [6/6] 打开浏览器...
timeout /t 2 >nul
start http://localhost:3000

echo.
echo ========================================
echo   LifeFlow 已启动！
echo   数据库API: http://localhost:3001
echo   Python后端: http://localhost:8000
echo   前端界面: http://localhost:3000
echo   API文档: http://localhost:8000/api/v1/docs
echo ========================================
echo.
echo 提示：关闭此窗口不会停止服务
echo 需要停止服务请运行 stop.bat 或关闭各服务窗口
echo.
pause
