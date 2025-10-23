const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class APITester {
  constructor(configPath) {
    this.configPath = configPath;
    this.config = null;
    this.results = new Map();
    this.testingEndpoints = new Set(); // 记录正在测试的端点名称
    this.timers = new Map(); // 存储每个端点的定时器
  }

  /**
   * 读取配置文件
   */
  loadConfig() {
    try {
      const configData = fs.readFileSync(this.configPath, 'utf-8');
      this.config = JSON.parse(configData);
      this.log('info', '配置文件重新加载成功', {
        endpoints: this.config.endpoints.length
      });
      return true;
    } catch (error) {
      this.log('error', '配置文件读取失败', { error: error.message });
      return false;
    }
  }

  /**
   * 记录日志
   */
  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

    if (data) {
      console.log(logEntry, data);
    } else {
      console.log(logEntry);
    }
  }

  async testEndpoint(endpoint) {
    // 检查该端点是否正在测试中
    if (this.testingEndpoints.has(endpoint.name)) {
      this.log('warn', `端点 ${endpoint.name} 正在测试中，跳过本次请求`);
      // 返回缓存结果或默认值
      return this.results.get(endpoint.name) || {
        name: endpoint.name,
        apiBase: endpoint.apiBase,
        inviteLink: endpoint.inviteLink || '',
        status: 'testing',
        responseTime: null,
        error: '测试进行中',
        lastChecked: new Date().toISOString()
      };
    }

    // 标记该端点正在测试
    this.testingEndpoints.add(endpoint.name);

    const startTime = Date.now();
    const result = {
      name: endpoint.name,
      apiBase: endpoint.apiBase,
      inviteLink: endpoint.inviteLink || '',
      status: 'unknown',
      responseTime: null,
      error: null,
      lastChecked: new Date().toISOString()
    };

    this.log('info', `开始测试端点: ${endpoint.name}`, {
      apiBase: endpoint.apiBase,
      testInterval: `${endpoint.testInterval}分钟`
    });

    try {
      const output = await this.runClaudeCLI(endpoint.apiKey, endpoint.apiBase);
      const responseTime = Date.now() - startTime;
      result.responseTime = responseTime;

      // 检查是否包含 4xx 或 5xx 错误
      const has4xxOr5xx = /[45]\d{2}/.test(output);

      if (has4xxOr5xx) {
        result.status = 'offline';
        result.error = output;
        this.log('error', `端点 ${endpoint.name} 离线 (检测到HTTP错误)`, {
          responseTime: `${responseTime}ms`,
          errorPreview: output.substring(0, 200)
        });
      } else if (output.includes('成功')) {
        result.status = 'online';
        result.error = null;
        this.log('success', `端点 ${endpoint.name} 在线`, {
          responseTime: `${responseTime}ms`
        });
      } else {
        result.status = 'error';
        result.error = '未检测到成功标识';
        this.log('warn', `端点 ${endpoint.name} 响应异常 (未检测到成功标识)`, {
          responseTime: `${responseTime}ms`,
          outputPreview: output.substring(0, 200)
        });
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      result.status = 'offline';
      result.responseTime = responseTime;
      result.error = error.message;
      this.log('error', `端点 ${endpoint.name} 测试失败`, {
        responseTime: `${responseTime}ms`,
        error: error.message
      });
    } finally {
      // 测试完成，移除锁
      this.testingEndpoints.delete(endpoint.name);
      // 更新结果缓存
      this.results.set(result.name, result);
    }

    return result;
  }

  /**
   * 执行 Claude CLI 命令测试连通性
   * @param {string} apiKey - API 密钥
   * @param {string} apiBase - API 基础地址
   * @returns {Promise<string>} 命令输出结果
   */
  runClaudeCLI(apiKey, apiBase) {
    return new Promise((resolve, reject) => {
      this.log('debug', 'Claude CLI 命令执行中...', { apiBase });

      // 设置环境变量
      const env = {
        ...process.env,
        ANTHROPIC_AUTH_TOKEN: apiKey,
        ANTHROPIC_BASE_URL: apiBase
      };

      // 启动子进程执行 claude 命令
      // 修复1: 使用双引号，Windows shell 兼容性更好
      // 修复2: 添加 stdio 配置，忽略 stdin
      // 修复3: 添加超时机制
      const child = spawn('claude', ['--print', '请回复"成功"'], {
        env: env,
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe'], // 忽略stdin，避免等待输入
        windowsHide: true
      });

      let stdout = '';
      let stderr = '';
      let isResolved = false;

      // 超时处理（5分钟）
      const timeout = setTimeout(() => {
        if (!isResolved) {
          this.log('error', 'Claude CLI 执行超时（5分钟），强制终止');
          isResolved = true;
          child.kill('SIGTERM');

          // 如果SIGTERM无效，5秒后使用SIGKILL
          setTimeout(() => {
            if (!child.killed) {
              child.kill('SIGKILL');
            }
          }, 5000);

          reject(new Error('执行超时（5分钟）'));
        }
      }, 300000); // 5分钟

      // 收集标准输出
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      // 收集标准错误
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // 进程结束
      child.on('close', (code) => {
        if (isResolved) return; // 已经超时处理过了

        clearTimeout(timeout);
        isResolved = true;

        const output = stdout + stderr;
        this.log('debug', 'Claude CLI 命令完成', {
          exitCode: code,
          outputLength: output.length
        });

        if (code !== 0 && output.length === 0) {
          reject(new Error(`命令执行失败，退出码: ${code}`));
        } else {
          // 返回完整输出（包含stdout和stderr）
          resolve(output);
        }
      });

      // 进程错误
      child.on('error', (error) => {
        if (isResolved) return;

        clearTimeout(timeout);
        isResolved = true;

        this.log('error', 'Claude CLI 执行错误', { error: error.message });
        reject(new Error(`无法执行 claude 命令: ${error.message}`));
      });
    });
  }

  /**
   * 测试所有端点（并发执行，各自独立）
   */
  async testAllEndpoints() {
    // 每次测试前重新读取配置文件
    if (!this.loadConfig()) {
      this.log('error', '配置文件加载失败，使用上次的配置');
      if (!this.config) {
        return [];
      }
    }

    this.log('info', `开始批量测试 ${this.config.endpoints.length} 个端点（并发执行）`);
    const batchStartTime = Date.now();

    // 所有端点并发测试，互不影响
    const promises = this.config.endpoints.map(endpoint =>
      this.testEndpoint(endpoint)
    );

    const results = await Promise.all(promises);

    // 更新结果缓存
    results.forEach(result => {
      this.results.set(result.name, result);
    });

    const batchTime = Date.now() - batchStartTime;
    const onlineCount = results.filter(r => r.status === 'online').length;
    const offlineCount = results.filter(r => r.status === 'offline').length;
    const testingCount = results.filter(r => r.status === 'testing').length;

    this.log('info', `批量测试完成`, {
      totalTime: `${batchTime}ms`,
      totalEndpoints: results.length,
      online: onlineCount,
      offline: offlineCount,
      testing: testingCount > 0 ? testingCount : undefined
    });

    return results;
  }

  /**
   * 获取所有端点的结果（包括未测试的）
   */
  getResults() {
    // 如果配置已加载，确保返回所有配置的端点
    if (this.config && this.config.endpoints) {
      const allResults = [];

      this.config.endpoints.forEach(endpoint => {
        // 如果有测试结果就用测试结果
        if (this.results.has(endpoint.name)) {
          allResults.push(this.results.get(endpoint.name));
        } else {
          // 否则返回默认的未测试状态
          allResults.push({
            name: endpoint.name,
            apiBase: endpoint.apiBase,
            inviteLink: endpoint.inviteLink || '',
            status: 'unknown',
            responseTime: null,
            error: null,  // 不显示"尚未测试"错误
            lastChecked: null
          });
        }
      });

      return allResults;
    }

    // 如果配置未加载，返回缓存的结果
    return Array.from(this.results.values());
  }

  /**
   * 为单个端点启动定时测试
   */
  startEndpointTimer(endpoint) {
    // 配置中的间隔单位是分钟，需要转换为毫秒
    const intervalMinutes = endpoint.testInterval || this.config.defaultTestInterval || 1;
    const interval = intervalMinutes * 60 * 1000; // 转换为毫秒

    this.log('info', `为端点 ${endpoint.name} 启动定时测试`, {
      interval: `${intervalMinutes}分钟`
    });

    // 立即执行一次测试
    this.testEndpoint(endpoint);

    // 清除旧定时器（如果存在）
    if (this.timers.has(endpoint.name)) {
      clearInterval(this.timers.get(endpoint.name));
    }

    // 设置新定时器
    const timer = setInterval(() => {
      this.log('debug', `端点 ${endpoint.name} 定时测试触发`);
      this.testEndpoint(endpoint);
    }, interval);

    this.timers.set(endpoint.name, timer);
  }

  /**
   * 停止所有定时器
   */
  stopAllTimers() {
    this.log('info', '停止所有定时测试');
    for (const [name, timer] of this.timers.entries()) {
      clearInterval(timer);
      this.log('debug', `停止端点 ${name} 的定时器`);
    }
    this.timers.clear();
  }

  /**
   * 重新加载配置并重启所有定时器
   */
  reloadAndRestart() {
    this.log('info', '重新加载配��并重启定时器');

    // 停止所有旧定时器
    this.stopAllTimers();

    // 重新加载配置
    if (!this.loadConfig()) {
      this.log('error', '配置加载失败，无法重启定时器');
      return false;
    }

    // 为每个端点启动定时器
    this.config.endpoints.forEach(endpoint => {
      this.startEndpointTimer(endpoint);
    });

    return true;
  }

  startAutoTest() {
    this.log('info', '启动独立端点定时测试系统');

    // 初次加载配置
    if (!this.loadConfig()) {
      this.log('error', '配置加载失败');
      return;
    }

    // 为每个端点启动独立定时器
    this.config.endpoints.forEach(endpoint => {
      this.startEndpointTimer(endpoint);
    });

    // 每5分钟重新加载一次配置（检查是否有新端点或配置变更）
    setInterval(() => {
      this.log('info', '定期检查配置文件变更');
      const oldEndpointCount = this.config?.endpoints.length || 0;

      if (this.loadConfig()) {
        const newEndpointCount = this.config.endpoints.length;

        // 如果端点数量变化，重启所有定时器
        if (newEndpointCount !== oldEndpointCount) {
          this.log('info', `检测到端点数量变化 (${oldEndpointCount} -> ${newEndpointCount})，重启定时器`);
          this.reloadAndRestart();
        } else {
          // 检查每个端点的测试间隔是否变化
          let intervalChanged = false;
          this.config.endpoints.forEach(endpoint => {
            const oldResult = this.results.get(endpoint.name);
            if (oldResult && oldResult.testInterval !== endpoint.testInterval) {
              intervalChanged = true;
            }
          });

          if (intervalChanged) {
            this.log('info', '检测到测试间隔变化，重启定时器');
            this.reloadAndRestart();
          }
        }
      }
    }, 300000); // 5分钟
  }
}

module.exports = APITester;
