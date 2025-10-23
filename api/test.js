// Vercel Serverless Function - Test Proxy
// 用于中转手动测试请求到后端服务器

export default async function handler(req, res) {
  // 从环境变量获取后端服务器地址
  const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';

  // 设置CORS头
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // 处理OPTIONS预检请求
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 只允许POST请求
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    // 构造后端URL
    const backendUrl = `${BACKEND_URL}/api/test`;

    // 发起请求到后端
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // 获取响应数据
    const data = await response.json();

    // 返回响应
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Test API Proxy Error:', error);
    res.status(500).json({
      success: false,
      error: '无法连接到后端服务器',
      message: error.message
    });
  }
}
