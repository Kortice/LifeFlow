// 工具函数
function showMessage(message, type = 'info') {
    const messageEl = document.createElement('div');
    messageEl.className = `message message-${type}`;
    messageEl.textContent = message;
    messageEl.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        padding: 12px 24px;
        background: ${type === 'success' ? '#67c23a' : type === 'error' ? '#f56c6c' : '#409eff'};
        color: white;
        border-radius: 4px;
        box-shadow: 0 2px 12px rgba(0,0,0,0.15);
        z-index: 2000;
        animation: slideDown 0.3s ease;
    `;
    
    document.body.appendChild(messageEl);
    
    setTimeout(() => {
        messageEl.style.animation = 'slideUp 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(messageEl);
        }, 300);
    }, 3000);
}

// 添加动画样式
if (!document.getElementById('message-animations')) {
    const style = document.createElement('style');
    style.id = 'message-animations';
    style.textContent = `
        @keyframes slideDown {
            from {
                transform: translate(-50%, -100%);
                opacity: 0;
            }
            to {
                transform: translate(-50%, 0);
                opacity: 1;
            }
        }
        @keyframes slideUp {
            from {
                transform: translate(-50%, 0);
                opacity: 1;
            }
            to {
                transform: translate(-50%, -100%);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}

// 格式化时间
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// 格式化日期
function formatDate(date) {
    if (typeof date === 'string') {
        date = new Date(date);
    }
    return date.toLocaleString('zh-CN');
}

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// 防抖函数
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 节流函数
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// 显示确认对话框
function showConfirm(message, onConfirm, onCancel) {
    const modal = document.getElementById('confirmModal');
    const messageEl = document.getElementById('confirmMessage');
    const confirmBtn = document.getElementById('confirmBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    
    messageEl.textContent = message;
    modal.classList.add('show');
    
    const handleConfirm = () => {
        modal.classList.remove('show');
        if (onConfirm) onConfirm();
        cleanup();
    };
    
    const handleCancel = () => {
        modal.classList.remove('show');
        if (onCancel) onCancel();
        cleanup();
    };
    
    const cleanup = () => {
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
    };
    
    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
    
    // 点击背景关闭
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            handleCancel();
        }
    });
}

// Token管理
function getToken() {
    return localStorage.getItem('token');
}

function setToken(token) {
    localStorage.setItem('token', token);
}

function clearToken() {
    localStorage.removeItem('token');
}

// 用户信息管理
function getUserInfo() {
    const username = localStorage.getItem('username');
    const userId = localStorage.getItem('userId');
    if (username && userId) {
        return { username, userId };
    }
    return null;
}

function setUserInfo(username, userId) {
    localStorage.setItem('username', username);
    localStorage.setItem('userId', userId);
}

// 检查登录状态（不自动跳转）
function checkAuth() {
    const token = getToken();
    if (!token) {
        // 自动设置演示账户，不跳转
        localStorage.setItem('token', 'demo-token');
        localStorage.setItem('username', 'Demo User');
        localStorage.setItem('userId', 'demo_001');
    }
    return true;
}

// 更新用户信息显示
function updateUserDisplay() {
    const userInfo = getUserInfo();
    const userInfoEl = document.getElementById('userInfo');
    if (userInfoEl && userInfo) {
        userInfoEl.textContent = `你好，${userInfo.username}`;
    }
}

// 退出登录
function logout() {
    clearToken();
    localStorage.removeItem('userInfo');
    localStorage.removeItem('currentSessionId');
    window.location.href = 'index.html';
}

// 设置退出按钮
function setupLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            showConfirm('确定要退出登录吗？', logout);
        });
    }
}

// 生成唯一ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 深拷贝
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

// 获取当前会话ID
function getCurrentSessionId() {
    return localStorage.getItem('currentSessionId');
}

// 设置当前会话ID
function setCurrentSessionId(sessionId) {
    localStorage.setItem('currentSessionId', sessionId);
}
