// 复盘页面逻辑
document.addEventListener('DOMContentLoaded', () => {
    // 检查登录状态
    if (!checkAuth()) return;
    
    // 更新用户信息显示
    updateUserDisplay();
    setupLogout();
    
    // 状态变量
    let currentSessionId = getCurrentSessionId();
    let reviewData = null;
    
    // DOM 元素
    const sessionSelect = document.getElementById('sessionSelect');
    const loadSessionBtn = document.getElementById('loadSessionBtn');
    const totalTasksEl = document.getElementById('totalTasks');
    const completedTasksEl = document.getElementById('completedTasks');
    const completionRateEl = document.getElementById('completionRate');
    const focusCountEl = document.getElementById('focusCount');
    const totalFocusTimeEl = document.getElementById('totalFocusTime');
    const taskReviewListEl = document.getElementById('taskReviewList');
    const focusHistoryListEl = document.getElementById('focusHistoryList');
    const exportReviewBtn = document.getElementById('exportReviewBtn');
    const exportContentEl = document.getElementById('exportContent');
    
    // 初始化
    init();
    
    async function init() {
        await loadSessions();
        if (currentSessionId) {
            await loadReviewData(currentSessionId);
        }
    }
    
    // 加载会话列表
    async function loadSessions() {
        try {
            const response = await API.sessions.list();
            
            if (response.success && response.data.sessions) {
                const sessions = response.data.sessions;
                sessionSelect.innerHTML = '<option value="">-- 当前会话 --</option>';
                
                sessions.forEach(session => {
                    const option = document.createElement('option');
                    option.value = session.sessionId;
                    option.textContent = `会话 ${session.sessionId} (${formatDate(session.createdAt)})`;
                    if (session.sessionId === currentSessionId) {
                        option.selected = true;
                    }
                    sessionSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('加载会话列表失败:', error);
        }
    }
    
    // 加载按钮
    loadSessionBtn.addEventListener('click', async () => {
        const selectedSessionId = sessionSelect.value || currentSessionId;
        if (selectedSessionId) {
            await loadReviewData(selectedSessionId);
        } else {
            showMessage('请选择一个会话', 'info');
        }
    });
    
    // 加载复盘数据
    async function loadReviewData(sessionId) {
        try {
            // 加载任务数据
            const tasksResponse = await API.tasks.list(sessionId);
            const tasks = tasksResponse.success ? tasksResponse.data.tasks : [];
            
            // 模拟加载专注数据（实际应该有专门的API）
            const focusSessions = []; // 这里应该调用实际的API
            
            reviewData = {
                tasks,
                focusSessions
            };
            
            displayReviewData();
        } catch (error) {
            console.error('加载复盘数据失败:', error);
            showMessage('加载复盘数据失败', 'error');
        }
    }
    
    // 显示复盘数据
    function displayReviewData() {
        if (!reviewData) return;
        
        const { tasks, focusSessions } = reviewData;
        
        // 统计数据
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(t => t.isCompleted).length;
        const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        const focusCount = focusSessions.length;
        const totalFocusMinutes = focusSessions.reduce((sum, f) => sum + (f.durationMinutes || 0), 0);
        
        totalTasksEl.textContent = totalTasks;
        completedTasksEl.textContent = completedTasks;
        completionRateEl.textContent = completionRate + '%';
        focusCountEl.textContent = focusCount;
        totalFocusTimeEl.textContent = totalFocusMinutes + ' 分钟';
        
        // 任务完成情况
        taskReviewListEl.innerHTML = '';
        if (tasks.length > 0) {
            tasks.forEach(task => {
                const item = document.createElement('div');
                item.className = 'task-review-item';
                item.innerHTML = `
                    <div>
                        <strong>${task.title}</strong>
                        <div style="font-size: 12px; color: #909399; margin-top: 5px;">
                            优先级: ${task.priority} | DOD: ${task.dod || '无'}
                        </div>
                    </div>
                    <div>
                        <span style="color: ${task.isCompleted ? '#67c23a' : '#909399'};">
                            ${task.isCompleted ? '✓ 已完成' : '○ 未完成'}
                        </span>
                    </div>
                `;
                taskReviewListEl.appendChild(item);
            });
        } else {
            taskReviewListEl.innerHTML = '<p style="text-align: center; color: #909399;">暂无任务数据</p>';
        }
        
        // 专注记录
        focusHistoryListEl.innerHTML = '';
        if (focusSessions.length > 0) {
            focusSessions.forEach(focus => {
                const item = document.createElement('div');
                item.className = 'focus-history-item';
                item.innerHTML = `
                    <div>
                        <strong>任务 ID: ${focus.taskId}</strong>
                        <div style="font-size: 12px; color: #909399; margin-top: 5px;">
                            ${formatDate(focus.startTime)}
                        </div>
                    </div>
                    <div>
                        <span>${focus.durationMinutes} 分钟</span>
                    </div>
                `;
                focusHistoryListEl.appendChild(item);
            });
        } else {
            focusHistoryListEl.innerHTML = '<p style="text-align: center; color: #909399;">暂无专注记录</p>';
        }
    }
    
    // 导出复盘
    exportReviewBtn.addEventListener('click', async () => {
        if (!currentSessionId) {
            showMessage('请先选择一个会话', 'info');
            return;
        }
        
        try {
            const response = await API.export.session(currentSessionId);
            
            if (response.success) {
                exportContentEl.value = response.data.content;
                exportContentEl.style.display = 'block';
                showMessage('复盘内容已生成，可以复制使用', 'success');
            }
        } catch (error) {
            // 如果API不可用，生成本地版本
            const content = generateLocalReview();
            exportContentEl.value = content;
            exportContentEl.style.display = 'block';
            showMessage('复盘内容已生成（本地版本）', 'success');
        }
    });
    
    // 生成本地复盘内容
    function generateLocalReview() {
        if (!reviewData) return '暂无数据';
        
        const { tasks, focusSessions } = reviewData;
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(t => t.isCompleted).length;
        const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        
        let content = `# LifeFlow 会话复盘\n\n`;
        content += `**会话 ID:** ${currentSessionId}\n`;
        content += `**生成时间:** ${new Date().toLocaleString('zh-CN')}\n\n`;
        
        content += `## 统计概览\n\n`;
        content += `- 任务总数: ${totalTasks}\n`;
        content += `- 已完成: ${completedTasks}\n`;
        content += `- 完成率: ${completionRate}%\n`;
        content += `- 番茄次数: ${focusSessions.length}\n`;
        content += `- 总专注时长: ${focusSessions.reduce((sum, f) => sum + (f.durationMinutes || 0), 0)} 分钟\n\n`;
        
        content += `## 任务清单\n\n`;
        if (tasks.length > 0) {
            tasks.forEach((task, index) => {
                content += `### ${index + 1}. ${task.title}\n\n`;
                content += `- **优先级:** ${task.priority}\n`;
                content += `- **状态:** ${task.isCompleted ? '已完成 ✓' : '未完成'}\n`;
                content += `- **DOD:** ${task.dod || '无'}\n\n`;
            });
        } else {
            content += `暂无任务\n\n`;
        }
        
        content += `## 专注记录\n\n`;
        if (focusSessions.length > 0) {
            focusSessions.forEach((focus, index) => {
                content += `${index + 1}. 任务 ${focus.taskId} - ${focus.durationMinutes} 分钟 (${formatDate(focus.startTime)})\n`;
            });
        } else {
            content += `暂无专注记录\n`;
        }
        
        content += `\n---\n`;
        content += `\n*由 LifeFlow 自动生成*\n`;
        
        return content;
    }
});
