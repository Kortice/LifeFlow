// 常量
const DB_API = 'http://localhost:3001';

// LifeFlow AI 助手 - 统一智能对话 v2.1
let currentSession = null;
let taskList = [];
let focusTimer = null;
let breakTimer = null;
let focusTimeLeft = 25 * 60; // 秒
let focusRunning = false;
let breakRunning = false;
let focusSessions = 0;
let totalFocusTime = 0;
let currentTab = 'chat';

// 设备连接相关
let wsConnection = null;
let isDeviceConnected = false;
let isConnecting = false;
let reconnectTimeoutId = null;
const DEVICE_PORT = 80;
const RECONNECT_INTERVAL = 5000; // 重连间隔5秒
const CONNECTION_TIMEOUT = 10000; // 连接超时10秒
let connectionTimeoutId = null;
let esp32IP = localStorage.getItem('esp32IP') || '192.168.4.1'; // 默认ESP32 AP模式IP
let esp32Connected = false;


// 页面加载
window.onload = function() {
    console.log('LifeFlow AI 初始化...');
    checkAuth();
    bindEvents();
    loadHistory();
    restoreSession(); // 恢复上次会话
    loadTasks(); // 加载任务
    loadFocusStats(); // 加载专注统计
    
    // 初始化ESP32 IP输入框
    const esp32IPInput = document.getElementById('esp32IP');
    if (esp32IPInput) {
        esp32IPInput.value = esp32IP;
    }
    
    // 初始化ESP32设备连接
    setupDeviceConnection();
    
    // 自动聚焦输入框
    setTimeout(() => {
        const input = document.getElementById('messageInput');
        if (input) input.focus();
    }, 100);
};

// 设置设备连接
function setupDeviceConnection() {
    // 避免重复连接尝试
    if (isConnecting || (wsConnection && (wsConnection.readyState === WebSocket.CONNECTING || wsConnection.readyState === WebSocket.OPEN))) {
        console.log('🔄 已经在连接中或连接已建立，避免重复连接');
        return;
    }
    
    console.log(`🔌 尝试连接到设备: ws://${esp32IP}:${DEVICE_PORT}`);
    
    // 清除之前的重连计时器
    if (reconnectTimeoutId) {
        clearTimeout(reconnectTimeoutId);
        reconnectTimeoutId = null;
    }
    
    // 标记正在连接
    isConnecting = true;
    
    // 关闭之前的连接（如果存在）
    if (wsConnection) {
        try {
            wsConnection.close();
        } catch (error) {
            console.log('⚠️ 关闭旧连接时发生错误:', error);
        }
        wsConnection = null;
    }
    
    try {
        wsConnection = new WebSocket(`ws://${esp32IP}:${DEVICE_PORT}`);
        
        console.log('🔌 WebSocket对象已创建，连接状态:', wsConnection.readyState === WebSocket.CONNECTING ? 'CONNECTING' : wsConnection.readyState);
        
        // 设置连接超时
        connectionTimeoutId = setTimeout(() => {
            console.log('⏱️ 连接超时，尝试关闭并重新连接');
            if (wsConnection && wsConnection.readyState === WebSocket.CONNECTING) {
                wsConnection.close();
                scheduleReconnect();
            }
        }, CONNECTION_TIMEOUT);
        
        wsConnection.onopen = function() {
            console.log('✅ 已连接到ESP32设备');
            console.log('✅ WebSocket连接已打开，状态:', wsConnection.readyState);
            
            // 清除连接超时
            if (connectionTimeoutId) {
                clearTimeout(connectionTimeoutId);
                connectionTimeoutId = null;
            }
            
            isDeviceConnected = true;
            esp32Connected = true;
            isConnecting = false;
            updateDeviceStatus(true);
            
            // 发送初始状态
            const result = sendToDevice({
                type: 'status',
                status: 'ready',
                message: '设备已连接'
            });
            console.log('📤 初始状态消息发送结果:', result);
        };
        
        wsConnection.onmessage = function(event) {
            console.log('📩 收到设备消息:', event.data);
        };
        
        wsConnection.onerror = function(error) {
            console.log('❌ 设备连接错误:', error);
            console.log('❌ WebSocket错误详情:', JSON.stringify(error));
            if (wsConnection) {
                console.log('❌ WebSocket连接状态:', wsConnection.readyState);
            }
            
            // 清除连接超时
            if (connectionTimeoutId) {
                clearTimeout(connectionTimeoutId);
                connectionTimeoutId = null;
            }
            
            isDeviceConnected = false;
            esp32Connected = false;
            isConnecting = false;
            updateDeviceStatus(false);
            
            // 安排重连
            scheduleReconnect();
        };
        
        wsConnection.onclose = function(event) {
            console.log('❌ 设备连接断开，代码:', event.code, '原因:', event.reason);
            if (wsConnection) {
                console.log('❌ WebSocket连接状态:', wsConnection.readyState);
            }
            
            // 清除连接超时
            if (connectionTimeoutId) {
                clearTimeout(connectionTimeoutId);
                connectionTimeoutId = null;
            }
            
            isDeviceConnected = false;
            esp32Connected = false;
            isConnecting = false;
            updateDeviceStatus(false);
            
            // 安排重连
            scheduleReconnect();
        };
        
    } catch (error) {
        console.log('❌ 无法连接到设备:', error);
        
        // 清除连接超时
        if (connectionTimeoutId) {
            clearTimeout(connectionTimeoutId);
            connectionTimeoutId = null;
        }
        
        isDeviceConnected = false;
        esp32Connected = false;
        isConnecting = false;
        updateDeviceStatus(false);
        
        // 安排重连
        scheduleReconnect();
    }
}

// 安排重连
function scheduleReconnect() {
    if (reconnectTimeoutId) {
        clearTimeout(reconnectTimeoutId);
        reconnectTimeoutId = null;
    }
    
    console.log(`⏰ 将在${RECONNECT_INTERVAL / 1000}秒后尝试重新连接...`);
    reconnectTimeoutId = setTimeout(() => {
        console.log('🔄 执行重连尝试...');
        setupDeviceConnection();
    }, RECONNECT_INTERVAL);
}

// 更新设备状态显示
function updateDeviceStatus(connected) {
    const syncInfo = document.querySelector('.sync-info');
    const statusIndicator = document.getElementById('esp32Status');
    
    if (syncInfo) {
        if (connected) {
            syncInfo.innerHTML = '<p style="color: #4CAF50;">✓ 已连接到ESP32设备，专注状态将同步显示</p>';
        } else {
            syncInfo.innerHTML = '<p style="color: #ff9800;">⚠️ 未检测到ESP32设备，请确保设备在WiFi范围内</p>';
        }
    }
    
    if (statusIndicator) {
        if (connected) {
            statusIndicator.textContent = '已连接';
            statusIndicator.className = 'status connected';
        } else {
            statusIndicator.textContent = '未连接';
            statusIndicator.className = 'status disconnected';
        }
    }
}

// 发送数据到设备
function sendToDevice(data) {
    console.log('🔔 尝试发送数据到设备:', data);
    console.log('🔌 WebSocket连接对象存在:', !!wsConnection);
    if (wsConnection) {
        const readyStateText = wsConnection.readyState === WebSocket.CONNECTING ? 'CONNECTING' : 
                              wsConnection.readyState === WebSocket.OPEN ? 'OPEN' : 
                              wsConnection.readyState === WebSocket.CLOSING ? 'CLOSING' : 
                              wsConnection.readyState === WebSocket.CLOSED ? 'CLOSED' : 
                              'UNKNOWN';
        console.log('🔌 WebSocket连接状态:', readyStateText, '(', wsConnection.readyState, ')');
    } else {
        console.log('🔌 WebSocket连接对象不存在');
    }
    
    if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
        console.log('📤 发送数据:', JSON.stringify(data));
        wsConnection.send(JSON.stringify(data));
        console.log('✅ 数据已发送到设备');
        return true;
    } else {
        console.log('❌ 发送失败: WebSocket连接未打开');
        console.log('🔧 尝试重新连接设备...');
        setupDeviceConnection(); // 尝试重新连接
        return false;
    }
}

// 恢复上次会话
async function restoreSession() {
    const savedSession = localStorage.getItem('currentSession');
    if (savedSession) {
        try {
            currentSession = JSON.parse(savedSession);
            if (currentSession?.id) {
                document.getElementById('sessionStatus').textContent = '已恢复';
                document.getElementById('sessionStatus').classList.add('active');
                document.getElementById('sessionId').textContent = currentSession.id.substring(0, 8);
                
                // 从数据库加载聊天历史
                await loadChatHistory(currentSession.id);
            }
        } catch (e) {
            console.error('恢复会话失败:', e);
        }
    }
}

// 从数据库加载聊天历史
async function loadChatHistory(sessionId) {
    try {
        const res = await fetch(`${DB_API}/api/messages/${sessionId}`);
        const data = await res.json();
        
        const container = document.getElementById('messagesContainer');
        
        if (data.success && data.data?.messages?.length > 0) {
            container.innerHTML = ''; // 清空
            
            data.data.messages.forEach(msg => {
                if (msg.role === 'user') {
                    addUserMessage(msg.content, [], false); // false = 不保存到数据库
                } else if (msg.role === 'assistant') {
                    addAIMessage(msg.content, false);
                }
            });
            
            document.getElementById('sessionStatus').textContent = '已加载';
            console.log(`已加载 ${data.data.messages.length} 条聊天记录`);
        } else {
            // 没有历史记录，显示欢迎消息
            container.innerHTML = '';
            addAIMessage('✅ 已加载会话 ' + sessionId.substring(0, 8) + '\n\n这是一个新会话，开始聊天吧！', false);
            document.getElementById('sessionStatus').textContent = '已加载';
        }
    } catch (e) {
        console.log('加载聊天历史失败:', e.message);
        document.getElementById('messagesContainer').innerHTML = '';
        addAIMessage('⚠️ 无法加载聊天历史，但你可以继续聊天', false);
    }
}

