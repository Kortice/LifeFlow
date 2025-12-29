// API 基础配置和请求封装
const API_BASE_URL = 'http://localhost:8000/api/v1';

// 简化模式 - Python 后端不需要认证
const USE_AUTH = false;

// 获取 token
function getToken() {
    return localStorage.getItem('token') || 'demo-token';
}

// 设置 token
function setToken(token) {
    localStorage.setItem('token', token);
}

// 清除 token
function clearToken() {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('userId');
}

// 获取用户信息
function getUserInfo() {
    return {
        username: localStorage.getItem('username') || 'Demo User',
        userId: localStorage.getItem('userId') || 'demo_001',
        token: localStorage.getItem('token') || 'demo-token'
    };
}

// 设置用户信息
function setUserInfo(user) {
    if (user.username) localStorage.setItem('username', user.username);
    if (user.userId) localStorage.setItem('userId', user.userId);
    if (user.token) localStorage.setItem('token', user.token);
}

// 通用请求函数
async function apiRequest(endpoint, options = {}) {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };
    
    if (token) {
        headers['X-User-Token'] = token;
    }
    
    const config = {
        ...options,
        headers
    };
    
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
        
        // 检查响应状态
        if (response.status === 401) {
            // 未授权，清除token并跳转登录
            clearToken();
            if (window.location.pathname !== '/index.html' && window.location.pathname !== '/') {
                window.location.href = 'index.html';
            }
            throw new Error('未授权，请重新登录');
        }
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || '请求失败');
        }
        
        return data;
    } catch (error) {
        console.error('API请求错误:', error);
        throw error;
    }
}

// API 方法
const API = {
    // 认证相关（简化模式）
    auth: {
        register: (username, password, email = '') => {
            // 直接返回成功
            return Promise.resolve({
                code: 0,
                message: 'success',
                data: {
                    token: 'demo-token',
                    username: username,
                    userId: 'demo_001'
                }
            });
        },
        
        login: (username, password) => {
            // 直接返回成功
            return Promise.resolve({
                code: 0,
                message: 'success',
                data: {
                    token: 'demo-token',
                    username: username,
                    userId: 'demo_001'
                }
            });
        }
    },
    
    // 会话相关
    sessions: {
        create: (isPersistent = true) => {
            return apiRequest('/session/create', {
                method: 'POST',
                body: JSON.stringify({ 
                    session_name: `LifeFlow Session ${new Date().toLocaleString('zh-CN')}`,
                    memory_only: !isPersistent 
                })
            });
        },
        
        getInfo: (sessionId) => {
            return apiRequest(`/session/${sessionId}`, {
                method: 'GET'
            });
        },
        
        clear: (sessionId) => {
            return apiRequest(`/session/${sessionId}/clear`, {
                method: 'POST'
            });
        },
        
        list: () => {
            return apiRequest('/session/list', {
                method: 'GET'
            });
        }
    },
    
    // Agent 相关（使用 Python 后端的智能体）
    agent: {
        execute: (sessionId, agentTypes, inputText, files = []) => {
            return apiRequest('/agent/execute', {
                method: 'POST',
                body: JSON.stringify({
                    session_id: sessionId,
                    agent_types: agentTypes,
                    input_text: inputText,
                    provider: 'auto'
                })
            });
        }
    },
    
    // 提要相关
    summarize: {
        // 从纯文本提取提要
        fromText: (sessionId, text) => {
            return apiRequest('/summary/from-text', {
                method: 'POST',
                body: JSON.stringify({
                    text: text,
                    session_id: sessionId
                })
            });
        },
        
        // 兼容旧方法名
        summary: (sessionId, text, files = []) => {
            // 如果有文件，使用文件上传；否则使用纯文本
            if (files && files.length > 0) {
                const formData = new FormData();
                formData.append('session_id', sessionId);
                formData.append('text', text);
                
                files.forEach(file => {
                    formData.append('files', file);
                });
                
                return apiRequest('/summary/from-file', {
                    method: 'POST',
                    headers: {},
                    body: formData
                });
            } else {
                return apiRequest('/summary/from-text', {
                    method: 'POST',
                    body: JSON.stringify({
                        text: text,
                        session_id: sessionId
                    })
                });
            }
        },
        
        extract: (sessionId, text, files = []) => {
            return API.summarize.summary(sessionId, text, files);
        }
    },
    
    // 任务相关
    tasks: {
        generate: (sessionId, keyPoints) => {
            return apiRequest('/task/generate', {
                method: 'POST',
                body: JSON.stringify({ 
                    session_id: sessionId,
                    key_points: keyPoints || []
                })
            });
        },
        
        list: (sessionId) => {
            return apiRequest(`/task-plan/${sessionId}/list`, {
                method: 'GET'
            });
        },
        
        update: (taskId, updates) => {
            return apiRequest(`/tasks/${taskId}`, {
                method: 'PUT',
                body: JSON.stringify(updates)
            });
        }
    },
    
    // 专注相关
    focus: {
        start: (taskId, durationMinutes, soundEnabled) => {
            return apiRequest('/focus/start', {
                method: 'POST',
                body: JSON.stringify({ taskId, durationMinutes, soundEnabled })
            });
        },
        
        updateProgress: (focusId, progressPct) => {
            return apiRequest('/focus/progress', {
                method: 'POST',
                body: JSON.stringify({ focusId, progressPct })
            });
        },
        
        getStatus: (focusId) => {
            return apiRequest(`/focus/status?focusId=${focusId}`, {
                method: 'GET'
            });
        },
        
        stop: (focusId) => {
            return apiRequest(`/focus/${focusId}/stop`, {
                method: 'POST'
            });
        }
    },
    
    // 导出相关
    export: {
        session: (sessionId) => {
            return apiRequest(`/session/${sessionId}/export`, {
                method: 'GET'
            });
        }
    }
};

// 文件上传封装（带进度）
async function uploadWithProgress(sessionId, file, onProgress) {
    const formData = new FormData();
    formData.append('file', file);
    if (sessionId) {
        formData.append('session_id', sessionId);
    }
    
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable && onProgress) {
                const percentComplete = (e.loaded / e.total) * 100;
                onProgress(percentComplete);
            }
        });
        
        xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const data = JSON.parse(xhr.responseText);
                    resolve(data);
                } catch (error) {
                    reject(new Error('解析响应失败'));
                }
            } else {
                reject(new Error(`请求失败: ${xhr.status}`));
            }
        });
        
        xhr.addEventListener('error', () => {
            reject(new Error('网络错误'));
        });
        
        xhr.open('POST', `${API_BASE_URL}/summary/from-file`);
        
        const token = getToken();
        if (token) {
            xhr.setRequestHeader('X-User-Token', token);
        }
        
        xhr.send(formData);
    });
}
