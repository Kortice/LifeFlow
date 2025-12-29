// 主页面逻辑
document.addEventListener('DOMContentLoaded', () => {
    // 检查登录状态
    if (!checkAuth()) return;
    
    // 更新用户信息显示
    updateUserDisplay();
    setupLogout();
    
    // 状态变量
    let currentSessionId = getCurrentSessionId();
    let selectedFiles = [];
    let currentSummary = null;
    let currentTasks = [];
    
    // DOM 元素
    const sessionIdEl = document.getElementById('currentSessionId');
    const isPersistentCheckbox = document.getElementById('isPersistent');
    const persistentStatusEl = document.getElementById('persistentStatus');
    const newSessionBtn = document.getElementById('newSessionBtn');
    const clearSessionBtn = document.getElementById('clearSessionBtn');
    const exportSessionBtn = document.getElementById('exportSessionBtn');
    
    const textInput = document.getElementById('textInput');
    const fileInput = document.getElementById('fileInput');
    const uploadBtn = document.getElementById('uploadBtn');
    const fileList = document.getElementById('fileList');
    const summarizeBtn = document.getElementById('summarizeBtn');
    
    const summarySection = document.getElementById('summarySection');
    const processingTimeEl = document.getElementById('processingTime');
    const mainThemeEl = document.getElementById('mainTheme');
    const keyPointsListEl = document.getElementById('keyPointsList');
    const generateTasksBtn = document.getElementById('generateTasksBtn');
    
    const todayTop3ListEl = document.getElementById('todayTop3List');
    const taskListEl = document.getElementById('taskList');
    const completionRateEl = document.getElementById('completionRate');
    
    // 初始化
    init();
    
    function init() {
        updateSessionDisplay();
        updatePersistentStatus();
        
        // 如果有会话ID，加载任务
        if (currentSessionId) {
            loadTasks();
        }
    }
    
    // 更新会话显示
    function updateSessionDisplay() {
        sessionIdEl.textContent = currentSessionId || '未创建';
    }
    
    // 更新持久化状态显示
    function updatePersistentStatus() {
        const isPersistent = isPersistentCheckbox.checked;
        persistentStatusEl.textContent = isPersistent ? '数据库保存' : '仅内存保存（不落盘）';
        persistentStatusEl.className = isPersistent ? 'status-badge persistent' : 'status-badge memory-only';
    }
    
    // 持久化选项变更
    isPersistentCheckbox.addEventListener('change', updatePersistentStatus);
    
    // 新建会话
    newSessionBtn.addEventListener('click', async () => {
        try {
            const isPersistent = isPersistentCheckbox.checked;
            const response = await API.sessions.create(isPersistent);
            
            if (response.success) {
                currentSessionId = response.data.sessionId;
                setCurrentSessionId(currentSessionId);
                updateSessionDisplay();
                
                // 清空当前内容
                textInput.value = '';
                selectedFiles = [];
                updateFileList();
                summarySection.style.display = 'none';
                currentTasks = [];
                updateTaskDisplay();
                
                showMessage('新会话创建成功', 'success');
            }
        } catch (error) {
            showMessage(error.message || '创建会话失败', 'error');
        }
    });
    
    // 清空会话
    clearSessionBtn.addEventListener('click', () => {
        if (!currentSessionId) {
            showMessage('当前没有会话', 'info');
            return;
        }
        
        showConfirm(
            '确定要清空当前会话的所有内容吗？此操作不可恢复！',
            async () => {
                try {
                    const response = await API.sessions.clear(currentSessionId);
                    
                    if (response.success) {
                        // 清空显示
                        textInput.value = '';
                        selectedFiles = [];
                        updateFileList();
                        summarySection.style.display = 'none';
                        currentTasks = [];
                        updateTaskDisplay();
                        
                        showMessage('会话已清空', 'success');
                    }
                } catch (error) {
                    showMessage(error.message || '清空会话失败', 'error');
                }
            }
        );
    });
    
    // 导出会话
    exportSessionBtn.addEventListener('click', async () => {
        if (!currentSessionId) {
            showMessage('当前没有会话', 'info');
            return;
        }
        
        try {
            const response = await API.export.session(currentSessionId);
            
            if (response.success) {
                // 创建下载链接
                const blob = new Blob([response.data.content], { type: 'text/markdown' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `LifeFlow_Session_${currentSessionId}.md`;
                a.click();
                URL.revokeObjectURL(url);
                
                showMessage('导出成功', 'success');
            }
        } catch (error) {
            showMessage(error.message || '导出失败', 'error');
        }
    });
    
    // 文件上传
    uploadBtn.addEventListener('click', () => {
        fileInput.click();
    });
    
    fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        selectedFiles.push(...files);
        updateFileList();
        fileInput.value = ''; // 清空input以允许重复选择
    });
    
    // 更新文件列表显示
    function updateFileList() {
        fileList.innerHTML = '';
        
        selectedFiles.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.innerHTML = `
                <div class="file-info">
                    <span class="file-name">${file.name}</span>
                    <span class="file-size">${formatFileSize(file.size)}</span>
                </div>
                <div class="file-progress">
                    <div class="file-progress-bar" style="width: 0%"></div>
                </div>
                <span class="file-remove" data-index="${index}">✕</span>
            `;
            
            // 删除文件
            fileItem.querySelector('.file-remove').addEventListener('click', () => {
                selectedFiles.splice(index, 1);
                updateFileList();
            });
            
            fileList.appendChild(fileItem);
        });
    }
    
    // 文件上传带进度
    async function uploadWithProgress(sessionId, text, files, onProgress) {
        const formData = new FormData();
        formData.append('session_id', sessionId);
        if (text) {
            formData.append('text', text);
        }
        files.forEach(file => {
            formData.append('files', file);
        });
        
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            // 上传进度
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percent = Math.round((e.loaded / e.total) * 100);
                    if (onProgress) onProgress(percent);
                }
            });
            
            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        resolve(response);
                    } catch (error) {
                        reject(new Error('解析响应失败'));
                    }
                } else {
                    reject(new Error('上传失败'));
                }
            });
            
            xhr.addEventListener('error', () => {
                reject(new Error('网络错误'));
            });
            
            const token = localStorage.getItem('token');
            xhr.open('POST', 'http://localhost:3001/api/summarize');
            if (token) {
                xhr.setRequestHeader('X-User-Token', token);
            }
            xhr.send(formData);
        });
    }
    
    // 生成提要
    summarizeBtn.addEventListener('click', async () => {
        const text = textInput.value.trim();
        
        if (!text && selectedFiles.length === 0) {
            showMessage('请输入文本或上传文件', 'info');
            return;
        }
        
        // 创建会话（如果没有）
        if (!currentSessionId) {
            try {
                const isPersistent = isPersistentCheckbox.checked;
                const response = await API.sessions.create(isPersistent);
                if (response.success) {
                    currentSessionId = response.data.sessionId;
                    setCurrentSessionId(currentSessionId);
                    updateSessionDisplay();
                }
            } catch (error) {
                showMessage('创建会话失败', 'error');
                return;
            }
        }
        
        // 禁用按钮
        summarizeBtn.disabled = true;
        summarizeBtn.textContent = '正在生成提要...';
        
        try {
            // 使用带进度的上传
            const response = await uploadWithProgress(
                currentSessionId,
                text,
                selectedFiles,
                (progress) => {
                    // 更新文件进度条
                    const progressBars = fileList.querySelectorAll('.file-progress-bar');
                    progressBars.forEach(bar => {
                        bar.style.width = progress + '%';
                    });
                }
            );
            
            if (response.success) {
                currentSummary = response.data;
                displaySummary(response.data);
                showMessage('提要生成成功', 'success');
            }
        } catch (error) {
            showMessage(error.message || '生成提要失败', 'error');
        } finally {
            summarizeBtn.disabled = false;
            summarizeBtn.textContent = '生成提要';
        }
    });
    
    // 显示提要结果
    function displaySummary(summary) {
        summarySection.style.display = 'block';
        processingTimeEl.textContent = summary.processingTimeMs || 0;
        mainThemeEl.textContent = summary.mainTheme || '暂无主旨';
        
        keyPointsListEl.innerHTML = '';
        if (summary.keyPoints && summary.keyPoints.length > 0) {
            summary.keyPoints.forEach(point => {
                const pointItem = document.createElement('div');
                pointItem.className = 'key-point-item';
                pointItem.innerHTML = `
                    <div class="key-point-content">${point.content}</div>
                    <div class="key-point-confidence">
                        <span>置信度:</span>
                        <div class="confidence-bar">
                            <div class="confidence-fill" style="width: ${point.confidence * 100}%"></div>
                        </div>
                        <span>${(point.confidence * 100).toFixed(0)}%</span>
                    </div>
                `;
                keyPointsListEl.appendChild(pointItem);
            });
        }
    }
    
    // 生成任务
    generateTasksBtn.addEventListener('click', async () => {
        if (!currentSessionId) {
            showMessage('请先创建会话并生成提要', 'info');
            return;
        }
        
        generateTasksBtn.disabled = true;
        generateTasksBtn.textContent = '正在生成任务...';
        
        try {
            const response = await API.tasks.generate(currentSessionId);
            
            if (response.success) {
                currentTasks = response.data.tasks || [];
                updateTaskDisplay();
                showMessage('任务生成成功', 'success');
            }
        } catch (error) {
            showMessage(error.message || '生成任务失败', 'error');
        } finally {
            generateTasksBtn.disabled = false;
            generateTasksBtn.textContent = '生成任务';
        }
    });
    
    // 加载任务
    async function loadTasks() {
        try {
            const response = await API.tasks.list(currentSessionId);
            if (response.success) {
                currentTasks = response.data.tasks || [];
                updateTaskDisplay();
            }
        } catch (error) {
            console.error('加载任务失败:', error);
        }
    }
    
    // 更新任务显示
    function updateTaskDisplay() {
        // 今日三件事
        const top3Tasks = currentTasks.filter(t => t.todayTop3).slice(0, 3);
        todayTop3ListEl.innerHTML = '';
        if (top3Tasks.length > 0) {
            top3Tasks.forEach(task => {
                const item = document.createElement('div');
                item.className = 'top3-item';
                item.textContent = task.title;
                todayTop3ListEl.appendChild(item);
            });
        } else {
            todayTop3ListEl.innerHTML = '<p style="color: #909399; text-align: center;">暂无任务</p>';
        }
        
        // 任务列表
        taskListEl.innerHTML = '';
        if (currentTasks.length > 0) {
            currentTasks.forEach(task => {
                const taskItem = document.createElement('div');
                taskItem.className = `task-item priority-${task.priority} ${task.isCompleted ? 'completed' : ''}`;
                taskItem.innerHTML = `
                    <div class="task-title">
                        <input type="checkbox" ${task.isCompleted ? 'checked' : ''} data-task-id="${task.taskId}">
                        <span>${task.title}</span>
                        <span class="task-priority ${task.priority}">${task.priority}</span>
                    </div>
                    <div class="task-dod">DOD: ${task.dod || '无'}</div>
                `;
                
                // 任务完成切换
                const checkbox = taskItem.querySelector('input[type="checkbox"]');
                checkbox.addEventListener('change', async () => {
                    const taskId = checkbox.getAttribute('data-task-id');
                    const isCompleted = checkbox.checked;
                    
                    try {
                        await API.tasks.update(taskId, { isCompleted });
                        
                        // 更新本地数据
                        const task = currentTasks.find(t => t.taskId === taskId);
                        if (task) {
                            task.isCompleted = isCompleted;
                            updateTaskDisplay();
                        }
                    } catch (error) {
                        showMessage('更新任务失败', 'error');
                        checkbox.checked = !isCompleted; // 恢复状态
                    }
                });
                
                taskListEl.appendChild(taskItem);
            });
        } else {
            taskListEl.innerHTML = '<p style="color: #909399; text-align: center; padding: 20px;">暂无任务</p>';
        }
        
        // 完成率
        updateCompletionRate();
    }
    
    // 更新完成率
    function updateCompletionRate() {
        if (currentTasks.length === 0) {
            completionRateEl.textContent = '0%';
            return;
        }
        
        const completedCount = currentTasks.filter(t => t.isCompleted).length;
        const rate = Math.round((completedCount / currentTasks.length) * 100);
        completionRateEl.textContent = rate + '%';
    }
});