// 保存消息到数据库
async function saveMessageToDB(sessionId, role, content) {
    try {
        await fetch(`${DB_API}/api/messages/${sessionId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role, content })
        });
    } catch (e) {
        console.log('保存消息失败:', e.message);
    }
}

// 保存会话到本地
function saveSession() {
    if (currentSession) {
        localStorage.setItem('currentSession', JSON.stringify(currentSession));
    }
}

// 快捷功能操作
function quickAction(type) {
    // 设置对应的功能选中
    document.querySelectorAll('input[name="feature"]').forEach(cb => {
        cb.checked = cb.value === 'chat' || cb.value === type;
    });
    
    // 聚焦输入框
    const input = document.getElementById('messageInput');
    if (input) {
        input.focus();
        
        const hints = {
            'chat': '随便问点什么...',
            'summary': '请输入需要总结的内容，或上传文档...',
            'plan': '输入你想规划的事情，我来帮你分析...',
            'task': '输入你要做的事情，我来帮你生成任务...'
        };
        input.placeholder = hints[type] || '随便聊聊...';
    }
}

// 获取选中的功能
function getSelectedFeatures() {
    const checkboxes = document.querySelectorAll('input[name="feature"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

// 检查登录
function checkAuth() {
    let username = localStorage.getItem('username');
    if (!username) {
        username = 'User';
        localStorage.setItem('username', username);
        localStorage.setItem('token', 'token-' + Date.now());
    }
    const el = document.getElementById('sidebarUsername');
    if (el) el.textContent = username;
}

// 绑定事件
function bindEvents() {
    // 输入框
    const input = document.getElementById('messageInput');
    if (input) {
        input.disabled = false;
        input.onkeydown = function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        };
        input.oninput = function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 150) + 'px';
        };
    }
    
    // 发送按钮
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) sendBtn.onclick = sendMessage;
    
    // 新对话
    const newBtn = document.getElementById('newChatBtn');
    if (newBtn) newBtn.onclick = newChat;
    
    // 文件上传
    const attachBtn = document.getElementById('attachBtn');
    const fileInput = document.getElementById('fileInput');
    if (attachBtn && fileInput) {
        attachBtn.onclick = () => fileInput.click();
        fileInput.onchange = handleFiles;
    }
    
    // 其他按钮
    document.getElementById('clearChatBtn')?.addEventListener('click', clearChat);
    document.getElementById('exportBtn')?.addEventListener('click', exportChat);
    document.getElementById('logoutBtn')?.addEventListener('click', logout);
    
    // 标签页切换 (仅监听右侧面板的tab)
    document.querySelectorAll('.right-panel-tabs [data-tab]').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    
    // 任务筛选
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => filterTasks(btn.dataset.filter));
    });
}

// 新建对话
async function newChat() {
    try {
        const res = await fetch('http://localhost:8000/api/v1/session/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_name: 'Chat ' + new Date().toLocaleString('zh-CN'), memory_only: false })
        });
        const data = await res.json();
        currentSession = { 
            id: data.data?.session_id || data.session_id,
            lastKeyPoints: []
        };
        
        // 保存到本地
        saveSession();
        
        document.getElementById('sessionStatus').textContent = '对话中';
        document.getElementById('sessionStatus').classList.add('active');
        document.getElementById('sessionId').textContent = currentSession.id.substring(0, 8);
        
        document.getElementById('messagesContainer').innerHTML = '';
        addAI('你好！我是 LifeFlow AI 助手 🌊\n\n我可以帮你：\n• 💬 **日常对话** - 随时聊天问答\n• 📝 **内容摘要** - 上传文档提取要点\n• 📋 **计划建议** - 分析问题给出建议\n• ✅ **任务生成** - 生成可执行的任务\n• 📚 **知识问答** - 专业知识查询\n\n**左侧可多选功能组合使用！** 直接输入你的问题，或者上传文档开始吧！');
        
        toast('新对话已创建', 'success');
        loadHistory();
    } catch (e) {
        toast('创建失败: ' + e.message, 'error');
    }
}

// 发送消息
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    const fileInput = document.getElementById('fileInput');
    const files = fileInput ? Array.from(fileInput.files) : [];
    
    if (!text && !files.length) return;
    
    if (!currentSession) await newChat();
    
    // 获取选中的功能
    const features = getSelectedFeatures();
    
    // 显示用户消息
    addUser(text, files);
    input.value = '';
    input.style.height = 'auto';
    if (fileInput) fileInput.value = '';
    document.getElementById('filePreview').innerHTML = '';
    
    // 根据选中的功能处理
    if (files.length > 0) {
        await handleFileUpload(files, text, features);
    } else {
        await handleTextWithFeatures(text, features);
    }
}

// 根据选中功能处理文本
async function handleTextWithFeatures(text, features) {
    // 检测是否是特殊指令
    const lowerText = text.toLowerCase();
    
    // 如果用户说"生成任务"
    if (/生成任务|创建任务|任务列表/.test(lowerText)) {
        // 如果有保存的要点，直接生成
        if (currentSession?.lastKeyPoints?.length > 0) {
            addAI('🔄 正在根据要点生成任务...');
            try {
                const taskRes = await fetch('http://localhost:8000/api/v1/task/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ session_id: currentSession?.id, key_points: currentSession.lastKeyPoints })
                });
                const taskData = await taskRes.json();
                const tasks = taskData.data?.tasks || taskData.tasks || [];
                
                removeLastAI();
                
                if (tasks.length === 0) {
                    addAI('暂时没有生成任务，请尝试提供更详细的内容。');
                    return;
                }
                
                // 导入任务
                addTasksToList(tasks);
                
                let reply = '✅ **已生成 ' + tasks.length + ' 个任务：**\n\n';
                tasks.forEach((t, i) => {
                    reply += `**${i + 1}. ${t.title}**\n`;
                    if (t.priority) reply += `   优先级: ${t.priority}\n`;
                    if (t.estimated_minutes) reply += `   预计: ${t.estimated_minutes}分钟\n`;
                    reply += '\n';
                });
                
                addAI(reply + '\n👉 已自动添加到任务列表。');
                
                // 切换到任务面板
                switchTab('tasks');
            } catch (e) {
                removeLastAI();
                addAI('生成任务失败：' + e.message);
            }
            return;
        }
        
        // 否则从历史中提取要点并生成任务
        addAI('🔄 正在从对话历史中提取要点并生成任务...');
        try {
            const history = await getChatHistory();
            if (history.length > 0) {
                // 让 AI 从历史中提取要点并生成任务
                const historyText = history.map(h => `${h.role === 'user' ? '用户' : 'AI'}: ${h.content}`).join('\n\n');
                const taskResult = await taskAPI('请根据以下对话历史生成可执行的任务：\n\n' + historyText.substring(0, 3000));
                removeLastAI();
                addAI(taskResult);
            } else {
                removeLastAI();
                addAI('当前会话没有足够的上下文来生成任务。请先分析文档或描述你想完成的事情。');
            }
        } catch (e) {
            removeLastAI();
            addAI('生成任务失败：' + e.message);
        }
        return;
    }
    
    // 如果只选了聊天，或者没有特殊功能，走普通对话
    if (features.length === 0 || (features.length === 1 && features.includes('chat'))) {
        await chat(text);
        return;
    }
    
    // 显示选中的功能
    const featureNames = {
        'chat': '智能对话',
        'summary': '内容摘要',
        'plan': '计划建议',
        'task': '任务生成',
        'knowledge': '知识问答'
    };
    const selectedNames = features.map(f => featureNames[f]).join(' + ');
    addAI(`🔄 正在使用 **${selectedNames}** 模式处理...`);
    
    try {
        let results = [];
        
        // 依次处理每个功能
        for (const feature of features) {
            if (feature === 'chat') {
                // 普通对话
                const chatResult = await chatAPI(text);
                results.push({ type: '💬 智能对话', content: chatResult });
            } else if (feature === 'summary') {
                // 摘要
                const summaryResult = await summarizeAPI(text);
                results.push({ type: '📝 内容摘要', content: summaryResult });
            } else if (feature === 'plan') {
                // 计划建议
                const planResult = await planAPI(text);
                results.push({ type: '📋 计划建议', content: planResult });
            } else if (feature === 'task') {
                // 任务生成
                const taskResult = await taskAPI(text);
                results.push({ type: '✅ 任务生成', content: taskResult });
            } else if (feature === 'knowledge') {
                // 知识问答
                const knowledgeResult = await knowledgeAPI(text);
                results.push({ type: '📚 知识问答', content: knowledgeResult });
            }
        }
        
        // 移除加载提示
        removeLastAI();
        
        // 显示结果
        let reply = '';
        results.forEach((r, i) => {
            if (i > 0) reply += '\n\n---\n\n';
            reply += `**${r.type}**\n\n${r.content}`;
        });
        
        addAI(reply);
        
    } catch (e) {
        removeLastAI();
        addAI('处理时出错：' + e.message);
    }
}

// 获取当前会话的聊天历史（用于发送给 AI）
async function getChatHistory() {
    if (!currentSession?.id) return [];
    
    try {
        const res = await fetch(`${DB_API}/api/messages/${currentSession.id}`);
        const data = await res.json();
        
        if (data.success && data.data?.messages) {
            // 返回最近 10 条消息作为上下文
            return data.data.messages.slice(-10).map(m => ({
                role: m.role,
                content: m.content
            }));
        }
    } catch (e) {
        console.log('获取历史失败:', e);
    }
    return [];
}

// 聊天 API - 带历史上下文（智能路由）
async function chatAPI(text) {
    // 获取历史消息作为上下文
    const history = await getChatHistory();
    
    const res = await fetch('http://localhost:8000/api/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            message: text, 
            session_id: currentSession?.id,
            history: history
        })
    });
    const data = await res.json();
    
    // 显示实际使用的 provider（智能选择）
    if (data.data?.provider) {
        console.log(`智能路由: 使用 ${data.data.provider}`);
    }
    
    return data.data?.reply || '无法获取回复';
}

// 摘要 API
async function summarizeAPI(text) {
    const res = await fetch('http://localhost:8000/api/v1/summary/from-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text, session_id: currentSession?.id })
    });
    const data = await res.json();
    const summary = data.data?.summary || {};
    
    let result = '';
    if (summary.theme) {
        result += '**核心主旨：** ' + summary.theme + '\n\n';
    }
    if (summary.key_points && summary.key_points.length > 0) {
        result += '**关键要点：**\n';
        summary.key_points.forEach((p, i) => {
            const content = p.point || p.content || p;
            result += `${i + 1}. ${content}\n`;
        });
    }
    return result || '无法提取摘要';
}

// 计划 API
async function planAPI(text) {
    const res = await fetch('http://localhost:8000/api/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            message: `请分析以下内容，给出详细的计划建议和执行步骤：\n\n${text}`, 
            session_id: currentSession?.id 
        })
    });
    const data = await res.json();
    return data.data?.reply || '无法生成计划';
}

// 任务 API
async function taskAPI(text) {
    // 先提取要点
    const sumRes = await fetch('http://localhost:8000/api/v1/summary/from-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text, session_id: currentSession?.id })
    });
    const sumData = await sumRes.json();
    const keyPoints = sumData.data?.summary?.key_points || [];
    
    if (keyPoints.length === 0) {
        return '没有提取到足够的信息来生成任务';
    }
    
    // 生成任务
    const points = keyPoints.map(p => p.point || p.content || p);
    const taskRes = await fetch('http://localhost:8000/api/v1/task/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: currentSession?.id, key_points: points })
    });
    const taskData = await taskRes.json();
    const tasks = taskData.data?.tasks || [];
    
    if (tasks.length === 0) {
        return '暂时没有生成任务';
    }

    // 自动导入到任务列表
    addTasksToList(tasks);

    let result = `✅ 已生成并自动导入 ${tasks.length} 个任务：\n\n`;
    tasks.forEach((t, i) => {
        result += `**${i + 1}. ${t.title}**\n`;
        if (t.priority) result += `   优先级: ${t.priority}\n`;
        if (t.estimated_minutes) result += `   预计: ${t.estimated_minutes}分钟\n`;
    });
    result += `\n👉 已添加到任务标签，可直接查看和管理。`;
    return result;
}

// 将任务导入本地任务列表并刷新
function addTasksToList(tasks) {
    if (!tasks || tasks.length === 0) return 0;
    const now = Date.now();
    tasks.forEach((t, idx) => {
        const newTask = {
            id: 'task-' + now + '-' + idx + '-' + Math.random().toString(36).substr(2, 5),
            title: t.title,
            priority: t.priority === 'P0' ? 'high' : (t.priority === 'P2' ? 'low' : 'normal'),
            estimated_minutes: t.estimated_minutes,
            dod: t.dod || [],
            completed: false,
            createdAt: new Date().toISOString()
        };
        taskList.push(newTask);
    });
    saveTasks();
    refreshTaskList();
    return tasks.length;
}

// 知识问答 API
async function knowledgeAPI(text) {
    const res = await fetch('http://localhost:8000/api/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            message: `作为知识助手，请详细回答以下问题，提供专业、准确的信息：\n\n${text}`, 
            session_id: currentSession?.id 
        })
    });
    const data = await res.json();
    return data.data?.reply || '无法获取答案';
}

// 处理文本对话（保留兼容性）
async function handleTextChat(text) {
    const features = getSelectedFeatures();
    await handleTextWithFeatures(text, features);
}

// 普通 AI 对话
async function chat(text) {
    addAI('思考中...');
    
    try {
        const reply = await chatAPI(text);
        removeLastAI();
        addAI(reply);
    } catch (e) {
        removeLastAI();
        addAI('抱歉，处理时出现问题：' + e.message);
    }
}

// 生成计划建议
async function generatePlan(text) {
    addAI('正在分析并生成建议...');
    
    try {
        const res = await fetch('http://localhost:8000/api/v1/summary/from-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: '请分析以下内容并给出详细的计划建议和步骤：\n\n' + text, session_id: currentSession?.id })
        });
        
        const result = await res.json();
        const data = result.data || result;
        const summary = data.summary || {};
        
        removeLastAI();
        
        let reply = '📋 **计划建议**\n\n';
        
        if (summary.theme) {
            reply += '**分析：** ' + summary.theme + '\n\n';
        }
        
        if (summary.key_points && summary.key_points.length > 0) {
            reply += '**建议步骤：**\n';
            summary.key_points.forEach((p, i) => {
                const content = p.point || p.content || p;
                reply += `${i + 1}. ${content}\n`;
            });
            
            reply += '\n💡 如需生成具体任务，请说"生成任务"';
        } else {
            reply += '请提供更详细的信息，我可以给你更具体的建议。';
        }
        
        addAI(reply);
        
    } catch (e) {
        removeLastAI();
        addAI('生成建议时出错：' + e.message);
    }
}

// 从文本生成任务
async function generateTaskFromText(text) {
    addAI('正在生成任务列表...');
    
    try {
        // 先提取要点
        const sumRes = await fetch('http://localhost:8000/api/v1/summary/from-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text, session_id: currentSession?.id })
        });
        
        const sumData = await sumRes.json();
        const summary = sumData.data?.summary || sumData.summary || {};
        const keyPoints = summary.key_points || [];
        
        if (keyPoints.length === 0) {
            removeLastAI();
            addAI('没有提取到足够的信息来生成任务。请提供更详细的描述。');
            return;
        }
        
        // 生成任务
        const points = keyPoints.map(p => p.point || p.content || p);
        const taskRes = await fetch('http://localhost:8000/api/v1/task/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: currentSession?.id, key_points: points })
        });
        
        const taskData = await taskRes.json();
        const tasks = taskData.data?.tasks || taskData.tasks || [];
        
        removeLastAI();
        
        if (tasks.length === 0) {
            addAI('暂时没有生成任务，请尝试提供更具体的内容。');
            return;
        }
        
        let reply = '✅ **已生成 ' + tasks.length + ' 个任务：**\n\n';
        tasks.forEach((t, i) => {
            reply += `**${i + 1}. ${t.title}**\n`;
            if (t.priority) reply += `   优先级: ${t.priority}\n`;
            if (t.estimated_minutes) reply += `   预计: ${t.estimated_minutes}分钟\n`;
            reply += '\n';
        });
        
        addAI(reply);
        
    } catch (e) {
        removeLastAI();
        addAI('生成任务失败：' + e.message);
    }
}

// 总结文本
async function summarizeText(text) {
    addAI('正在总结...');
    
    try {
        const res = await fetch('http://localhost:8000/api/v1/summary/from-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text, session_id: currentSession?.id })
        });
        
        const result = await res.json();
        const data = result.data || result;
        const summary = data.summary || {};
        
        removeLastAI();
        
        let reply = '📝 **内容摘要**\n\n';
        
        if (summary.theme) {
            reply += '**核心主旨：** ' + summary.theme + '\n\n';
        }
        
        if (summary.key_points && summary.key_points.length > 0) {
            reply += '**关键要点：**\n';
            summary.key_points.forEach((p, i) => {
                const content = p.point || p.content || p;
                reply += `${i + 1}. ${content}\n`;
            });
        } else {
            reply += '内容较短，无法提取更多要点。';
        }
        
        addAI(reply);
        
    } catch (e) {
        removeLastAI();
        addAI('总结失败：' + e.message);
    }
}

// 处理文件上传
async function handleFileUpload(files, userText, features) {
    if (!features) features = getSelectedFeatures();
    
    for (const file of files) {
        addAI('📎 正在分析 **' + file.name + '** ...');
        
        try {
            const formData = new FormData();
            formData.append('file', file);
            if (currentSession) formData.append('session_id', currentSession.id);
            
            const res = await fetch('http://localhost:8000/api/v1/summary/from-file', {
                method: 'POST',
                body: formData
            });
            
            const result = await res.json();
            const data = result.data || result;
            const summary = data.summary || {};
            const theme = summary.theme || '';
            const keyPoints = summary.key_points || [];
            
            // 保存文件历史
            saveFileToHistory(file, summary);
            
            removeLastAI();
            
            // 基础文档分析结果
            let reply = '📄 **文档分析完成：' + file.name + '**\n\n';
            
            if (theme) {
                reply += '**核心摘要：**\n' + theme + '\n\n';
            }
            
            const points = [];
            if (keyPoints.length > 0) {
                reply += '**关键要点：**\n';
                keyPoints.forEach((p, i) => {
                    const content = p.point || p.content || p;
                    reply += `${i + 1}. ${content}\n`;
                    points.push(content);
                });
                
                // 保存要点供后续使用
                currentSession.lastKeyPoints = points;
                saveSession(); // 持久化保存
                
                reply += '\n💡 需要我根据这些要点生成任务吗？请说"生成任务"';
            }
            
            addAI(reply);

            // 若用户同时输入了“生成任务”指令，则直接基于本次文件的要点生成并导入任务
            const wantsTasks = /生成任务|创建任务|任务列表/.test((userText || '').toLowerCase());
            if (wantsTasks && points.length > 0) {
                addAI('🔄 正在根据文件要点生成任务...');
                try {
                    const taskRes = await fetch('http://localhost:8000/api/v1/task/generate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ session_id: currentSession?.id, key_points: points })
                    });
                    const taskData = await taskRes.json();
                    const tasks = taskData.data?.tasks || taskData.tasks || [];
                    removeLastAI();
                    if (tasks.length === 0) {
                        addAI('暂时没有生成任务，请提供更具体的内容。');
                    } else {
                        addTasksToList(tasks);
                        let genReply = '✅ **已生成并导入 ' + tasks.length + ' 个任务：**\n\n';
                        tasks.forEach((t, i) => {
                            genReply += `**${i + 1}. ${t.title}**\n`;
                            if (t.priority) genReply += `   优先级: ${t.priority}\n`;
                            if (t.estimated_minutes) genReply += `   预计: ${t.estimated_minutes}分钟\n`;
                            genReply += '\n';
                        });
                        genReply += '👉 已自动添加到任务标签，可直接查看和管理。';
                        addAI(genReply);
                        switchTab('tasks');
                    }
                } catch (e) {
                    removeLastAI();
                    addAI('生成任务失败：' + e.message);
                }
            }
            
            // 如果选中了额外功能，继续处理（任务自动导入）
            const extraFeatures = features.filter(f => f !== 'chat' && f !== 'summary');
            
            if (extraFeatures.length > 0 && points.length > 0) {
                const featureNames = {
                    'plan': '📋 计划建议',
                    'task': '✅ 任务生成',
                    'knowledge': '📚 知识问答'
                };
                
                for (const feature of extraFeatures) {
                    addAI(`🔄 正在生成 **${featureNames[feature]}**...`);
                    
                    try {
                        let extraResult = '';
                        
                        if (feature === 'plan') {
                            extraResult = await planAPI('基于以下要点制定计划：\n' + points.join('\n'));
                        } else if (feature === 'task') {
                            // 直接用要点生成任务
                            const taskRes = await fetch('http://localhost:8000/api/v1/task/generate', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ session_id: currentSession?.id, key_points: points })
                            });
                            const taskData = await taskRes.json();
                            const tasks = taskData.data?.tasks || [];
                            
                            if (tasks.length > 0) {
                                addTasksToList(tasks);
                                extraResult = `已生成并导入 ${tasks.length} 个任务：\n\n`;
                                tasks.forEach((t, i) => {
                                    extraResult += `**${i + 1}. ${t.title}**\n`;
                                    if (t.priority) extraResult += `   优先级: ${t.priority}\n`;
                                    if (t.estimated_minutes) extraResult += `   预计: ${t.estimated_minutes}分钟\n`;
                                });
                            } else {
                                extraResult = '暂时没有生成任务';
                            }
                        } else if (feature === 'knowledge') {
                            extraResult = await knowledgeAPI('基于以下内容回答问题：\n' + points.join('\n') + '\n\n' + (userText || '请详细解释'));
                        }
                        
                        removeLastAI();
                        addAI(`**${featureNames[feature]}**\n\n${extraResult}`);
                        
                    } catch (e) {
                        removeLastAI();
                        addAI(`${featureNames[feature]} 处理失败：${e.message}`);
                    }
                }
            }
            
        } catch (e) {
            removeLastAI();
            addAI('❌ 文件处理失败：' + e.message);
        }
    }
}

// 触发特定功能
async function triggerFunction(type) {
    if (!currentSession) await newChat();
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    if (!text) {
        addAI('请输入内容后再触发功能。');
        return;
    }
    addAI('处理中...');
    try {
        let reply = '';
        if (type === 'summary') {
            reply = await summaryAPI(text);
        } else if (type === 'plan') {
            reply = await planAPI(text);
        } else if (type === 'task') {
            reply = await taskAPI(text);
        } else if (type === 'knowledge') {
            reply = await knowledgeAPI(text);
        } else {
            reply = '未知功能类型: ' + type;
        }
        removeLastAI();
        addAI(reply);
    } catch (e) {
        removeLastAI();
        addAI(type + ' 处理失败：' + e.message);
    }
}

// 显示任务列表
function displayTasks(tasks) {
    if (tasks.length === 0) {
        addAI('暂时没有生成任务，请提供更详细的内容。');
        return;
    }
    
    let reply = '✅ **已生成 ' + tasks.length + ' 个任务：**\n\n';
    tasks.forEach((t, i) => {
        reply += `**${i + 1}. ${t.title}**\n`;
        if (t.priority) reply += `   🔸 优先级: ${t.priority}\n`;
        if (t.estimated_minutes) reply += `   ⏱️ 预计: ${t.estimated_minutes}分钟\n`;
        if (t.dod && t.dod.length > 0) {
            reply += `   ✓ 完成标准: ${t.dod.join('; ')}\n`;
        }
        reply += '\n';
    });
    
    reply += '\n📋 任务已自动添加到任务面板，点击顶部"任务"标签查看管理！';
    
    addAI(reply);
    
    // 自动添加到任务列表
    addTasksFromAI(tasks);
}

// 添加用户消息（带持久化）
function addUser(text, files) {
    addUserMessage(text, files, true);
}

// 添加用户消息到界面
function addUserMessage(text, files, saveToDB = true) {
    const container = document.getElementById('messagesContainer');
    container.querySelector('.welcome-screen')?.remove();
    
    const time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    let filesHtml = '';
    if (files?.length) {
        filesHtml = '<div class="file-attachments">' + files.map(f => '<span class="file-chip">📎 ' + f.name + '</span>').join('') + '</div>';
    }
    
    const div = document.createElement('div');
    div.className = 'message user';
    div.innerHTML = `
        <div class="message-avatar user-avatar">👤</div>
        <div class="message-content">
            <div class="message-header"><span class="message-sender">你</span><span class="message-time">${time}</span></div>
            <div class="message-text">${text || '上传了文件'}</div>
            ${filesHtml}
        </div>
    `;
    container.appendChild(div);
    scrollBottom();
    
    // 保存到数据库（即便纯文件也记录文件名）
    if (saveToDB && currentSession?.id) {
        const fileNote = files?.length ? ' [文件] ' + files.map(f => f.name).join(', ') : '';
        const contentToSave = text || (fileNote ? fileNote : '');
        if (contentToSave) {
            saveMessageToDB(currentSession.id, 'user', contentToSave);
        }
    }
}

// 添加 AI 消息（带持久化）
function addAI(text) {
    addAIMessage(text, true);
}

// 添加 AI 消息到界面
function addAIMessage(text, saveToDB = true) {
    const container = document.getElementById('messagesContainer');
    container.querySelector('.welcome-screen')?.remove();
    
    const time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    
    // Markdown 渲染
    let html = text;
    if (typeof marked !== 'undefined') {
        html = marked.parse(text);
    } else {
        html = text.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    }
    
    const div = document.createElement('div');
    div.className = 'message ai';
    div.innerHTML = `
        <img src="assets/logo.png" alt="AI" class="message-avatar">
        <div class="message-content">
            <div class="message-header"><span class="message-sender">LifeFlow AI</span><span class="message-time">${time}</span></div>
            <div class="message-text markdown-body">${html}</div>
        </div>
    `;
    container.appendChild(div);
    scrollBottom();
    
    // 保存到数据库
    if (saveToDB && currentSession?.id) {
        saveMessageToDB(currentSession.id, 'assistant', text);
    }
}

// 移除最后一条 AI 消息
function removeLastAI() {
    const container = document.getElementById('messagesContainer');
    const msgs = container.querySelectorAll('.message.ai');
    if (msgs.length > 0) {
        msgs[msgs.length - 1].remove();
    }
}

// 处理文件选择
function handleFiles(e) {
    const files = Array.from(e.target.files);
    const preview = document.getElementById('filePreview');
    preview.innerHTML = '';
    
    files.forEach((file, i) => {
        const chip = document.createElement('div');
        chip.className = 'preview-file';
        chip.innerHTML = `<span>📎 ${file.name}</span><span class="remove-file" onclick="removeFile(${i})">×</span>`;
        preview.appendChild(chip);
    });
}

// 移除文件
function removeFile(index) {
    const fileInput = document.getElementById('fileInput');
    const dt = new DataTransfer();
    Array.from(fileInput.files).forEach((f, i) => { if (i !== index) dt.items.add(f); });
    fileInput.files = dt.files;
    handleFiles({ target: fileInput });
}

// 清空对话
function clearChat() {
    if (!confirm('确定清空当前对话？')) return;
    document.getElementById('messagesContainer').innerHTML = '<div class="welcome-screen"><img src="assets/logo.png" alt="LifeFlow" class="welcome-logo"><h1>对话已清空</h1><p>开始新的对话吧</p></div>';
    toast('已清空', 'success');
}

// 导出对话
async function exportChat() {
    if (!currentSession) { toast('没有活动对话', 'error'); return; }
    try {
        // 从数据库获取消息导出
        const res = await fetch(`${DB_API}/api/messages/${currentSession.id}`);
        const data = await res.json();
        const messages = data.data?.messages || [];
        
        const exportData = {
            session_id: currentSession.id,
            exported_at: new Date().toISOString(),
            messages: messages
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'lifeflow-' + currentSession.id.substring(0, 8) + '.json';
        a.click();
        toast('导出成功', 'success');
    } catch (e) { toast('导出失败', 'error'); }
}

// 加载历史 - 从数据库 API 获取
async function loadHistory() {
    try {
        // 从数据库获取有消息的会话
        const res = await fetch(`${DB_API}/api/sessions/with-messages`);
        let sessions = [];
        
        if (res.ok) {
            const data = await res.json();
            sessions = data.success ? (data.data?.sessions || []) : [];
        }
        
        // 同时也获取后端内存中的会话（兼容模式）
        try {
            const backendRes = await fetch('http://localhost:8000/api/v1/session/list');
            const backendData = await backendRes.json();
            const backendSessions = backendData.data?.sessions || [];
            
            // 合并去重
            backendSessions.forEach(bs => {
                const id = bs.session_id || bs.sessionId;
                if (id && !sessions.find(s => (s.session_id || s.sessionId) === id)) {
                    sessions.push(bs);
                }
            });
        } catch (e) {
            console.log('后端会话列表不可用');
        }
        
        const list = document.getElementById('historyList');
        if (!list) return;
        
        list.innerHTML = sessions.length === 0 
            ? '<div style="padding:12px;color:rgba(255,255,255,0.5);font-size:12px;">暂无历史</div>'
            : '';
        
        sessions.forEach(s => {
            const id = s.session_id || s.sessionId;
            if (!id) return;
            // 优先使用第一条消息内容作为名称
            let name = s.first_message || s.session_name || s.name || '';
            // 清理消息内容，移除 markdown 和特殊字符
            name = name.replace(/[#*`\[\]]/g, '').trim();
            // 如果还是空的，使用时间
            if (!name) {
                const date = s.created_at ? new Date(s.created_at) : new Date();
                name = date.toLocaleDateString('zh-CN', {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'});
            }
            // 截断显示
            const displayName = name.length > 16 ? name.substring(0, 16) + '...' : name;
            const item = document.createElement('div');
            item.className = 'history-item';
            item.innerHTML = `
                <span class="history-name" onclick="loadSession('${id}')" title="${name.replace(/"/g, '&quot;')}">💬 ${displayName}</span>
                <button class="history-delete" onclick="deleteSession('${id}', event)" title="删除">×</button>
            `;
            list.appendChild(item);
        });
    } catch (e) { console.error(e); }
}

