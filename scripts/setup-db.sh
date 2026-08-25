#!/bin/bash
set -euo pipefail

# 数据库配置：一律从环境变量读取，禁止在脚本里写死明文凭据。
# 用法示例：
#   DB_HOST=xxx DB_PORT=5432 DB_USER=postgres DB_PASSWORD=*** \
#   SOURCE_DB=aa_jizhang TEST_DB=aa_jizhang_test bash scripts/setup-db.sh
DB_HOST="${DB_HOST:?请设置 DB_HOST 环境变量}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:?请设置 DB_USER 环境变量}"
DB_PASSWORD="${DB_PASSWORD:?请设置 DB_PASSWORD 环境变量}"
SOURCE_DB="${SOURCE_DB:-aa_jizhang}"
TEST_DB="${TEST_DB:-aa_jizhang_test}"

export PGPASSWORD="$DB_PASSWORD"

echo "=========================================="
echo "开始数据库操作流程"
echo "  主机: $DB_HOST:$DB_PORT  用户: $DB_USER"
echo "  源库: $SOURCE_DB  测试库: $TEST_DB"
echo "=========================================="

# 1. 创建测试数据库
echo ""
echo "[1/3] 创建测试数据库: $TEST_DB"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS $TEST_DB;"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "CREATE DATABASE $TEST_DB;"
echo "✓ 测试数据库创建成功"

# 2. 从生产库导出数据并导入到测试库
echo ""
echo "[2/3] 复制生产数据到测试库..."
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$SOURCE_DB" | psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TEST_DB"
echo "✓ 数据复制成功"

# 3. 清空生产库（保留表结构）
echo ""
echo "[3/3] 重置生产库数据..."
echo "警告: 即将清空生产库 $SOURCE_DB 的所有数据（保留表结构）"
read -p "确认继续？(输入 yes 继续): " confirm

if [ "$confirm" != "yes" ]; then
    echo "操作已取消"
    exit 0
fi

# 获取所有表名并清空
tables=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$SOURCE_DB" -t -c "SELECT tablename FROM pg_tables WHERE schemaname='public';")

for table in $tables; do
    echo "  清空表: $table"
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$SOURCE_DB" -c "TRUNCATE TABLE \"$table\" CASCADE;"
done

echo ""
echo "=========================================="
echo "✓ 所有操作完成！"
echo "=========================================="
echo "- 测试库: $TEST_DB (包含生产数据副本)"
echo "- 生产库: $SOURCE_DB (已清空，保留表结构)"
echo ""
