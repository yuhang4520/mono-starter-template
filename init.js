#!/usr/bin/env node
/**
 * mono-starter-template 初始化脚本
 *
 * 功能:
 * - 重命名项目包名 (@your-project -> 自定义前缀)
 * - 配置端口 (避免冲突)
 * - 生成随机密钥
 * - 创建 .env 文件
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');
const { execSync } = require('child_process');

const ROOT = process.cwd();

// 默认配置
const DEFAULTS = {
  prefix: 'your-project',
  dbPort: 5342,
  apiPort: 4000,
  adminPort: 3000,
  appPort: 5173,
  minioPort: 9001,
};

// 彩色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

// 生成随机密钥
function generateSecret() {
  return crypto.randomBytes(32).toString('base64');
}

// 检查端口是否被占用
function isPortAvailable(port) {
  try {
    execSync(`lsof -i :${port}`, { stdio: 'ignore' });
    return false;
  } catch {
    return true;
  }
}

// 查找可用端口
function findAvailablePort(startPort) {
  let port = startPort;
  while (!isPortAvailable(port)) {
    log(`端口 ${port} 被占用，尝试 ${port + 1}`, 'yellow');
    port++;
  }
  return port;
}

// 递归替换文件内容
function replaceInFile(filePath, replacements) {
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  
  for (const [oldVal, newVal] of Object.entries(replacements)) {
    if (content.includes(oldVal)) {
      content = content.replaceAll(oldVal, newVal);
      changed = true;
    }
  }
  
  if (changed) {
    fs.writeFileSync(filePath, content);
    log(`  ✓ ${path.relative(ROOT, filePath)}`, 'green');
  }
}

// 复制 .env.example 到 .env
function setupEnvFile(examplePath, envPath, replacements) {
  if (!fs.existsSync(examplePath)) return;
  
  let content = fs.readFileSync(examplePath, 'utf8');
  for (const [oldVal, newVal] of Object.entries(replacements)) {
    content = content.replaceAll(oldVal, newVal);
  }
  
  fs.writeFileSync(envPath, content);
  log(`  ✓ ${path.relative(ROOT, envPath)}`, 'green');
}

async function prompt(message, defaultValue) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  return new Promise((resolve) => {
    rl.question(`${message} [${defaultValue}]: `, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue);
    });
  });
}

async function main() {
  log('\n🚀 mono-starter-template 初始化向导\n', 'blue');
  
  // 1. 获取用户输入
  const prefix = await prompt('项目包名前缀', DEFAULTS.prefix);
  
  // 2. 检查并分配端口
  log('\n检查端口可用性...', 'blue');
  const ports = {
    db: findAvailablePort(DEFAULTS.dbPort),
    api: findAvailablePort(DEFAULTS.apiPort),
    admin: findAvailablePort(DEFAULTS.adminPort),
    app: findAvailablePort(DEFAULTS.appPort),
    minio: findAvailablePort(DEFAULTS.minioPort),
  };
  
  // 3. 生成密钥
  const secrets = {
    betterAuth: generateSecret(),
    auth: generateSecret(),
  };
  
  log('\n端口分配:', 'blue');
  log(`  PostgreSQL: ${ports.db}`);
  log(`  API:        ${ports.api}`);
  log(`  Admin:      ${ports.admin}`);
  log(`  App H5:     ${ports.app}`);
  log(`  MinIO:      ${ports.minio}`);
  
  // 4. 替换配置
  const replacements = {
    '@your-project': `@${prefix}`,
    'your-project': prefix,
    'localhost:5342': `localhost:${ports.db}`,
    'localhost:4000': `localhost:${ports.api}`,
    'localhost:3000': `localhost:${ports.admin}`,
    'localhost:5173': `localhost:${ports.app}`,
    'localhost:9001': `localhost:${ports.minio}`,
    ':5342:': `:${ports.db}:`,
    ':4000': `:${ports.api}`,
    ':3000': `:${ports.admin}`,
    ':5173': `:${ports.app}`,
    ':9001': `:${ports.minio}`,
    'Pzn93oLl7VLJ376sG/T9Cx0Fg6QK2tcvM4qBOl6VtV4=': secrets.betterAuth,
    'replace-with-a-random-secret': secrets.auth,
  };
  
  // 更新 docker-compose.yaml
  log('\n更新 docker-compose.yaml...', 'blue');
  replaceInFile(path.join(ROOT, 'docker-compose.yaml'), {
    '- 5342:': `- ${ports.db}:`,
    '- "0.0.0.0:9001:': `- "0.0.0.0:${ports.minio}:`,
    'http://minio:9001': `http://minio:${ports.minio}`,
  });
  
  // 更新 packages/db 配置
  log('\n更新数据库配置...', 'blue');
  replaceInFile(path.join(ROOT, 'packages/db/package.json'), replacements);
  
  // 更新 apps 配置
  log('\n更新应用配置...', 'blue');
  replaceInFile(path.join(ROOT, 'apps/api/.env.example'), replacements);
  replaceInFile(path.join(ROOT, 'apps/admin/.env.example'), replacements);
  replaceInFile(path.join(ROOT, 'apps/app/package.json'), replacements);
  replaceInFile(path.join(ROOT, 'apps/app/env/.env.example'), replacements);
  replaceInFile(path.join(ROOT, 'apps/app/pages.config.ts'), replacements);
  
  // 5. 创建 .env 文件
  log('\n创建 .env 文件...', 'blue');
  setupEnvFile(
    path.join(ROOT, 'apps/admin/.env.example'),
    path.join(ROOT, 'apps/admin/.env'),
    replacements
  );
  setupEnvFile(
    path.join(ROOT, 'apps/api/.env.example'),
    path.join(ROOT, 'apps/api/.env'),
    replacements
  );
  setupEnvFile(
    path.join(ROOT, 'apps/app/env/.env.example'),
    path.join(ROOT, 'apps/app/env/.env.local'),
    replacements
  );
  
  // 6. 更新 CLAUDE.md
  log('\n更新文档...', 'blue');
  replaceInFile(path.join(ROOT, 'CLAUDE.md'), {
    'localhost:5342': `localhost:${ports.db}`,
    'localhost:4000': `localhost:${ports.api}`,
    'localhost:3000': `localhost:${ports.admin}`,
  });
  
  log('\n✅ 初始化完成!\n', 'green');
  log('下一步:', 'blue');
  log('  1. docker compose up -d');
  log(`  2. cd packages/db && pnpm push  # 数据库迁移`);
  log('  3. pnpm --filter @' + prefix + '/api dev');
  log('  4. pnpm --filter @' + prefix + '/admin dev');
  log('  5. pnpm --filter @' + prefix + '/app dev:h5');
  log('');
}

main().catch(console.error);