// 删除会话
async function deleteSession(sessionId, event) {
    if (event) event.stopPropagation();
    
    if (!confirm('确定删除此对话？')) return;
    
    try {
        // 删除数据库中的消息
        await fetch(`${DB_API}/api/messages/${sessionId}`, { method: 'DELETE' });
        
        // 也尝试删除后端会话
        try {
            await fetch(`http://localhost:8000/api/v1/session/${sessionId}`, { method: 'DELETE' });
        } catch (e) {}
        
        toast('对话已删除', 'success');
        loadHistory(); // 刷新列表
        
        // 如果删除的是当前会话，清空界面
        if (currentSession?.id === sessionId) {
            currentSession = null;
            document.getElementById('sessionStatus').textContent = '💬 自由对话';
            document.getElementById('sessionStatus').classList.remove('active');
            document.getElementById('sessionId').textContent = '';
            document.getElementById('messagesContainer').innerHTML = '<div class="welcome-screen"><img src="assets/logo.png" alt="LifeFlow" class="welcome-logo"><h1>对话已删除</h1><p>开始新的对话吧</p></div>';
        }
    } catch (e) {
        toast('删除失败: ' + e.message, 'error');
    }
}

// 加载会话
async function loadSession(id) {
    currentSession = { id };
    document.getElementById('sessionStatus').textContent = '加载中...';
    document.getElementById('sessionStatus').classList.add('active');
    document.getElementById('sessionId').textContent = id.substring(0, 8);
    document.getElementById('messagesContainer').innerHTML = '<div style="text-align:center;padding:40px;color:#888;">正在加载聊天记录...</div>';
    
    // 从数据库加载聊天历史
    await loadChatHistory(id);
    
    // 保存到本地
    saveSession();
    
    toast('加载成功', 'success');
}

