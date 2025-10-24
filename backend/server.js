const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const APITester = require('./tester');

const app = express();
const PORT = process.env.PORT || 3000;

// 日志函数
function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

  if (data) {
    console.log(logEntry, data);
  } else {
    console.log(logEntry);
  }
}

// 中间件
app.use(cors());
app.use(express.json());

// 请求日志中间件
app.use((req, res, next) => {
  const startTime = Date.now();

  // 记录请求
  log('info', `${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')?.substring(0, 50)
  });

  // 监听响应结束
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    log('info', `${req.method} ${req.path} - ${res.statusCode}`, {
      duration: `${duration}ms`
    });
  });

  next();
});

// 读取配置文件
const configPath = path.join(__dirname, 'config.json');
let config;
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  log('info', '初始配置文件加载成功', {
    endpoints: config.endpoints.length,
    defaultTestInterval: `${config.defaultTestInterval}分钟`
  });
} catch (error) {
  log('error', '无法读取配置文件', { error: error.message });
  console.error('Failed to read config.json:', error.message);
  process.exit(1);
}

// 初始化测试器（传入配置文件路径）
const tester = new APITester(configPath);

// 启动自动测试（每个端点按自己的间隔独立测试）
tester.startAutoTest();

// API 路由
// 获取所有端点状态
app.get('/api/status', (req, res) => {
  const results = tester.getResults();
  res.json({
    success: true,
    data: results,
    timestamp: new Date().toISOString()
  });
});

// 手动触发测试
app.post('/api/test', async (req, res) => {
  log('info', '收到手动测试请求');

  try {
    const results = await tester.testAllEndpoints();
    res.json({
      success: true,
      data: results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log('error', '手动测试失败', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取配置信息（不返回API密钥）
app.get('/api/config', (req, res) => {
  const safeConfig = {
    endpoints: config.endpoints.map(ep => ({
      name: ep.name,
      apiBase: ep.apiBase
    })),
    testInterval: config.testInterval,
    timeout: config.timeout
  };
  res.json({
    success: true,
    data: safeConfig
  });
});

// 添加新端点
app.post('/api/endpoint', (req, res) => {
  log('info', '收到添加端点请求', req.body);

  try {
    const { name, apiBase, apiKey, testInterval, inviteLink } = req.body;

    // 验证必填字段
    if (!name || !apiBase || !apiKey || !testInterval) {
      return res.status(400).json({
        success: false,
        error: '缺少必填字段'
      });
    }

    // 检查端点名称是否已存在
    if (config.endpoints.some(ep => ep.name === name)) {
      return res.status(400).json({
        success: false,
        error: '端点名称已存在'
      });
    }

    // 创建新端点对象
    const newEndpoint = {
      name,
      apiBase,
      apiKey,
      testInterval: parseInt(testInterval),
      inviteLink: inviteLink || ''
    };

    // 添加到配置
    config.endpoints.push(newEndpoint);

    // 保存到配置文件
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    log('info', '端点已添加并保存到配置文件', { name });

    // 重新加载配置并测试所有端点
    tester.loadConfig();
    tester.testAllEndpoints();

    res.json({
      success: true,
      message: '端点添加成功',
      data: {
        name: newEndpoint.name,
        apiBase: newEndpoint.apiBase,
        testInterval: newEndpoint.testInterval,
        inviteLink: newEndpoint.inviteLink
      }
    });
  } catch (error) {
    log('error', '添加端点失败', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  log('error', '服务器错误', {
    error: err.message,
    stack: err.stack?.substring(0, 200)
  });

  res.status(500).json({
    success: false,
    error: '服务器内部错误'
  });
});

// 启动服务器
app.listen(PORT, () => {
  log('info', '服��器启动成功', {
    port: PORT,
    url: `http://localhost:${PORT}`,
    endpoints: config.endpoints.length
  });
  console.log(`\n========================================`);
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Monitoring ${config.endpoints.length} endpoints with independent test intervals`);
  config.endpoints.forEach(ep => {
    const minutes = ep.testInterval || config.defaultTestInterval || 1;
    console.log(`  - ${ep.name}: every ${minutes} minute(s)`);
  });
  console.log(`========================================\n`);
});
