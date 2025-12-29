// LifeFlow 登录/注册页面逻辑
// 连接数据库 API 进行用户验证

const DB_API = 'http://localhost:3001';

window.onload = function() {
    // 如果已登录，直接跳转到聊天页
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    const userId = localStorage.getItem('userId');
    if (token && username && userId) {
        window.location.href = 'chat.html';
        return;
    }
    
    // 绑定登录表单
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.onsubmit = handleLogin;
    }
    
    // 绑定注册表单
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.onsubmit = handleRegister;
    }
};

// 登录处理
async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    
    if (!username || !password) {
        showError('请输入用户名和密码');
        return false;
    }
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = '登录中...';
    
    try {
        // 调用数据库 API 验证用户
        const res = await fetch(`${DB_API}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await res.json();
        
        if (res.ok && data.success) {
            // 登录成功，保存用户信息
            localStorage.setItem('token', data.token || data.data?.token);
            localStorage.setItem('username', data.username || data.data?.username);
            localStorage.setItem('userId', data.userId || data.user_id || data.data?.userId);
            
            showSuccess('登录成功！');
            setTimeout(() => {
                window.location.href = 'chat.html';
            }, 500);
        } else {
            showError(data.error || data.message || '用户名或密码错误');
        }
    } catch (err) {
        console.error('登录请求失败:', err);
        showError('连接服务器失败，请检查网络');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '登录';
    }
    
    return false;
}

// 注册处理
async function handleRegister(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email')?.value.trim() || '';
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (!username || !password) {
        showError('请输入用户名和密码');
        return false;
    }
    
    if (username.length < 3) {
        showError('用户名至少3个字符');
        return false;
    }
    
    if (password.length < 6) {
        showError('密码至少6个字符');
        return false;
    }
    
    if (password !== confirmPassword) {
        showError('两次密码不一致');
        return false;
    }
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = '注册中...';
    
    try {
        // 调用数据库 API 注册用户
        const res = await fetch(`${DB_API}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        
        const data = await res.json();
        
        if (res.ok && data.success) {
            // 注册成功，保存用户信息并跳转
            localStorage.setItem('token', data.data?.token || data.token);
            localStorage.setItem('username', data.data?.username || data.username);
            localStorage.setItem('userId', data.data?.userId || data.userId);
            
            showSuccess('注册成功！');
            setTimeout(() => {
                window.location.href = 'chat.html';
            }, 500);
        } else {
            showError(data.error || data.message || '注册失败');
        }
    } catch (err) {
        console.error('注册请求失败:', err);
        showError('连接服务器失败，请检查网络');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '注册';
    }
    
    return false;
}

// 显示错误提示
function showError(msg) {
    removeMessages();
    const div = document.createElement('div');
    div.className = 'auth-message error';
    div.textContent = msg;
    insertMessage(div);
}

// 显示成功提示
function showSuccess(msg) {
    removeMessages();
    const div = document.createElement('div');
    div.className = 'auth-message success';
    div.textContent = msg;
    insertMessage(div);
}

// 插入消息
function insertMessage(div) {
    const form = document.querySelector('.auth-form');
    if (form) {
        form.insertBefore(div, form.firstChild);
    }
}

// 移除所有消息
function removeMessages() {
    document.querySelectorAll('.auth-message').forEach(el => el.remove());
}