// 退出登录
function logout() {
    if (confirm('确定退出？')) {
        localStorage.clear();
        location.href = 'index.html';
    }
}

// 滚动到底部
function scrollBottom() {
    const c = document.getElementById('messagesContainer');
    setTimeout(() => c.scrollTop = c.scrollHeight, 50);
}

// 提示
function toast(msg, type) {
    const t = document.createElement('div');
    t.style.cssText = `position:fixed;top:20px;left:50%;transform:translateX(-50%);padding:12px 24px;background:${type==='success'?'#67c23a':type==='error'?'#f56c6c':'#409eff'};color:#fff;border-radius:4px;z-index:9999;`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2500);
}

// ========== 标签页系统 ==========
function switchTab(tabName) {
    currentTab = tabName;
    
    // 更新标签按钮状态 (仅更新右侧面板的tab按钮)
    document.querySelectorAll('.right-panel-tabs [data-tab]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    // 更新面板显示 (仅更新右侧面板中的tab-panel)
    document.querySelectorAll('.right-panel-content .tab-panel').forEach(panel => {
        panel.classList.remove('active');
    });
    
    const targetPanel = document.getElementById(tabName + 'Panel');
    if (targetPanel) {
        targetPanel.classList.add('active');
    }
    
    // 特定面板初始化
    if (tabName === 'tasks') {
        refreshTaskList();
    } else if (tabName === 'files') {
        refreshFileList();
    } else if (tabName === 'focus') {
        updateFocusDisplay();
        refreshFocusTaskSelect();
    } else if (tabName === 'review') {
        generateReview();
    }
}

// ========== 任务管理 ==========
function loadTasks() {
    const saved = localStorage.getItem('lifeflow_tasks');
    if (saved) {
        taskList = JSON.parse(saved);
    }
}

function saveTasks() {
    localStorage.setItem('lifeflow_tasks', JSON.stringify(taskList));
}

function refreshTaskList(filter = 'all') {
    const container = document.getElementById('taskList');
    if (!container) return;
    
    let filtered = taskList;
    if (filter === 'active') {
        filtered = taskList.filter(t => !t.completed);
    } else if (filter === 'completed') {
        filtered = taskList.filter(t => t.completed);
    }
    
    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span>📋</span>
                <p>暂无任务</p>
                <small>在对话中让AI生成任务，或点击"添加任务"手动创建</small>
            </div>
        `;
    } else {
        container.innerHTML = filtered.map((task, index) => `
            <div class="task-item ${task.completed ? 'completed' : ''}" data-id="${task.id}">
                <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} onchange="toggleTask('${task.id}')">
                <div class="task-content">
                    <div class="task-title">${task.title}</div>
                    <div class="task-meta">
                        <span class="task-priority ${task.priority || 'normal'}">${getPriorityLabel(task.priority)}</span>
                        ${task.estimated_minutes ? `<span>⏱️ ${task.estimated_minutes}分钟</span>` : ''}
                        ${task.createdAt ? `<span>📅 ${formatDate(task.createdAt)}</span>` : ''}
                    </div>
                    ${renderDOD(task)}
                </div>
                <div class="task-actions">
                    <button class="task-action-btn expand-btn" onclick="toggleTaskExpand('${task.id}')" title="展开详情">▼</button>
                    <button class="task-action-btn" onclick="editTask('${task.id}')" title="编辑">✏️</button>
                    <button class="task-action-btn" onclick="deleteTask('${task.id}')" title="删除">🗑️</button>
                </div>
            </div>
        `).join('');
    }
    
    // 更新统计
    updateTaskStats();
}

// 渲染 DOD (完成标准)
function renderDOD(task) {
    if (!task.dod || task.dod.length === 0) return '';
    
    const dodItems = Array.isArray(task.dod) ? task.dod : [task.dod];
    const completedCount = dodItems.filter(d => d.completed).length;
    const progress = Math.round((completedCount / dodItems.length) * 100);
    
    return `
        <div class="task-dod" id="dod-${task.id}">
            <div class="dod-header">
                <span class="dod-label">📋 完成标准 (${completedCount}/${dodItems.length})</span>
                <div class="dod-progress-bar">
                    <div class="dod-progress" style="width: ${progress}%"></div>
                </div>
            </div>
            <ul class="dod-list">
                ${dodItems.map((dod, i) => `
                    <li class="dod-item ${dod.completed ? 'done' : ''}" onclick="toggleDOD('${task.id}', ${i})">
                        <span class="dod-check">${dod.completed ? '✓' : '○'}</span>
                        <span class="dod-text">${typeof dod === 'string' ? dod : dod.text}</span>
                    </li>
                `).join('')}
            </ul>
        </div>
    `;
}

// 切换 DOD 项完成状态
function toggleDOD(taskId, dodIndex) {
    const task = taskList.find(t => t.id === taskId);
    if (!task || !task.dod) return;
    
    if (typeof task.dod[dodIndex] === 'string') {
        // 转换为对象格式
        task.dod[dodIndex] = { text: task.dod[dodIndex], completed: true };
    } else {
        task.dod[dodIndex].completed = !task.dod[dodIndex].completed;
    }
    
    // 检查是否所有 DOD 都完成
    const allDone = task.dod.every(d => typeof d === 'string' ? false : d.completed);
    if (allDone && !task.completed) {
        toast('所有完成标准已达成！是否标记任务完成？', 'success');
    }
    
    saveTasks();
    refreshTaskList();
}

// 切换任务展开/收起
function toggleTaskExpand(taskId) {
    const dodEl = document.getElementById(`dod-${taskId}`);
    if (dodEl) {
        dodEl.classList.toggle('expanded');
        const btn = document.querySelector(`[data-id="${taskId}"] .expand-btn`);
        if (btn) {
            btn.textContent = dodEl.classList.contains('expanded') ? '▲' : '▼';
        }
    }
}

function getPriorityLabel(priority) {
    const labels = { high: '高优先级', normal: '普通', low: '低优先级' };
    return labels[priority] || '普通';
}

function formatDate(dateStr) {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
}

function updateTaskStats() {
    const total = taskList.length;
    const completed = taskList.filter(t => t.completed).length;
    const active = total - completed;
    
    const statsEl = document.getElementById('taskStats');
    if (statsEl) {
        statsEl.innerHTML = `
            总计: <strong>${total}</strong> | 
            待完成: <strong>${active}</strong> | 
            已完成: <strong>${completed}</strong>
        `;
    }
}

function filterTasks(filter) {
    // 更新筛选按钮状态
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    refreshTaskList(filter);
}

function toggleTask(taskId) {
    const task = taskList.find(t => t.id === taskId);
    if (task) {
        task.completed = !task.completed;
        task.completedAt = task.completed ? new Date().toISOString() : null;
        saveTasks();
        refreshTaskList();
        
        if (task.completed) {
            toast('任务完成！🎉', 'success');
        }
    }
}

function deleteTask(taskId) {
    if (!confirm('确定删除此任务？')) return;
    taskList = taskList.filter(t => t.id !== taskId);
    saveTasks();
    refreshTaskList();
    toast('任务已删除', 'success');
}

function editTask(taskId) {
    const task = taskList.find(t => t.id === taskId);
    if (!task) return;
    
    const newTitle = prompt('编辑任务标题:', task.title);
    if (newTitle && newTitle.trim()) {
        task.title = newTitle.trim();
        saveTasks();
        refreshTaskList();
        toast('任务已更新', 'success');
    }
}

// 显示添加任务弹窗
function showAddTaskModal() {
    document.getElementById('addTaskModal').style.display = 'flex';
    document.getElementById('newTaskTitle').value = '';
    document.getElementById('newTaskPriority').value = 'normal';
    document.getElementById('newTaskDuration').value = '30';
    document.getElementById('newTaskTitle').focus();
}

// 关闭弹窗
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// 保存新任务
function saveNewTask() {
    const title = document.getElementById('newTaskTitle').value.trim();
    const priority = document.getElementById('newTaskPriority').value;
    const duration = parseInt(document.getElementById('newTaskDuration').value) || 30;
    
    if (!title) {
        toast('请输入任务标题', 'error');
        return;
    }
    
    const newTask = {
        id: 'task_' + Date.now(),
        title: title,
        priority: priority,
        estimated_minutes: duration,
        completed: false,
        createdAt: new Date().toISOString()
    };
    
    taskList.unshift(newTask);
    saveTasks();
    refreshTaskList();
    closeModal('addTaskModal');
    toast('任务已添加', 'success');
}

// 从AI生成的任务添加到列表
function addTasksFromAI(tasks) {
    tasks.forEach(t => {
        // 转换优先级格式
        let priority = 'normal';
        if (t.priority === 'P0' || t.priority === 'high') priority = 'high';
        else if (t.priority === 'P2' || t.priority === 'low') priority = 'low';
        
        const newTask = {
            id: 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            title: t.title,
            priority: priority,
            estimated_minutes: t.estimated_minutes || 30,
            dod: t.dod || [],
            completed: false,
            createdAt: new Date().toISOString(),
            fromAI: true
        };
        taskList.push(newTask);
    });
    saveTasks();
    refreshTaskList(); // 刷新任务列表显示
    toast(`✅ 已添加 ${tasks.length} 个任务`, 'success');
}

// 清空已完成任务
function clearCompletedTasks() {
    const completed = taskList.filter(t => t.completed).length;
    if (completed === 0) {
        toast('没有已完成的任务', 'info');
        return;
    }
    if (!confirm(`确定清空 ${completed} 个已完成任务？`)) return;
    taskList = taskList.filter(t => !t.completed);
    saveTasks();
    refreshTaskList();
    toast('已清空完成的任务', 'success');
}

// ========== 专注模式 ==========
let lastActivityTime = Date.now();
let activityCheckInterval = null;
let focusStartTime = 0;
let totalFocusDuration = focusTimeLeft; // 初始化总专注时长为当前剩余时间

// 专注质量统计
let focusQuality = {
    activeTime: 0,      // 活跃时间（秒）
    warningCount: 0,    // 警告次数
    inactiveCount: 0,   // 不活跃次数
    lastStatus: 'idle'  // 上次状态
};

// 活动检测配置
const ACTIVITY_CONFIG = {
    WARNING_THRESHOLD: 20000,   // 20秒无活动 → 警告
    INACTIVE_THRESHOLD: 45000,  // 45秒无活动 → 不活跃
    CHECK_INTERVAL: 3000,       // 每3秒检查一次
    MOUSE_MOVE_THROTTLE: 500    // 鼠标移动节流
};

let lastMouseMoveTime = 0;

function loadFocusStats() {
    const stats = localStorage.getItem('lifeflow_focus_stats');
    if (stats) {
        const data = JSON.parse(stats);
        focusSessions = data.sessions || 0;
        totalFocusTime = data.totalTime || 0;
    }
    
    // 加载 ESP32 IP
    esp32IP = localStorage.getItem('lifeflow_esp32_ip') || '';
    const ipInput = document.getElementById('esp32IP');
    if (ipInput && esp32IP) ipInput.value = esp32IP;
    
    updateFocusStats();
    
    // 初始化活动监听
    initActivityTracking();
}

// 初始化活动追踪
function initActivityTracking() {
    // 键盘活动 - 最重要的专注指标
    document.addEventListener('keydown', () => {
        recordActivity('keyboard');
    }, { passive: true });
    
    // 鼠标点击 - 重要的交互指标
    document.addEventListener('click', () => {
        recordActivity('click');
    }, { passive: true });
    
    // 鼠标移动 - 节流处理，防止过于频繁
    document.addEventListener('mousemove', () => {
        const now = Date.now();
        if (now - lastMouseMoveTime > ACTIVITY_CONFIG.MOUSE_MOVE_THROTTLE) {
            lastMouseMoveTime = now;
            recordActivity('mouse');
        }
    }, { passive: true });
    
    // 滚动 - 表示正在阅读
    document.addEventListener('scroll', () => {
        recordActivity('scroll');
    }, { passive: true });
    
    // 触摸（移动端）
    document.addEventListener('touchstart', () => {
        recordActivity('touch');
    }, { passive: true });
    
    // 窗口焦点变化
    window.addEventListener('focus', () => {
        if (focusRunning) {
            recordActivity('window_focus');
            console.log('窗口获得焦点');
        }
    });
    
    window.addEventListener('blur', () => {
        if (focusRunning) {
            // 用户切换到其他窗口，可能分心了
            updateFocusIndicator('warning');
            focusQuality.warningCount++;
            console.log('窗口失去焦点 - 可能分心');
        }
    });
    
    // 页面可见性变化
    document.addEventListener('visibilitychange', () => {
        if (focusRunning) {
            if (document.hidden) {
                updateFocusIndicator('inactive');
                focusQuality.inactiveCount++;
                console.log('页面不可见 - 切换标签页');
            } else {
                recordActivity('visibility');
                console.log('页面恢复可见');
            }
        }
    });
}

// 记录用户活动
function recordActivity(type = 'unknown') {
    lastActivityTime = Date.now();
    
    if (focusRunning) {
        // 如果之前是警告或不活跃状态，现在恢复活跃
        if (focusQuality.lastStatus !== 'active') {
            console.log(`活动恢复: ${type}`);
        }
        updateFocusIndicator('active');
    }
}

// 更新专注状态指示器
function updateFocusIndicator(status) {
    const dot = document.querySelector('.indicator-dot');
    const text = document.querySelector('.indicator-text');
    const statusBar = document.getElementById('focusStatusBar');
    
    if (!dot || !text) return;
    
    // 记录状态变化
    if (focusRunning && focusQuality.lastStatus !== status) {
        if (status === 'warning' && focusQuality.lastStatus === 'active') {
            focusQuality.warningCount++;
            playWarningSound();
        } else if (status === 'inactive' && focusQuality.lastStatus !== 'inactive') {
            focusQuality.inactiveCount++;
        }
        focusQuality.lastStatus = status;
    }
    
    dot.className = 'indicator-dot';
    if (statusBar) statusBar.className = 'focus-status-bar';
    
    switch (status) {
        case 'active':
            dot.classList.add('active');
            text.textContent = '专注中 ✓';
            if (statusBar) statusBar.classList.add('status-active');
            break;
        case 'warning':
            dot.classList.add('warning');
            text.textContent = '⚠️ 注意力分散？';
            if (statusBar) statusBar.classList.add('status-warning');
            break;
        case 'inactive':
            dot.classList.add('inactive');
            text.textContent = '❌ 长时间无活动';
            if (statusBar) statusBar.classList.add('status-inactive');
            break;
        case 'paused':
            text.textContent = '⏸️ 已暂停';
            break;
        default:
            text.textContent = '准备开始';
            focusQuality.lastStatus = 'idle';
    }
}

// 播放警告提示音
function playWarningSound() {
    try {
        // 创建一个简短的提示音
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 440; // A4 音符
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
    } catch (e) {
        console.log('无法播放提示音');
    }
}

// 检查专注状态
function checkFocusStatus() {
    if (!focusRunning) return;
    
    const now = Date.now();
    const idleTime = now - lastActivityTime;
    
    // 更新活跃时间统计
    if (idleTime < ACTIVITY_CONFIG.WARNING_THRESHOLD) {
        focusQuality.activeTime += ACTIVITY_CONFIG.CHECK_INTERVAL / 1000;
    }
    
    // 判断专注状态
    if (document.hidden) {
        // 页面不可见
        updateFocusIndicator('inactive');
    } else if (idleTime > ACTIVITY_CONFIG.INACTIVE_THRESHOLD) {
        // 长时间无活动
        updateFocusIndicator('inactive');
    } else if (idleTime > ACTIVITY_CONFIG.WARNING_THRESHOLD) {
        // 短时间无活动，警告
        updateFocusIndicator('warning');
    } else {
        // 活跃状态
        updateFocusIndicator('active');
    }
    
    // 更新专注质量显示
    updateFocusQualityDisplay();
}

// 更新专注质量显示
function updateFocusQualityDisplay() {
    const qualityEl = document.getElementById('focusQuality');
    if (!qualityEl || !focusRunning) return;
    
    const totalTime = (Date.now() - focusStartTime) / 1000;
    const qualityPercent = totalTime > 0 ? Math.round((focusQuality.activeTime / totalTime) * 100) : 100;
    
    let qualityText = '';
    let qualityClass = '';
    
    if (qualityPercent >= 80) {
        qualityText = `🎯 专注度: ${qualityPercent}% 优秀`;
        qualityClass = 'quality-excellent';
    } else if (qualityPercent >= 60) {
        qualityText = `📊 专注度: ${qualityPercent}% 良好`;
        qualityClass = 'quality-good';
    } else {
        qualityText = `⚠️ 专注度: ${qualityPercent}% 需改进`;
        qualityClass = 'quality-poor';
    }
    
    qualityEl.textContent = qualityText;
    qualityEl.className = 'focus-quality ' + qualityClass;
}

// 重置专注质量统计
function resetFocusQuality() {
    focusQuality = {
        activeTime: 0,
        warningCount: 0,
        inactiveCount: 0,
        lastStatus: 'idle'
    };
}

function saveFocusStats() {
    localStorage.setItem('lifeflow_focus_stats', JSON.stringify({
        sessions: focusSessions,
        totalTime: totalFocusTime
    }));
}

function updateFocusDisplay() {
    const display = document.getElementById('timerDisplay');
    if (display) {
        const mins = Math.floor(focusTimeLeft / 60);
        const secs = focusTimeLeft % 60;
        display.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    // 更新进度环和进度条
    updateProgressRing();
    updateProgressBar();
}

function updateProgressRing() {
    const circle = document.getElementById('progressCircle');
    if (!circle) return;
    
    const progress = focusTimeLeft / totalFocusDuration;
    const circumference = 2 * Math.PI * 130; // r=130
    const offset = circumference * (1 - progress);
    
    circle.style.strokeDasharray = circumference;
    circle.style.strokeDashoffset = offset;
}

// 更新进度条
function updateProgressBar() {
    const fill = document.getElementById('progressFill');
    const percent = document.getElementById('progressPercent');
    
    if (!fill || !percent) return;
    
    const progress = 1 - (focusTimeLeft / totalFocusDuration);
    const percentage = Math.round(progress * 100);
    
    fill.style.width = percentage + '%';
    percent.textContent = percentage + '%';
}

function updateTimerFromSettings() {
    if (focusRunning) return;
    const duration = parseInt(document.getElementById('focusDuration')?.value) || 25;
    focusTimeLeft = duration * 60;
    totalFocusDuration = focusTimeLeft;
    updateFocusDisplay();
}

function updateFocusStats() {
    const sessionsEl = document.getElementById('focusSessions');
    const timeEl = document.getElementById('focusTotalTime');
    const streakEl = document.getElementById('focusStreak');
    
    if (sessionsEl) sessionsEl.textContent = focusSessions;
    if (timeEl) timeEl.textContent = Math.round(totalFocusTime / 60);
    if (streakEl) streakEl.textContent = calculateStreak();
}

function calculateStreak() {
    const lastDate = localStorage.getItem('lifeflow_last_focus_date');
    const today = new Date().toDateString();
    
    if (lastDate === today) {
        return parseInt(localStorage.getItem('lifeflow_focus_streak') || '1');
    }
    return 0;
}

function refreshFocusTaskSelect() {
    const select = document.getElementById('focusTaskSelect');
    if (!select) return;
    
    const activeTasks = taskList.filter(t => !t.completed);
    select.innerHTML = '<option value="">-- 选择任务（可选）--</option>';
    activeTasks.forEach(task => {
        select.innerHTML += `<option value="${task.id}">${task.title}</option>`;
    });
}

// 显示当前任务卡片
function showCurrentTask(taskId) {
    const card = document.getElementById('currentTaskCard');
    const titleEl = document.getElementById('currentTaskTitle');
    const priorityEl = document.getElementById('currentTaskPriority');
    const dodEl = document.getElementById('currentTaskDOD');
    
    if (!card) return;
    
    if (!taskId) {
        card.style.display = 'none';
        return;
    }
    
    const task = taskList.find(t => t.id === taskId);
    if (!task) {
        card.style.display = 'none';
        return;
    }
    
    card.style.display = 'block';
    titleEl.textContent = task.title;
    
    // 优先级
    priorityEl.textContent = task.priority === 'high' ? '高优先级' : (task.priority === 'low' ? '低优先级' : '普通');
    priorityEl.className = 'task-priority ' + (task.priority || 'normal');
    
    // DOD
    if (task.dod && task.dod.length > 0) {
        const dodItems = Array.isArray(task.dod) ? task.dod : [task.dod];
        dodEl.innerHTML = dodItems.map(d => {
            const text = typeof d === 'string' ? d : d.text;
            const done = typeof d === 'object' && d.completed;
            return `<div class="dod-item ${done ? 'done' : ''}"><span>${done ? '✓' : '○'}</span> ${text}</div>`;
        }).join('');
    } else {
        dodEl.innerHTML = '<div style="color:#888;">暂无完成标准</div>';
    }
}

function startFocus() {
    if (focusRunning) return;
    
    const duration = parseInt(document.getElementById('focusDuration')?.value) || 25;
    const durationMinutes = duration;
    const totalSeconds = durationMinutes * 60;
    
    // 检查是否是从暂停状态恢复
    if (!focusRunning && focusTimeLeft > 0 && focusTimeLeft < totalSeconds) {
        // 从暂停状态恢复，计算剩余时间对应的开始时间
        focusStartTime = Date.now() - (totalSeconds - focusTimeLeft) * 1000;
    } else {
        // 新的专注会话
        focusTimeLeft = totalSeconds;
        focusStartTime = Date.now();
    }
    
    // 更新总专注时长
    totalFocusDuration = totalSeconds;
    
    lastActivityTime = Date.now();
    focusRunning = true;
    
    // 重置专注质量统计
    resetFocusQuality();
    
    // 显示当前选中的任务
    const selectedTaskId = document.getElementById('focusTaskSelect')?.value;
    showCurrentTask(selectedTaskId);
    
    // 更新专注指示器
    updateFocusIndicator('active');
    
    // 启动活动检测（使用配置的间隔）
    activityCheckInterval = setInterval(checkFocusStatus, ACTIVITY_CONFIG.CHECK_INTERVAL);
    
    // 切换按钮显示
    document.getElementById('startFocusBtn').style.display = 'none';
    document.getElementById('pauseFocusBtn').style.display = 'flex';
    
    updateFocusDisplay();
    
    // 发送 ESP32 信号
    const hardwareCommand = {
        type: focusTimeLeft < totalSeconds ? 'resume' : 'start',
        duration: durationMinutes,
        totalSeconds: totalSeconds,
        remainingSeconds: focusTimeLeft,
        taskId: selectedTaskId || 'no-task-selected', // 如果没有任务ID，使用默认值
        timestamp: Date.now()
    };
    
    // 发送命令到设备
    sendToDevice(hardwareCommand);
    
    focusTimer = setInterval(() => {
        // 使用基于开始时间的计算方法，避免时间偏差
        const elapsed = Math.floor((Date.now() - focusStartTime) / 1000);
        focusTimeLeft = Math.max(0, totalSeconds - elapsed);
        
        updateFocusDisplay();
        
        // 每秒向设备发送一次进度更新，确保OLED同步
        if (isDeviceConnected && focusRunning) {
            const progressPercent = Math.round((elapsed / totalSeconds) * 100);
            sendToDevice({
                type: 'progress',
                remainingSeconds: focusTimeLeft,
                progressPercent: progressPercent,
                elapsedSeconds: elapsed,
                timestamp: Date.now()
            });
        }
        
        if (focusTimeLeft <= 0) {
            completeFocusSession();
        }
    }, 1000);
    
    document.getElementById('timerLabel').textContent = '专注中';
    toast('专注开始！保持专注 💪', 'success');
}

function pauseFocus() {
    // 检查是在专注模式还是休息模式
    const isFocusMode = focusRunning;
    const isBreakMode = breakRunning;
    
    // 如果都不在运行状态，直接返回
    if (!isFocusMode && !isBreakMode) return;
    
    // 清除相应的计时器
    if (isFocusMode) {
        clearInterval(focusTimer);
        clearInterval(activityCheckInterval);
        focusRunning = false;
    } else {
        clearInterval(breakTimer);
        breakRunning = false;
    }
    
    // 更新指示器
    updateFocusIndicator('paused');
    
    // 切换按钮显示
    document.getElementById('startFocusBtn').style.display = 'flex';
    document.getElementById('pauseFocusBtn').style.display = 'none';
    document.getElementById('startFocusBtn').innerHTML = '<span class="btn-icon">▶</span><span>继续</span>';
    
    // 发送 ESP32 暂停信号
    const hardwareCommand = {
        type: isFocusMode ? 'pause' : 'break_pause',
        remainingSeconds: focusTimeLeft,
        timestamp: Date.now()
    };
    
    // 发送命令到设备
    sendToDevice(hardwareCommand);
    
    document.getElementById('timerLabel').textContent = '已暂停';
    toast('已暂停', 'info');
}

function resetFocus() {
    clearInterval(focusTimer);
    clearInterval(breakTimer);
    clearInterval(activityCheckInterval);
    focusRunning = false;
    breakRunning = false;
    
    const duration = parseInt(document.getElementById('focusDuration')?.value) || 25;
    focusTimeLeft = duration * 60;
    totalFocusDuration = focusTimeLeft;
    
    // 隐藏任务卡片
    showCurrentTask(null);
    
    // 重置指示器
    updateFocusIndicator('idle');
    
    // 重置专注质量统计
    resetFocusQuality();
    
    // 重置专注质量显示
    const qualityEl = document.getElementById('focusQuality');
    if (qualityEl) {
        qualityEl.textContent = '';
        qualityEl.className = 'focus-quality';
    }
    
    // 重置进度条
    const fill = document.getElementById('progressFill');
    const percent = document.getElementById('progressPercent');
    if (fill) fill.style.width = '0%';
    if (percent) percent.textContent = '0%';
    
    // 重置按钮显示
    document.getElementById('startFocusBtn').style.display = 'flex';
    document.getElementById('pauseFocusBtn').style.display = 'none';
    document.getElementById('startFocusBtn').innerHTML = '<span class="btn-icon">▶</span><span>开始专注</span>';
    
    // 发送 ESP32 重置信号
    const hardwareCommand = {
        type: 'stop',
        timestamp: Date.now()
    };
    
    // 发送命令到设备
    sendToDevice(hardwareCommand);
    
    updateFocusDisplay();
    document.getElementById('timerLabel').textContent = '准备开始';
    
    // 重置进度环颜色
    const circle = document.getElementById('progressCircle');
    if (circle) circle.classList.remove('break');
}

function completeFocusSession() {
    clearInterval(focusTimer);
    focusRunning = false;
    
    const duration = parseInt(document.getElementById('focusDuration')?.value) || 25;
    
    focusSessions++;
    totalFocusTime += duration * 60;
    saveFocusStats();
    updateFocusStats();
    
    // 计算专注质量
    const totalTime = (Date.now() - focusStartTime) / 1000;
    const qualityPercent = totalTime > 0 ? Math.round((focusQuality.activeTime / totalTime) * 100) : 100;
    
    // 更新连续天数
    localStorage.setItem('lifeflow_last_focus_date', new Date().toDateString());
    const currentStreak = parseInt(localStorage.getItem('lifeflow_focus_streak') || '0');
    localStorage.setItem('lifeflow_focus_streak', (currentStreak + 1).toString());
    
    // 标记关联任务
    const selectedTask = document.getElementById('focusTaskSelect')?.value;
    if (selectedTask) {
        const task = taskList.find(t => t.id === selectedTask);
        if (task) {
            task.focusTime = (task.focusTime || 0) + duration;
            saveTasks();
        }
    }
    
    // 发送 ESP32 完成信号
    const hardwareCommand = {
        type: 'complete',
        timestamp: Date.now()
    };
    
    // 发送命令到设备
    sendToDevice(hardwareCommand);
    
    // 清除活动检测
    clearInterval(activityCheckInterval);
    
    // 播放提示音
    playNotificationSound();
    
    // 显示专注完成报告
    showFocusReport(duration, qualityPercent);
    
    // 进入休息时间
    const breakTime = parseInt(document.getElementById('breakDuration')?.value) || 5;
    focusTimeLeft = breakTime * 60;
    totalFocusDuration = focusTimeLeft;
    updateFocusDisplay();
    document.getElementById('timerLabel').textContent = '休息时间';
    
    // 更新指示器
    updateFocusIndicator('idle');
    
    // 自动开始休息计时
    startBreakTimer();
    
    // 重置按钮
    document.getElementById('startFocusBtn').style.display = 'flex';
    document.getElementById('pauseFocusBtn').style.display = 'none';
    document.getElementById('startFocusBtn').innerHTML = '<span class="btn-icon">▶</span><span>开始休息</span>';
}

// 开始休息计时器
function startBreakTimer() {
    const breakTime = parseInt(document.getElementById('breakDuration')?.value) || 5;
    const totalSeconds = breakTime * 60;
    
    // 如果已经在休息中，直接返回
    if (breakRunning) return;
    
    // 设置休息开始时间
    focusStartTime = Date.now();
    breakRunning = true;
    
    // 更新显示
    document.getElementById('timerLabel').textContent = '休息中';
    
    // 更新按钮显示
    document.getElementById('startFocusBtn').style.display = 'none';
    document.getElementById('pauseFocusBtn').style.display = 'flex';
    
    // 发送 ESP32 休息开始信号
    const hardwareCommand = {
        type: 'break_start',
        duration: breakTime,
        totalSeconds: totalSeconds,
        remainingSeconds: focusTimeLeft,
        timestamp: Date.now()
    };
    sendToDevice(hardwareCommand);
    
    // 启动休息计时器
    breakTimer = setInterval(() => {
        // 使用基于开始时间的计算方法，避免时间偏差
        const elapsed = Math.floor((Date.now() - focusStartTime) / 1000);
        focusTimeLeft = Math.max(0, totalSeconds - elapsed);
        
        updateFocusDisplay();
        
        // 每秒向设备发送一次进度更新，确保OLED同步
        if (isDeviceConnected && breakRunning) {
            const progressPercent = Math.round((elapsed / totalSeconds) * 100);
            sendToDevice({
                type: 'break_progress',
                remainingSeconds: focusTimeLeft,
                progressPercent: progressPercent,
                elapsedSeconds: elapsed,
                timestamp: Date.now()
            });
        }
        
        if (focusTimeLeft <= 0) {
            completeBreakSession();
        }
    }, 1000);
    
    toast('休息开始！放松一下 🎉', 'success');
}

// 完成休息会话
function completeBreakSession() {
    clearInterval(breakTimer);
    breakRunning = false;
    
    // 发送 ESP32 休息完成信号
    const hardwareCommand = {
        type: 'break_complete',
        timestamp: Date.now()
    };
    sendToDevice(hardwareCommand);
    
    // 更新显示
    document.getElementById('timerLabel').textContent = '休息完成';
    
    // 更新进度环颜色为专注模式
    const circle = document.getElementById('progressCircle');
    if (circle) circle.classList.remove('break');
    
    // 重置按钮
    document.getElementById('startFocusBtn').style.display = 'flex';
    document.getElementById('pauseFocusBtn').style.display = 'none';
    document.getElementById('startFocusBtn').innerHTML = '<span class="btn-icon">▶</span><span>开始专注</span>';
    
    // 恢复默认专注时间
    const duration = parseInt(document.getElementById('focusDuration')?.value) || 25;
    focusTimeLeft = duration * 60;
    totalFocusDuration = focusTimeLeft;
    updateFocusDisplay();
    
    toast('休息完成！准备开始新的专注吧 💪', 'success');
}

// 显示专注完成报告
function showFocusReport(duration, qualityPercent) {
    let qualityLevel, qualityEmoji, qualityColor;
    
    if (qualityPercent >= 80) {
        qualityLevel = '优秀';
        qualityEmoji = '🎯';
        qualityColor = '#2f9e44';
    } else if (qualityPercent >= 60) {
        qualityLevel = '良好';
        qualityEmoji = '👍';
        qualityColor = '#f08c00';
    } else {
        qualityLevel = '需改进';
        qualityEmoji = '💪';
        qualityColor = '#e03131';
    }
    
    const message = `
        🎉 专注完成！
        
        ⏱️ 时长: ${duration} 分钟
        ${qualityEmoji} 专注度: ${qualityPercent}% (${qualityLevel})
        ⚠️ 分心次数: ${focusQuality.warningCount}
        
        休息一下吧~
    `.trim().replace(/\n\s+/g, '\n');
    
    toast(message, 'success');
    
    // 重置专注质量显示
    const qualityEl = document.getElementById('focusQuality');
    if (qualityEl) {
        qualityEl.innerHTML = `<span style="color:${qualityColor}">${qualityEmoji} 本次专注度: ${qualityPercent}%</span>`;
    }
}

function playNotificationSound() {
    try {
        // 使用 Web Audio API 播放简单提示音
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.5);
    } catch(e) {
        console.log('无法播放提示音');
    }
}

// ========== ESP32 LED 接口 ==========
async function testESP32Connection() {
    const ipInput = document.getElementById('esp32IP');
    const statusEl = document.getElementById('esp32Status');
    const ip = ipInput?.value.trim();
    
    if (!ip) {
        toast('请输入 ESP32 IP 地址', 'error');
        return;
    }
    
    statusEl.textContent = '连接中...';
    statusEl.className = 'esp32-status';
    
    try {
        const res = await fetch(`http://${ip}/ping`, {
            method: 'GET',
            mode: 'cors',
            timeout: 3000
        });
        
        if (res.ok) {
            esp32Connected = true;
            esp32IP = ip;
            localStorage.setItem('esp32IP', ip);
            statusEl.textContent = '✓ 已连接';
            statusEl.className = 'esp32-status connected';
            toast('ESP32 连接成功！', 'success');
            // 重新建立WebSocket连接
            setupDeviceConnection();
        } else {
            throw new Error('连接失败');
        }
    } catch (e) {
        esp32Connected = false;
        statusEl.textContent = '✗ 连接失败';
        statusEl.className = 'esp32-status error';
        toast('无法连接 ESP32，请检查 IP 和网络', 'error');
    }
}

