// API基础路径 - 使用相对路径，自动适配Vercel部署
const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3000'
  : '';

// DOM 元素
const refreshBtn = document.getElementById('refreshBtn');
const themeToggle = document.getElementById('themeToggle');
const addEndpointBtn = document.getElementById('addEndpointBtn');
const announcementBtn = document.getElementById('announcementBtn');
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const endpointsGrid = document.getElementById('endpointsGrid');
const errorDetailsEl = document.getElementById('errorDetails');

// 模态弹窗元素
const modal = document.getElementById('addEndpointModal');
const modalClose = document.getElementById('modalClose');
const cancelBtn = document.getElementById('cancelBtn');
const addEndpointForm = document.getElementById('addEndpointForm');

// 公告弹窗元素
const announcementModal = document.getElementById('announcementModal');
const announcementModalClose = document.getElementById('announcementModalClose');
const closeAnnouncementBtn = document.getElementById('closeAnnouncementBtn');

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

    // 排序：在线的端点排在前面，其他状态排在后面
    const sortedData = [...data].sort((a, b) => {
        // 在线状态为0，其他状态为1，这样在线的会排在前面
        const statusA = a.status === 'online' ? 0 : 1;
        const statusB = b.status === 'online' ? 0 : 1;

        if (statusA !== statusB) {
            return statusA - statusB;
        }

        // 如果状态相同，按名称排序
        return a.name.localeCompare(b.name);
    });

    endpointsGrid.innerHTML = sortedData.map(endpoint => `
        <div class="endpoint-card">
            <div class="endpoint-header">
                <div class="endpoint-name">${escapeHtml(endpoint.name)}</div>
                <span class="status-badge ${endpoint.status}">${getStatusText(endpoint.status)}</span>
            </div>
            <div class="endpoint-url-row">
                <div class="endpoint-url">${escapeHtml(endpoint.apiBase)}</div>
                ${endpoint.status === 'online' && endpoint.inviteLink ?
                    `<a href="${escapeHtml(endpoint.inviteLink)}" target="_blank" class="invite-link" title="点击访问邀请链接">邀请链接</a>` : ''}
                ${endpoint.error && endpoint.status !== 'online' ?
                    `<span class="error-indicator" onclick="showErrorDetails('${escapeHtml(endpoint.name)}', '${escapeHtml(endpoint.error).replace(/'/g, "\\'")}', event)" title="点击查看错误详情">查看错误</span>` : ''}
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

// 公告弹窗事件监听
announcementBtn.addEventListener('click', () => {
    announcementModal.classList.add('show');
});

announcementModalClose.addEventListener('click', () => {
    announcementModal.classList.remove('show');
});

closeAnnouncementBtn.addEventListener('click', () => {
    announcementModal.classList.remove('show');
});

// 点击公告模态框外部关闭
announcementModal.addEventListener('click', (e) => {
    if (e.target === announcementModal) {
        announcementModal.classList.remove('show');
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

// 显示错误详情浮动框
function showErrorDetails(endpointName, errorMessage, event) {
    if (event) {
        event.stopPropagation();
    }

    errorDetailsEl.innerHTML = `
        <strong>${escapeHtml(endpointName)} - 错误详情</strong><br>
        ${escapeHtml(errorMessage)}
    `;

    // 定位浮动框在点击位置附近
    const rect = event.target.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

    errorDetailsEl.style.left = (rect.left + scrollLeft) + 'px';
    errorDetailsEl.style.top = (rect.bottom + scrollTop + 5) + 'px';
    errorDetailsEl.classList.add('show');
}

// 点击其他地方关闭错误详情浮动框
document.addEventListener('click', (event) => {
    if (!event.target.classList.contains('error-indicator') &&
        !event.target.closest('#errorDetails')) {
        errorDetailsEl.classList.remove('show');
    }
});

// 防止点击浮动框内容时关闭
errorDetailsEl.addEventListener('click', (event) => {
    event.stopPropagation();
});

// 初始化
initTheme();
fetchStatus();
