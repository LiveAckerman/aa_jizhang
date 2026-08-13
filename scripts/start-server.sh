#!/bin/bash

# 出发AA记账 - 后端服务启动脚本

echo "🚀 启动出发AA记账后端服务..."
echo ""

# 检查环境变量
if [ ! -f ".env" ]; then
  echo "❌ 错误：找不到 .env 文件"
  echo "请在项目根目录创建 .env 文件并配置环境变量"
  exit 1
fi

# 检查数据库连接
echo "📊 检查数据库连接..."
DB_HOST=$(grep DB_HOST .env | cut -d '=' -f2)
DB_PORT=$(grep DB_PORT .env | cut -d '=' -f2)

if [ -z "$DB_HOST" ]; then
  echo "⚠️  警告：未配置数据库地址"
fi

# 检查依赖
echo "📦 检查依赖..."
cd packages/server

if [ ! -d "node_modules" ]; then
  echo "📥 安装依赖..."
  pnpm install
fi

# 启动服务
echo ""
echo "✅ 环境检查完成"
echo "🎯 启动开发服务器..."
echo ""

pnpm run start:dev