// sendESP32Command 函数已被弃用，使用 sendToDevice 代替

// ========== 回顾面板 ==========
function generateReview() {
    // 统计数据
    const total = taskList.length;
    const completed = taskList.filter(t => t.completed).length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    // 更新统计卡片
    const statsContainer = document.getElementById('reviewStatsGrid');
    if (statsContainer) {
        statsContainer.innerHTML = `
            <div class="review-stat">
                <span class="stat-icon">📋</span>
                <span class="stat-value">${total}</span>
                <span class="stat-label">总任务</span>
            </div>
            <div class="review-stat">
                <span class="stat-icon">✅</span>
                <span class="stat-value">${completed}</span>
                <span class="stat-label">已完成</span>
            </div>
            <div class="review-stat">
                <span class="stat-icon">🎯</span>
                <span class="stat-value">${completionRate}%</span>
                <span class="stat-label">完成率</span>
            </div>
            <div class="review-stat">
                <span class="stat-icon">⏱️</span>
                <span class="stat-value">${focusSessions}</span>
                <span class="stat-label">专注次数</span>
            </div>
        `;
    }
    
    // 显示保存的要点
    const keyPointsContainer = document.getElementById('keyPointsList');
    if (keyPointsContainer && currentSession?.lastKeyPoints?.length > 0) {
        keyPointsContainer.innerHTML = currentSession.lastKeyPoints.map((point, i) => `
            <div class="key-point-item">
                <span>${i + 1}.</span>
                <span>${point}</span>
            </div>
        `).join('');
    } else if (keyPointsContainer) {
        keyPointsContainer.innerHTML = '<p class="placeholder">上传文档后，AI提取的要点将显示在这里</p>';
    }
}

