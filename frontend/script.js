// API基础路径 - 使用相对路径，自动适配Vercel部署
const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3000'
  : '';

// DOM 元素
const refreshBtn = document.getElementById('refreshBtn');
const themeToggle = document.getElementById('themeToggle');
const addEndpointBtn = document.getElementById('addEndpointBtn');
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const endpointsGrid = document.getElementById('endpointsGrid');

// 模态弹窗元素
const modal = document.getElementById('addEndpointModal');
const modalClose = document.getElementById('modalClose');
const cancelBtn = document.getElementById('cancelBtn');
const addEndpointForm = document.getElementById('addEndpointForm');

// 统计元素
const totalEndpointsEl = document.getElementById('totalEndpoints');
const onlineEndpointsEl = document.getElementById('onlineEndpoints');
const offlineEndpointsEl = document.getElementById('offlineEndpoints');
const lastUpdateEl = document.getElementById('lastUpdate');

// 主题切换功能
function initTheme() {
    // 从 localStorage 读取保存的主题，默认为浅色
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    const themeIcon = themeToggle.querySelector('.theme-icon');
    themeIcon.textContent = theme === 'dark' ? '🌙' : '☀️';
}

// 获取状态数据（从后端缓存读取）
async function fetchStatus() {
    try {
        showLoading(true);
        hideError();

        const response = await fetch(`${API_BASE}/api/status`);
        if (!response.ok) throw new Error('Failed to fetch status');

        const result = await response.json();
        displayResults(result.data);
        updateStats(result.data);
        lastUpdateEl.textContent = formatTime(new Date(result.timestamp));

        showLoading(false);
    } catch (error) {
        showError(error.message);
        showLoading(false);
    }
}

// 显示结果
function displayResults(data) {
    if (!data || data.length === 0) {
        endpointsGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-secondary);">暂无数据</p>';
        return;
    }

    endpointsGrid.innerHTML = data.map(endpoint => `
        <div class="endpoint-card">
            <div class="endpoint-header">
                <div class="endpoint-name">${escapeHtml(endpoint.name)}</div>
                <span class="status-badge ${endpoint.status}">${getStatusText(endpoint.status)}</span>
            </div>
            <div class="endpoint-url-row">
                <div class="endpoint-url">${escapeHtml(endpoint.apiBase)}</div>
                ${endpoint.status === 'online' && endpoint.inviteLink ? `<a href="${escapeHtml(endpoint.inviteLink)}" target="_blank" class="invite-link" title="点击访问邀请链接">邀请链接</a>` : ''}
            </div>
            <div class="endpoint-metrics">
                <div class="metric">
                    <span class="metric-label">响应时间</span>
                    <span class="metric-value ${getSpeedClass(endpoint.responseTime)}">
                        ${endpoint.responseTime ? endpoint.responseTime + ' ms' : '-'}
                    </span>
                </div>
                <div class="metric">
                    <span class="metric-label">最后检测</span>
                    <span class="metric-value">${endpoint.lastChecked ? formatTime(new Date(endpoint.lastChecked)) : '-'}</span>
                </div>
            </div>
            ${endpoint.error ? `<div class="error-message">错误: ${escapeHtml(endpoint.error)}</div>` : ''}
        </div>
    `).join('');
}

// 更新统计数据
function updateStats(data) {
    const total = data.length;
    const online = data.filter(e => e.status === 'online').length;
    const offline = data.filter(e => e.status === 'offline' || e.status === 'error').length;

    totalEndpointsEl.textContent = total;
    onlineEndpointsEl.textContent = online;
    offlineEndpointsEl.textContent = offline;
}

// 获取状态文本
function getStatusText(status) {
    const statusMap = {
        online: '在线',
        offline: '离线',
        error: '错误',
        testing: '测试中',
        unknown: '未知'
    };
    return statusMap[status] || '未知';
}

// 获取速度类别（统一显示为绿色）
function getSpeedClass(responseTime) {
    // 所有响应时间都显示为绿色
    return responseTime ? 'fast' : '';
}

// 格式化时间
function formatTime(date) {
    return date.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

// HTML 转义
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 显示/隐藏加载状态
function showLoading(show) {
    loadingEl.style.display = show ? 'block' : 'none';
    endpointsGrid.style.display = show ? 'none' : 'grid';
}

// 显示错误
function showError(message) {
    errorEl.textContent = `错误: ${message}`;
    errorEl.style.display = 'block';
}

// 隐藏错误
function hideError() {
    errorEl.style.display = 'none';
}

// 事件监听
refreshBtn.addEventListener('click', () => {
    fetchStatus();
});

themeToggle.addEventListener('click', toggleTheme);

// 模态框事件监听
addEndpointBtn.addEventListener('click', () => {
    modal.classList.add('show');
});

modalClose.addEventListener('click', () => {
    modal.classList.remove('show');
});

cancelBtn.addEventListener('click', () => {
    modal.classList.remove('show');
});

// 点击模态框外部关闭
modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.classList.remove('show');
    }
});

// 表单提交
addEndpointForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = {
        name: document.getElementById('endpointName').value.trim(),
        apiBase: document.getElementById('endpointUrl').value.trim(),
        apiKey: document.getElementById('endpointKey').value.trim(),
        testInterval: parseInt(document.getElementById('endpointInterval').value),
        inviteLink: document.getElementById('endpointInviteLink').value.trim()
    };

    try {
        const response = await fetch(`${API_BASE}/api/endpoint`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const result = await response.json();

        if (result.success) {
            // 关闭模态框
            modal.classList.remove('show');
            // 重置表单
            addEndpointForm.reset();
            // 刷新数据
            fetchStatus();
            alert('端点添加成功！');
        } else {
            alert('添加失败：' + result.error);
        }
    } catch (error) {
        alert('添加失败：' + error.message);
    }
});

// 初始化
initTheme();
fetchStatus();
