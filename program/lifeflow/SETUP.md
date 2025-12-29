# LifeFlow 项目部署指南

## 📦 项目结构

```
plan4/
├── frontend/              # 前端文件 (HTML/CSS/JS)
├── lifeflow-backend/      # Python FastAPI 后端
├── lifeflowdbapi/         # Node.js 数据库API
├── start.bat / start.ps1  # 一键启动脚本
├── stop.bat               # 一键停止脚本
└── docker-compose.yml     # Docker 部署配置
```

## 🚀 快速开始

### 方式一：一键启动（推荐）

**Windows PowerShell:**
```powershell
.\start.ps1
```

**Windows CMD:**
```cmd
start.bat
```

这将自动启动所有服务：
- ✅ 数据库API (localhost:3001)
- ✅ AI后端 (localhost:8000)
- ✅ 前端界面 (localhost:3000)

### 方式二：Docker 部署

```bash
docker-compose up -d
```

停止服务：
```bash
docker-compose down
```

---

## 📋 手动安装步骤

### 1️⃣ 环境要求

- **Python**: 3.8+
- **Node.js**: 16+
- **MySQL**: 8.0+（或使用 Docker）
- **操作系统**: Windows / Linux / macOS

### 2️⃣ 安装数据库API

```bash
cd lifeflowdbapi
npm install
```

配置数据库连接（编辑 `db.js`）：
```javascript
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'your_password',
  database: 'lifeflow',
  port: 3306
});
```

初始化数据库：
```bash
npm run init-db
npm run extend-db
```

启动数据库API：
```bash
npm start
# 运行在 http://localhost:3001
```

### 3️⃣ 安装 Python 后端

```bash
cd lifeflow-backend
pip install -r requirements.txt
```

配置环境变量（创建 `.env` 文件）：
```env
# AI API Keys
DEEPSEEK_API_KEY=your_deepseek_key
BAIDU_API_KEY=your_baidu_key
BAIDU_SECRET_KEY=your_baidu_secret
KIMI_API_KEY=your_kimi_key

# Database
DB_API_URL=http://localhost:3001

# JWT Security
SECRET_KEY=your_secret_key_here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

启动 AI 后端：
```bash
python run.py
# 运行在 http://localhost:8000
```

### 4️⃣ 启动前端

```bash
cd frontend
python -m http.server 3000
# 或使用任何静态文件服务器
```

访问: http://localhost:3000

---

## 🔧 配置说明

### 数据库配置

**MySQL 配置文件**: `lifeflowdbapi/db.js`

关键参数：
- `host`: 数据库地址
- `user`: 数据库用户名
- `password`: 数据库密码
- `database`: 数据库名称（默认 `lifeflow`）
- `port`: 端口（默认 3306）

### AI 后端配置

**配置文件**: `lifeflow-backend/.env`

需要配置的 API Keys：
1. **Deepseek**: https://platform.deepseek.com/
2. **百度云**: https://cloud.baidu.com/
3. **Kimi**: https://kimi.moonshot.cn/

### 前端配置

**配置文件**: `frontend/js/config.js`

```javascript
const API_CONFIG = {
    DB_API: 'http://localhost:3001',
    AI_API: 'http://localhost:8000'
};
```

---

## 🐳 Docker 部署（推荐生产环境）

### 完整部署

```bash
# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down

# 重启服务
docker-compose restart
```

### 单独服务管理

```bash
# 只启动数据库
docker-compose up -d mysql

# 只启动后端
docker-compose up -d backend

# 查看特定服务日志
docker-compose logs -f backend
```

---

## 📝 数据库初始化

### 自动初始化（推荐）

```bash
cd lifeflowdbapi
npm run init-db      # 创建基础表
npm run extend-db    # 扩展功能表
```

### 手动初始化

执行 SQL 脚本（在 `lifeflowdbapi/init_db.js` 中查看）：

**基础表**：
- `users` - 用户表
- `sessions` - 会话表
- `messages` - 消息记录
- `tasks` - 任务列表
- `summaries` - 摘要记录
- `documents` - 文档管理
- `focus_sessions` - 番茄钟记录
- `devices` - 设备管理

---

## 🧪 测试部署

### 检查服务状态

**数据库API**:
```bash
curl http://localhost:3001/api/health
# 预期: {"status": "ok", "database": "connected"}
```

**AI后端**:
```bash
curl http://localhost:8000/health
# 预期: {"status": "ok"}
```

**前端**:
打开浏览器访问 http://localhost:3000

### 功能测试

1. **注册/登录**
   - 访问前端，点击"登录/注册"
   - 创建新账户或登录

2. **上传文件**
   - 点击"📄 提要"功能
   - 上传 PDF/Word/TXT 文件
   - 查看生成的摘要

3. **任务生成**
   - 在对话框输入"生成任务"
   - 查看右侧任务面板

4. **番茄钟**
   - 切换到"⏱️ 专注"标签
   - 启动番茄钟计时

---

## 🔍 常见问题

### Q1: 数据库连接失败？

**解决方案**：
1. 确认 MySQL 服务已启动
2. 检查 `lifeflowdbapi/db.js` 配置
3. 确认用户名密码正确
4. 检查防火墙是否阻止 3306 端口

### Q2: AI 后端返回错误？

**解决方案**：
1. 检查 `.env` 文件中的 API Keys
2. 确认 API Key 有效且有余额
3. 查看 `lifeflow-backend/logs/` 日志文件

### Q3: 前端无法连接后端？

**解决方案**：
1. 检查 CORS 设置
2. 确认后端服务已启动
3. 检查 `frontend/js/config.js` 配置
4. 打开浏览器开发者工具查看网络请求

### Q4: 文件上传失败？

**解决方案**：
1. 检查上传目录权限 (`lifeflow-backend/uploads/`)
2. 确认文件大小限制（默认 10MB）
3. 查看后端日志

---

## 📊 性能优化

### 生产环境建议

1. **使用 Gunicorn 运行 Python 后端**
   ```bash
   pip install gunicorn
   gunicorn -w 4 -k uvicorn.workers.UvicornWorker app.main:app
   ```

2. **使用 Nginx 反向代理**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:3000;
       }
       
       location /api/v1 {
           proxy_pass http://localhost:8000;
       }
       
       location /db/api {
           proxy_pass http://localhost:3001;
       }
   }
   ```

3. **启用数据库连接池**
   - MySQL 连接池大小: 10-20
   - 启用查询缓存

4. **CDN 加速静态资源**
   - 将前端资源上传到 CDN
   - 配置浏览器缓存策略

---

## 🛡️ 安全建议

1. **修改默认密码**
   - 数据库密码
   - JWT Secret Key

2. **启用 HTTPS**
   ```bash
   # 使用 Let's Encrypt
   certbot --nginx -d your-domain.com
   ```

3. **限制 API 访问**
   - 配置防火墙规则
   - 启用 Rate Limiting

4. **定期备份数据库**
   ```bash
   mysqldump -u root -p lifeflow > backup_$(date +%Y%m%d).sql
   ```

---

## 📞 技术支持

- **文档**: 查看项目 README.md
- **问题反馈**: GitHub Issues
- **开发团队**: LifeFlow Team

---

## 📄 许可证

MIT License - 详见 LICENSE 文件