// AI 生成回顾总结
async function generateAISummary() {
    const summaryContainer = document.getElementById('aiSummaryContent');
    if (!summaryContainer) return;
    
    summaryContainer.innerHTML = '<p>正在生成AI总结...</p>';
    
    try {
        // 收集数据
        const completed = taskList.filter(t => t.completed);
        const pending = taskList.filter(t => !t.completed);
        
        const prompt = `请帮我总结今天的工作情况：
已完成任务 ${completed.length} 个：${completed.map(t => t.title).join('、') || '无'}
待完成任务 ${pending.length} 个：${pending.map(t => t.title).join('、') || '无'}
专注次数：${focusSessions} 次
总专注时间：${Math.round(totalFocusTime / 60)} 分钟

请给出：1. 今日工作总结 2. 完成情况评价 3. 明日建议`;

        const res = await fetch('http://localhost:8000/api/v1/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: prompt, session_id: currentSession?.id })
        });
        
        const data = await res.json();
        const reply = data.data?.reply || '无法生成总结';
        
        // 渲染 Markdown
        let html = reply;
        if (typeof marked !== 'undefined') {
            html = marked.parse(reply);
        } else {
            html = reply.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        }
        
        summaryContainer.innerHTML = html;
        
    } catch (e) {
        summaryContainer.innerHTML = '<p class="placeholder">生成总结失败：' + e.message + '</p>';
    }
}

