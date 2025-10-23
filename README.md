# Claude Code API 监控系统

一个用于监控 Claude Code API 公益站点连通性和响应速度的前后端项目。

## 功能特性

- 🔍 使用 Claude CLI 实时监控多个 API 端点的连通性
- ⚡ 检测实际响应时间和速度
- 📊 可视化展示站点状态
- 🔄 自动定时刷新
- 🎨 现代化深色主题界面
- 🧵 多线程并发测试，提高效率

## 前置要求

**必须安装 Claude Code CLI 工具**

确保系统中已安装 `claude` 命令行工具。如果未安装，请访问：
https://docs.claude.com/claude-code

验证安装：
```bash
claude --version
```

## 项目结构

```
CC-router-ping/
├── backend/           # 后端服务
│   ├── server.js      # Express 服务器
│   ├── tester.js      # Claude CLI 测试逻辑
│   ├── config.json    # 配置文件
│   └── package.json   # 依赖配置
└── frontend/          # 前端页面
    ├── index.html     # 主页面
    ├── style.css      # 样式文件
    └── script.js      # 前端逻辑
```

## 工作原理

本系统通过以下方式测试 API 连通性：

1. 为每个端点配置环境变量：
   - `ANTHROPIC_AUTH_TOKEN` - API 密钥
   - `ANTHROPIC_BASE_URL` - API 基础地址

2. 执行命令：`claude --print "请回复'测试成功'"`

3. 分析结果：
   - 如果输出包含 `4xx` 或 `5xx` 错误码 → 标记为离线，返回完整错误信息
   - 如果输出包含"成功"字样 → 标记为在线
   - 其他情况 → 标记为错误

4. 记录从执行命令到收到响应的完整时间作为响应时间参考

## 快速开始

### 1. 安装后端依赖

```bash
cd backend
npm install
```

### 2. 配置 API 端点

编辑 `backend/config.json` 文件，添加你要监控的 API 站点：

```json
{
  "endpoints": [
    {
      "name": "官方API",
      "apiBase": "https://api.anthropic.com",
      "apiKey": "your-api-key-here"
    },
    {
      "name": "公益站1",
      "apiBase": "https://example.com/v1",
      "apiKey": "sk-test-key"
    }
  ],
  "testInterval": 60000,
  "timeout": 10000
}
```

配置说明：
- `name`: 站点名称
- `apiBase`: API 基础地址
- `apiKey`: API 密钥
- `testInterval`: 自动测试间隔（毫秒）
- `timeout`: 请求超时时间（毫秒）

### 3. 启动后端服务

```bash
cd backend
npm start
```

服务将在 `http://localhost:3000` 启动

### 4. 访问前端页面

直接在浏览器中打开 `frontend/index.html` 文件，或使用本地服务器：

```bash
# 使用 Python
cd frontend
python -m http.server 8080

# 或使用 Node.js http-server
npx http-server frontend -p 8080
```

然后访问 `http://localhost:8080`

## API 接口

### GET /api/status
获取所有端点的最新状态

**响应示例：**
```json
{
  "success": true,
  "data": [
    {
      "name": "官方API",
      "apiBase": "https://api.anthropic.com",
      "status": "online",
      "responseTime": 1234,
      "error": null,
      "lastChecked": "2024-01-01T12:00:00.000Z"
    }
  ],
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### POST /api/test
手动触发一次测试

**响应格式：** 与 GET /api/status 相同

### GET /api/config
获取配置信息（不包含 API 密钥）

### GET /health
健康检查接口

## 状态说明

- **在线 (online)**: API 正常响应
- **离线 (offline)**: 无法连接到 API
- **错误 (error)**: 请求返回错误状态码
- **未知 (unknown)**: 尚未测试

## 响应时间评级

- **快速**: < 1000ms (绿色)
- **中等**: 1000-3000ms (黄色)
- **缓慢**: > 3000ms (红色)

## 技术栈

### 后端
- Node.js (内置 child_process 模块)
- Express
- Claude Code CLI (必须)

### 前端
- HTML5
- CSS3 (Modern Grid & Flexbox)
- Vanilla JavaScript (ES6+)

## 开发建议

### 使用 nodemon 自动重启

```bash
npm install -g nodemon
cd backend
npm run dev
```

### 修改端口

设置环境变量 `PORT`:

```bash
PORT=5000 npm start
```

或修改前端 `script.js` 中的 `API_BASE` 常量

## 常见问题

**Q: 为什么显示 CORS 错误？**

A: 确保后端服务已启动，并且前端正确配置了 API 地址

**Q: 如何添加更多监控站点？**

A: 编辑 `backend/config.json`，在 `endpoints` 数组中添加新的站点配置

**Q: 测试请求会消耗 API 额度吗？**

A: 会的，每次测试都会通过 Claude CLI 发送一个真实的 API 请求

**Q: 为什么使用 Claude CLI 而不是直接调用 API？**

A: Claude CLI 方式更接近真实使用场景，可以测试完整的配置流程和环境变量设置

**Q: 测试超时时间是多少？**

A: Claude CLI 默认超时时间为 5 分钟，本系统不强制限制超时，会等待完整响应

**Q: 可以监控其他 API 吗？**

A: 当前代码专门针对 Anthropic Claude API，如需监控其他 API 需修改测试逻辑

## 安全建议

1. 不要将 `config.json` 提交到公开仓库
2. 使用环境变量存储敏感信息
3. 在生产环境中添加身份验证
4. 限制 CORS 允许的来源

## License

MIT
