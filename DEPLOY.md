# Vercel部署指南

本项目前端已改造为Serverless架构，可直接部署到Vercel。

## 项目结构

```
CC-router-ping/
├── api/                # Vercel Serverless Functions (API路由中转)
│   ├── status.js       # 获取状态API
│   ├── endpoint.js     # 添加端点API
│   └── test.js         # 手动测试API
├── frontend/           # 前端静态文件
│   ├── index.html
│   ├── script.js
│   ├── style.css
│   └── logo.png
├── backend/            # 后端服务（部署到独立服务器）
│   ├── server.js
│   ├── tester.js
│   └── config.json
├── vercel.json         # Vercel配置
└── .env.example        # 环境变量示例
```

## 部署步骤

### 1. 准备后端服务器

后端需要部署在独立的服务器上（可以是没有域名的服务器）：

```bash
# 在服务器上
cd backend
npm install
node server.js  # 或使用 pm2 start server.js
```

确保后端服务器运行在某个端口（默认3000），并记录下服务器的IP地址和端口。

### 2. 部署到Vercel

#### 方式一：通过Vercel CLI

```bash
# 安装Vercel CLI
npm install -g vercel

# 登录Vercel
vercel login

# 在项目根目录部署
vercel
```

#### 方式二：通过Vercel网站

1. 访问 [vercel.com](https://vercel.com)
2. 导入你的GitHub仓库
3. Vercel会自动检测项目配置

### 3. 配置环境变量

在Vercel项目设置中添加以下环境变量：

**必需的环境变量：**

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `BACKEND_URL` | 后端服务器地址 | `http://123.45.67.89:3000` |

**配置步骤：**

1. 进入Vercel项目的 Settings
2. 选择 Environment Variables
3. 添加 `BACKEND_URL`，值为你的后端服务器地址（IP:端口）
4. 选择适用的环境（Production, Preview, Development）
5. 保存后重新部署

### 4. 验证部署

部署完成后：

1. 访问Vercel提供的域名
2. 检查页面是否正常加载
3. 检查监控数据是否正常显示
4. 测试添加端点功能

## 架构说明

### API路由中转机制

前端通过Vercel Serverless Functions中转所有后端请求，隐藏后端服务器IP：

```
浏览器 → Vercel (API Functions) → 后端服务器
                ↑
           隐藏后端IP
```

### API路由映射

| 前端请求 | Vercel Function | 后端接口 |
|---------|-----------------|----------|
| `GET /api/status` | `frontend/api/status.js` | `GET http://BACKEND_URL/api/status` |
| `POST /api/endpoint` | `frontend/api/endpoint.js` | `POST http://BACKEND_URL/api/endpoint` |
| `POST /api/test` | `frontend/api/test.js` | `POST http://BACKEND_URL/api/test` |

### 安全性

- ✅ 后端服务器IP不会暴露在浏览器中
- ✅ API请求通过Vercel中转，增加安全层
- ✅ 环境变量保存在Vercel服务端
- ✅ 后端API密钥不会发送到前端

## 本地开发

### 前端开发

直接打开 `frontend/index.html` 或使用本地服务器：

```bash
cd frontend
python -m http.server 8080
# 或
npx serve .
```

### 测试Serverless Functions

使用Vercel CLI在本地测试：

```bash
vercel dev
```

这会在本地启动一个开发服务器，模拟Vercel的Serverless环境。

## 常见问题

### Q: 前端无法连接到后端？

**A:** 检查以下几点：
1. 后端服务器是否正常运行
2. Vercel环境变量 `BACKEND_URL` 是否配置正确
3. 后端服务器防火墙是否允许Vercel的IP访问
4. 后端CORS配置是否正确

### Q: 如何更新后端地址？

**A:**
1. 在Vercel项目设置中更新 `BACKEND_URL` 环境变量
2. 触发重新部署（可以推送新commit或手动触发）

### Q: 本地开发时如何配置？

**A:**
创建 `.env.local` 文件：
```
BACKEND_URL=http://localhost:3000
```

### Q: 后端服务器没有域名可以吗？

**A:** 可以！只需要：
1. 后端服务器有固定IP
2. 在Vercel中配置 `BACKEND_URL=http://IP:PORT`
3. 确保Vercel能访问到你的服务器（检查防火墙）

## 自定义域名

在Vercel项目设置中可以添加自定义域名：

1. Settings → Domains
2. 添加你的域名
3. 按照提示配置DNS记录

## 监控和日志

- **Vercel Dashboard**: 查看部署状态和Serverless Function日志
- **后端日志**: 在后端服务器上查看 `server.js` 的控制台输出

## 成本

- **Vercel**: 免费套餐足够使用（每月100GB带宽，Serverless Functions无限调用）
- **后端服务器**: 需要自行准备服务器资源

## 技术栈

- **前端**: 原生HTML/CSS/JavaScript
- **Serverless**: Vercel Functions (Node.js)
- **后端**: Node.js + Express
- **部署**: Vercel (前端) + 独立服务器 (后端)
