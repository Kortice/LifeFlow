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
    if (!focusRunning) return;
    
    clearInterval(focusTimer);
    clearInterval(activityCheckInterval);
    focusRunning = false;
    
    // 更新指示器
    updateFocusIndicator('paused');
    
    // 切换按钮显示
    document.getElementById('startFocusBtn').style.display = 'flex';
    document.getElementById('pauseFocusBtn').style.display = 'none';
    document.getElementById('startFocusBtn').innerHTML = '<span class="btn-icon">▶</span><span>继续</span>';
    
    // 发送 ESP32 暂停信号
    const hardwareCommand = {
        type: 'pause',
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
    clearInterval(activityCheckInterval);
    focusRunning = false;
    
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
    
    // 修改进度环颜色为休息模式
    const circle = document.getElementById('progressCircle');
    if (circle) circle.classList.add('break');
    
    // 重置按钮
    document.getElementById('startFocusBtn').style.display = 'flex';
    document.getElementById('pauseFocusBtn').style.display = 'none';
    document.getElementById('startFocusBtn').innerHTML = '<span class="btn-icon">▶</span><span>开始休息</span>';
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