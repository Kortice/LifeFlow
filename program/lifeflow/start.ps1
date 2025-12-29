# LifeFlow 启动脚本 (PowerShell)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  LifeFlow 启动脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查 Node.js
try {
    $null = Get-Command node -ErrorAction Stop
} catch {
    Write-Host "[错误] 未检测到 Node.js，请先安装 Node.js" -ForegroundColor Red
    pause
    exit 1
}

# 检查 Python
try {
    $null = Get-Command python -ErrorAction Stop
} catch {
    Write-Host "[错误] 未检测到 Python，请先安装 Python" -ForegroundColor Red
    pause
    exit 1
}

Write-Host "[1/5] 检查后端依赖..." -ForegroundColor Yellow
Set-Location lifeflowdbapi
if (-not (Test-Path "node_modules")) {
    Write-Host "[安装] 正在安装数据库API依赖..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[错误] 安装依赖失败" -ForegroundColor Red
        pause
        exit 1
    }
}

Write-Host ""
Write-Host "[2/5] 启动数据库API服务..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; node server.js" -WindowStyle Normal

Start-Sleep -Seconds 3

Write-Host ""
Write-Host "[3/5] 启动Python AI后端..." -ForegroundColor Yellow
Set-Location ..\lifeflow-backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; conda activate base; python run.py" -WindowStyle Normal

Start-Sleep -Seconds 3

Write-Host ""
Write-Host "[4/5] 启动前端服务..." -ForegroundColor Yellow
Set-Location ..\frontend

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; python -m http.server 3000" -WindowStyle Normal

Start-Sleep -Seconds 2

Write-Host ""
Write-Host "[5/5] 打开浏览器..." -ForegroundColor Yellow
Start-Sleep -Seconds 2
Start-Process "http://localhost:3000"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  LifeFlow 已启动！" -ForegroundColor Green
Write-Host "  前端: http://localhost:3000" -ForegroundColor Green
Write-Host "  数据库API: http://localhost:3001" -ForegroundColor Green
Write-Host "  AI后端: http://localhost:8000" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "按任意键关闭此窗口..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