// 导出回顾报告（显示在页面而不是下载）
function exportReview() {
    const completed = taskList.filter(t => t.completed);
    const pending = taskList.filter(t => !t.completed);
    const completionRate = taskList.length > 0 ? Math.round((completed.length / taskList.length) * 100) : 0;
    
    const report = `
# LifeFlow 工作回顾报告

**生成时间：** ${new Date().toLocaleString('zh-CN')}

## 📊 统计概览
- 总任务数：${taskList.length}
- 已完成：${completed.length}
- 待完成：${pending.length}
- 完成率：${completionRate}%
- 专注次数：${focusSessions}
- 总专注时间：${Math.round(totalFocusTime / 60)} 分钟

## ✅ 已完成任务
${completed.length > 0 ? completed.map((t, i) => `${i + 1}. ${t.title}`).join('\n') : '暂无'}

## 📋 待完成任务
${pending.length > 0 ? pending.map((t, i) => `${i + 1}. ${t.title} (${getPriorityLabel(t.priority)})`).join('\n') : '暂无'}

## 📝 关键要点
${currentSession?.lastKeyPoints?.length > 0 ? currentSession.lastKeyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n') : '暂无'}
    `.trim();
    
    // 显示在弹窗中
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px; max-height: 80vh; overflow-y: auto;">
            <div class="modal-header">
                <h3>📊 回顾报告</h3>
                <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
            </div>
            <div class="modal-body">
                <pre style="white-space: pre-wrap; font-size: 14px; line-height: 1.6;">${report}</pre>
            </div>
            <div class="modal-footer">
                <button class="btn secondary" onclick="this.closest('.modal').remove()">关闭</button>
                <button class="btn primary" onclick="copyReport()">复制报告</button>
                <button class="btn primary" onclick="downloadReport()">下载文件</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // 保存报告内容供复制/下载
    window.currentReport = report;
}

