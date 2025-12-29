# LifeFlow - 智能工作流程管理系统

> 一个AI驱动的全栈工作管理平台，集成智能对话、任务生成、文件分析、番茄钟专注和工作回顾功能

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.8+-green.svg)](https://www.python.org/)
[![Node](https://img.shields.io/badge/node-16+-green.svg)](https://nodejs.org/)

---

## 🌟 核心功能

### 1. 💬 智能对话
- 多AI模型集成（Deepseek、百度云、Kimi等）
- 支持流式响应和上下文记忆
- 会话历史保存和加载

### 2. 📄 内容分析
- 支持PDF、Word、TXT文件上传
- 自动提取关键要点和摘要
- 多文件同时处理，带进度条显示

### 3. 📋 任务管理
- 根据对话内容自动生成任务列表
- 每个任务包含：标题、优先级、DOD、预估时间
- 自动导入到任务面板，支持编辑和完成跟踪

### 4. ⏱️ 番茄钟专注
- 25分钟倒计时功能
- 暂停、继续、结束控制
- 专注时长统计和历史记录

### 5. 📊 工作回顾
- 任务完成情况统计
- 番茄专注时长汇总
- AI生成工作总结
- 一键导出Markdown格式

### 6. 📁 文件历史
- 查看所有上传的文件
- 文件摘要和关键信息
- 支持重新查看和删除

---

## 🚀 快速开始

### 一键启动（推荐）

**Windows:**
```powershell
# PowerShell
.\start.ps1

# 或 CMD
start.bat
```

**Linux/macOS:**
```bash
chmod +x start.sh
./start.sh
```

服务将自动启动：
- ✅ 前端界面: http://localhost:3000
- ✅ AI后端: http://localhost:8000
- ✅ 数据库API: http://localhost:3001

### Docker 部署

```bash
docker-compose up -d
```

---

## 📋 详细安装步骤

详见 [SETUP.md](SETUP.md) 完整部署指南

### 环境要求
- Python 3.8+
- Node.js 16+
- MySQL 8.0+

### 1. 安装数据库API

```bash
cd lifeflowdbapi
npm install
npm run init-db
npm start
```

### 2. 安装AI后端

```bash
cd lifeflow-backend
pip install -r requirements.txt

# 配置 .env 文件
cp .env.example .env
# 编辑 .env 添加 API Keys

python run.py
```

### 3. 启动前端

```bash
cd frontend
python -m http.server 3000
```

---

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────────┐
│             Frontend (HTML/CSS/JS)              │
│  • 三列响应式布局                               │
│  • 多功能面板切换                               │
│  • 实时消息更新                                 │
└─────────────┬───────────────────────────────────┘
              │
┌─────────────▼───────────────────────────────────┐
│         AI Backend (FastAPI/Python)             │
│  • 多AI模型路由                                 │
│  • 文件解析和分析                               │
│  • 任务生成和规划                               │
└─────────────┬───────────────────────────────────┘
              │
┌─────────────▼───────────────────────────────────┐
│      Database API (Express/Node.js)             │
│  • 用户认证和授权                               │
│  • 会话和消息管理                               │
│  • 任务和文档存储                               │
└─────────────┬───────────────────────────────────┘
              │
┌─────────────▼───────────────────────────────────┐
│           MySQL Database                        │
│  • 用户数据                                     │
│  • 历史记录                                     │
│  • 任务和专注统计                               │
└─────────────────────────────────────────────────┘
```

### 技术栈

**前端:**
- HTML5 + CSS3 + Vanilla JavaScript
- CSS Grid + Flexbox 布局
- Fetch API + LocalStorage

**后端:**
- Python 3.8+ / FastAPI
- Node.js / Express
- MySQL 8.0

**AI集成:**
- Deepseek API
- 百度千帆 API
- Kimi API

## 📸 功能截图

### 主界面 - 三列布局
![主界面](docs/screenshots/main.png)
- 左侧：AI选择和会话管理
- 中间：智能对话区域
- 右侧：任务/文件/专注/回顾多功能面板

### 智能任务生成
![任务生成](docs/screenshots/tasks.png)
- 自动解析对话内容
- 一键生成可执行任务
- 自动导入任务列表

### 番茄钟专注模式
![专注模式](docs/screenshots/focus.png)
- 25分钟专注计时
- 实时进度显示
- 专注历史统计

---

## 📚 使用指南

### 1. 注册和登录

访问 http://localhost:3000，首次使用需要注册账户。

### 2. 上传文件分析

1. 选择"📄 提要"功能
2. 点击"上传文件"或拖拽文件到对话框
3. 支持 PDF、Word、TXT 格式
4. 自动提取关键要点和摘要

### 3. 生成任务

**方式一：基于文件**
- 上传文件后，勾选"✅ 任务"功能
- AI 自动分析并生成任务列表

**方式二：对话生成**
- 在对话框输入需求，如"帮我规划这周的学习计划"
- 输入"生成任务"
- 任务自动导入右侧面板

### 4. 使用番茄钟

1. 切换到"⏱️ 专注"标签
2. 点击"开始专注"
3. 保持25分钟专注
4. 完成后自动记录

### 5. 工作回顾

1. 切换到"📊 回顾"标签
2. 查看任务完成情况
3. 查看专注时长统计
4. 点击"生成总结"获取AI回顾

---

## 🔧 配置说明

### AI API 配置

编辑 `lifeflow-backend/.env`:

```env
# Deepseek API
DEEPSEEK_API_KEY=sk-xxxxx
DEEPSEEK_API_URL=https://api.deepseek.com

# 百度千帆 API
BAIDU_API_KEY=xxxxx
BAIDU_SECRET_KEY=xxxxx

# Kimi API
KIMI_API_KEY=xxxxx
```

### 数据库配置

编辑 `lifeflowdbapi/db.js`:

```javascript
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'your_password',
  database: 'lifeflow',
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
```

---

## 🐛 故障排查

### 数据库连接失败

```bash
# 检查 MySQL 服务
# Windows
net start MySQL80

# 测试连接
mysql -u root -p
```

### 端口被占用

```bash
# 查看端口占用
netstat -ano | findstr :3000
netstat -ano | findstr :3001
netstat -ano | findstr :8000

# 停止占用进程
taskkill /PID <进程ID> /F
```

### AI API 调用失败

1. 检查 API Key 是否正确
2. 确认 API Key 有余额
3. 检查网络连接
4. 查看后端日志: `lifeflow-backend/logs/app.log`

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

### 开发流程

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

---

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

---

## 👥 团队

**LifeFlow Development Team**

- 产品设计与规划
- 后端开发与AI集成
- 前端开发与UI/UX
- 测试与部署

---

## 📞 联系我们

- **GitHub**: [LifeFlow Repository](https://github.com/your-org/lifeflow)
- **Email**: support@lifeflow.com
- **文档**: [完整文档](SETUP.md)

---

## 🎯 路线图

### v1.0 (当前版本)
- ✅ 基础对话功能
- ✅ 文件上传和分析
- ✅ 任务自动生成
- ✅ 番茄钟专注模式
- ✅ 工作回顾和导出

### v1.1 (计划中)
- 🔲 语音输入支持
- 🔲 移动端适配
- 🔲 团队协作功能
- 🔲 日历集成
- 🔲 数据可视化看板

### v2.0 (未来)
- 🔲 本地LLM支持
- 🔲 智能提醒推送
- 🔲 与第三方工具集成（Notion、Jira等）
- 🔲 企业版功能

---

**开始使用 LifeFlow，让 AI 帮你高效管理工作和生活！** 🚀

### 4. 启动后端服务

```powershell
cd lifeflowdbapi
npm start
```

后端服务将运行在 `http://localhost:3001`

### 5. 启动前端

使用任何静态文件服务器启动前端，例如：

**方法1：使用 Python**
```powershell
cd frontend
python -m http.server 3000
```

**方法2：使用 Node.js http-server**
```powershell
cd frontend
npx http-server -p 3000
```

**方法3：直接用浏览器打开**
```powershell
cd frontend
start index.html
```

前端将运行在 `http://localhost:3000`

### 6. 访问应用

打开浏览器访问 `http://localhost:3000`，开始使用 LifeFlow！

## 📝 使用流程

### 完整体验流程

1. **注册/登录**
   - 打开首页，点击"立即注册"
   - 输入用户名和密码（至少6位）
   - 注册成功后返回登录页面登录

2. **创建会话并生成提要**
   - 登录后进入主页
   - 点击"新建会话"创建一个新会话
   - 选择是否持久化保存（不勾选则为不落盘模式）
   - 在文本框中粘贴长文本，或点击"上传文件"选择 PDF/DOCX/TXT 文件
   - 点击"生成提要"
   - 等待系统处理，查看生成的主旨和关键要点

3. **生成任务**
   - 在提要结果下方点击"生成任务"
   - 系统会根据关键要点自动生成任务列表
   - 右侧计划板显示所有任务和"今日三件事"
   - 勾选任务前的复选框标记完成，完成度自动更新

4. **使用专注模式**
   - 点击顶部导航栏"专注模式"
   - 在下拉框中选择要专注的任务
   - 设置专注时长（默认25分钟）
   - 选择是否开启声音提醒
   - 点击"开始专注"
   - 观察倒计时和进度条，可以暂停/继续/结束

5. **查看复盘**
   - 点击顶部导航栏"复盘"
   - 查看任务总数、完成数、完成率等统计
   - 查看专注记录和总时长
   - 点击"导出为文本"生成 Markdown 格式的复盘内容
   - 复制文本用于周报或总结

6. **导出和清空**
   - 返回主页，点击"导出会话"下载当前会话内容
   - 点击"清空会话"删除所有数据（需二次确认）

## 🔧 API 接口文档

### 认证相关

#### POST `/api/auth/register`
注册新用户
```json
请求体：
{
  "username": "string",
  "password": "string"
}

响应：
{
  "success": true,
  "data": {
    "userId": "string",
    "username": "string",
    "token": "string"
  }
}
```

#### POST `/api/auth/login`
用户登录
```json
请求体：
{
  "username": "string",
  "password": "string"
}

响应：
{
  "success": true,
  "data": {
    "userId": "string",
    "username": "string",
    "token": "string"
  }
}
```

### 会话相关

#### POST `/api/sessions`
创建新会话
```json
请求头：X-User-Token: <token>

请求体：
{
  "isPersistent": boolean
}

响应：
{
  "success": true,
  "data": {
    "sessionId": "string",
    "userId": "string",
    "isPersistent": boolean
  }
}
```

#### POST `/api/sessions/:sessionId/clear`
清空会话

#### GET `/api/sessions`
获取会话列表

### 提要相关

#### POST `/api/summarize`
生成提要（支持文件上传）
```
请求头：X-User-Token: <token>
Content-Type: multipart/form-data

请求体：
- session_id: string
- text: string (可选)
- files: File[] (可选)

响应：
{
  "success": true,
  "data": {
    "summaryId": "string",
    "sessionId": "string",
    "mainTheme": "string",
    "keyPoints": [{
      "content": "string",
      "confidence": number,
      "category": "string"
    }],
    "processingTimeMs": number
  }
}
```

### 任务相关

#### POST `/api/tasks/generate`
生成任务

#### GET `/api/tasks?session_id=xxx`
获取任务列表

#### PUT `/api/tasks/:taskId`
更新任务

### 专注相关

#### POST `/api/focus/start`
开始专注

#### POST `/api/focus/progress`
更新进度

#### GET `/api/focus/status?focus_id=xxx`
获取状态

### 导出相关

#### POST `/api/export/session`
导出会话

## 🎯 性能指标

- ✅ 10页文档60秒内生成提要
- ✅ 生成至少5条关键要点
- ✅ 要点数≥8时，任务数≥8
- ✅ 每个任务都有非空DOD
- ✅ 专注进度同步偏差≤1%

## 🔐 隐私与安全

- ✅ 密码 bcrypt 加密存储
- ✅ Token 认证机制
- ✅ 不落盘模式保护隐私
- ✅ 日志不记录原始文本内容
- ✅ 支持一键清空数据

## 🚧 未来扩展

- [ ] 接入真实大模型 API（DeepSeek/Kimi/文心等）
- [ ] 完善 PDF 和 DOCX 解析
- [ ] 添加任务依赖关系可视化
- [ ] ESP32 设备实时同步
- [ ] 数据可视化图表
- [ ] 多用户协作功能

## 📄 License

MIT

## 👥 贡献

欢迎提交 Issue 和 Pull Request！

---

**LifeFlow** - 让工作更高效，让生活更美好！ 🚀