function copyReport() {
    if (window.currentReport) {
        navigator.clipboard.writeText(window.currentReport);
        toast('已复制到剪贴板', 'success');
    }
}

function downloadReport() {
    if (window.currentReport) {
        const blob = new Blob([window.currentReport], { type: 'text/markdown' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `lifeflow-review-${new Date().toISOString().split('T')[0]}.md`;
        a.click();
        toast('下载成功', 'success');
    }
}

// ========== 文件历史管理 ==========
function saveFileToHistory(file, summary) {
    const fileHistory = JSON.parse(localStorage.getItem('fileHistory') || '[]');
    
    const fileRecord = {
        id: 'file-' + Date.now(),
        name: file.name,
        size: file.size,
        type: file.type,
        uploadTime: new Date().toISOString(),
        sessionId: currentSession?.id,
        summary: summary || {}
    };
    
    fileHistory.unshift(fileRecord); // 新文件放在最前面
    
    // 只保留最近50个文件
    if (fileHistory.length > 50) {
        fileHistory.splice(50);
    }
    
    localStorage.setItem('fileHistory', JSON.stringify(fileHistory));
    
    // 如果当前在文件面板，刷新列表
    if (currentTab === 'files') {
        refreshFileList();
    }
}

function refreshFileList() {
    const fileHistory = JSON.parse(localStorage.getItem('fileHistory') || '[]');
    const container = document.getElementById('fileHistoryList');
    
    if (fileHistory.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span>📂</span>
                <p>暂无上传记录</p>
                <small>上传文档后会显示在这里</small>
            </div>
        `;
        return;
    }
    
    container.innerHTML = fileHistory.map(file => {
        const uploadDate = new Date(file.uploadTime);
        const timeStr = uploadDate.toLocaleString('zh-CN', {
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit'
        });
        
        const sizeStr = formatFileSize(file.size);
        const fileIcon = getFileIcon(file.name);
        
        return `
            <div class="file-history-item" onclick="showFileDetail('${file.id}')">
                <div class="file-history-item-header">
                    <div class="file-history-name">
                        <span>${fileIcon}</span>
                        <span>${file.name}</span>
                    </div>
                    <span class="file-history-size">${sizeStr}</span>
                </div>
                <div class="file-history-info">
                    <span class="file-history-time">${timeStr}</span>
                    <div class="file-history-actions" onclick="event.stopPropagation()">
                        <button class="file-action-btn" onclick="viewFileSummary('${file.id}')">查看摘要</button>
                        <button class="file-action-btn" onclick="deleteFileRecord('${file.id}')">删除</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const iconMap = {
        'pdf': '📕',
        'doc': '📘',
        'docx': '📘',
        'txt': '📄',
        'md': '📝',
        'xls': '📊',
        'xlsx': '📊',
        'ppt': '📊',
        'pptx': '📊'
    };
    return iconMap[ext] || '📎';
}

function showFileDetail(fileId) {
    const fileHistory = JSON.parse(localStorage.getItem('fileHistory') || '[]');
    const file = fileHistory.find(f => f.id === fileId);
    
    if (!file) return;
    
    viewFileSummary(fileId);
}

function viewFileSummary(fileId) {
    const fileHistory = JSON.parse(localStorage.getItem('fileHistory') || '[]');
    const file = fileHistory.find(f => f.id === fileId);
    
    if (!file) {
        toast('文件记录不存在', 'error');
        return;
    }
    
    const summary = file.summary || {};
    const theme = summary.theme || '无摘要';
    const keyPoints = summary.key_points || [];
    
    let content = `**文件名：** ${file.name}\n\n`;
    content += `**上传时间：** ${new Date(file.uploadTime).toLocaleString('zh-CN')}\n\n`;
    content += `**文件大小：** ${formatFileSize(file.size)}\n\n`;
    
    if (theme !== '无摘要') {
        content += `**核心摘要：**\n${theme}\n\n`;
    }
    
    if (keyPoints.length > 0) {
        content += `**关键要点：**\n`;
        keyPoints.forEach((p, i) => {
            const point = p.point || p.content || p;
            content += `${i + 1}. ${point}\n`;
        });
    }
    
    // 在对话区域显示
    addAI(content);
    
    // 关闭弹窗（如果有）
    document.querySelectorAll('.modal').forEach(m => m.remove());
}

function deleteFileRecord(fileId) {
    if (!confirm('确定删除此文件记录？')) return;
    
    const fileHistory = JSON.parse(localStorage.getItem('fileHistory') || '[]');
    const newHistory = fileHistory.filter(f => f.id !== fileId);
    
    localStorage.setItem('fileHistory', JSON.stringify(newHistory));
    refreshFileList();
    toast('已删除', 'success');
}

function clearFileHistory() {
    if (!confirm('确定清空所有文件历史记录？')) return;
    
    localStorage.removeItem('fileHistory');
    refreshFileList();
    toast('已清空文件历史', 'success');
}
