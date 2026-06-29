# 高级查询功能指南

本指南介绍如何使用 `lts-cli` 的高级查询功能，实现与华为云LTS控制台相同的多条件组合搜索能力。

## 快速开始

### 基本用法（向后兼容）

```bash
# 简单关键词搜索（旧版方式）
lts-cli query --st 2024-06-29T00:00:00Z --et 2024-06-29T23:59:59Z -k "ERROR"
```

### 推荐用法（新版高级查询）

```bash
# 使用 --query 参数进行高级查询
lts-cli query --st 2024-06-29T00:00:00Z --et 2024-06-29T23:59:59Z \
  -q "content:error AND appName:myapp"
```

## 查询语法详解

### 1. 字段查询（Field Queries）

使用 `field:value` 格式进行字段匹配，支持模糊匹配和精确匹配。

**语法：**
```
field:value
```

**示例：**
```bash
# 查询 content 字段包含 "error" 的日志
lts-cli query --st 2024-06-29T00:00:00Z --et 2024-06-29T23:59:59Z \
  -q "content:error"

# 查询 appName 字段为 "myapp" 的日志
lts-cli query --st 2024-06-29T00:00:00Z --et 2024-06-29T23:59:59Z \
  -q "appName:myapp"
```

### 2. 逻辑运算符（Logical Operators）

支持 AND、OR、NOT 三种逻辑运算符。**注意：运算符前后必须有空格！**

#### AND（且）

两个条件都必须满足。

```bash
# 查询同时包含 error 内容且来自 myapp 的日志
lts-cli query --st 2024-06-29T00:00:00Z --et 2024-06-29T23:59:59Z \
  -q "content:error AND appName:myapp"

# 多条件组合
lts-cli query --st 2024-06-29T00:00:00Z --et 2024-06-29T23:59:59Z \
  -q "content:error AND level:ERROR AND node:server1"
```

#### OR（或）

任一条件满足即可。

```bash
# 查询包含 ERROR 或 WARN 级别的日志
lts-cli query --st 2024-06-29T00:00:00Z --et 2024-06-29T23:59:59Z \
  -q "level:ERROR OR level:WARN"

# 查询多个应用
lts-cli query --st 2024-06-29T00:00:00Z --et 2024-06-29T23:59:59Z \
  -q "appName:service-a OR appName:service-b OR appName:service-c"
```

#### NOT（非）

排除符合条件的日志。

```bash
# 查询 DEBUG 级别但不是测试模块的日志
lts-cli query --st 2024-06-29T00:00:00Z --et 2024-06-29T23:59:59Z \
  -q "level:DEBUG NOT module:test"
```

#### 复杂组合

可以使用括号进行复杂的逻辑组合。

```bash
# 查询 (ERROR 或 WARN) 且不是测试环境的日志
lts-cli query --st 2024-06-29T00:00:00Z --et 2024-06-29T23:59:59Z \
  -q "(level:ERROR OR level:WARN) NOT env:test"

# 查询特定应用的错误或超时日志
lts-cli query --st 2024-06-29T00:00:00Z --et 2024-06-29T23:59:59Z \
  -q "appName:payment-service AND (content:error OR content:timeout)"
```

### 3. 比较运算符（Comparison Operators）

支持数值字段的比较操作。

**支持的运算符：**
- `>` 大于
- `<` 小于
- `>=` 大于等于
- `<=` 小于等于
- `!=` 不等于
- `=` 等于

**示例：**
```bash
# 查询响应时间大于 1000ms 的日志
lts-cli query --st 2024-06-29T00:00:00Z --et 2024-06-29T23:59:59Z \
  -q "response_time>1000"

# 查询耗时在 100-500ms 之间的日志
lts-cli query --st 2024-06-29T00:00:00Z --et 2024-06-29T23:59:59Z \
  -q "duration>=100 AND duration<=500"
```

### 4. SQL 语法查询

对于更复杂的查询需求，可以使用标准 SQL92 语法。

**基本语法：**
```sql
SELECT * FROM log WHERE condition
```

**示例：**
```bash
# 使用 LIKE 进行模糊匹配
lts-cli query --st 2024-06-29T00:00:00Z --et 2024-06-29T23:59:59Z \
  -q "SELECT * FROM log WHERE content LIKE '%error%'"

# 统计查询
lts-cli query --st 2024-06-29T00:00:00Z --et 2024-06-29T23:59:59Z \
  -q "SELECT count(*) as cnt, level FROM log GROUP BY level"

# 按应用统计错误数量
lts-cli query --st 2024-06-29T00:00:00Z --et 2024-06-29T23:59:59Z \
  -q "SELECT count(*) as error_count, appName FROM log WHERE content LIKE '%error%' GROUP BY appName ORDER BY error_count DESC"

# 带条件的聚合查询
lts-cli query --st 2024-06-29T00:00:00Z --et 2024-06-29T23:59:59Z \
  -q "SELECT avg(response_time) as avg_time, max(response_time) as max_time FROM log WHERE status_code=200"
```

**注意事项：**
- 使用双引号包裹字段名（特别是包含特殊字符的字段名）：`SELECT "field.name" FROM log`
- SQL 语句需要用引号包裹作为 `-q` 参数的值

## 实用场景示例

### 场景 1：排查生产环境错误

```bash
# 查询今天生产环境中所有 ERROR 级别的日志
lts-cli query --st 2024-06-29T00:00:00Z --et 2024-06-29T23:59:59Z \
  -q "level:ERROR AND env:production" \
  -r -l 50
```

### 场景 2：分析慢请求

```bash
# 查询响应时间超过 2 秒的请求
lts-cli query --st 2024-06-29T00:00:00Z --et 2024-06-29T23:59:59Z \
  -q "response_time>2000 AND method:POST" \
  -r -f json
```

### 场景 3：监控特定服务

```bash
# 查询支付服务的异常日志（排除测试环境）
lts-cli query --st 2024-06-29T00:00:00Z --et 2024-06-29T23:59:59Z \
  -q "appName:payment-service AND (content:error OR content:exception OR content:failed) NOT env:test" \
  -r
```

### 场景 4：统计分析

```bash
# 统计各应用的错误分布
lts-cli query --st 2024-06-29T00:00:00Z --et 2024-06-29T23:59:59Z \
  -q "SELECT count(*) as count, appName FROM log WHERE level='ERROR' GROUP BY appName" \
  -f json
```

### 场景 5：时间范围 + 多条件

```bash
# 查询最近 1 小时内订单服务的超时日志
lts-cli query --st 2024-06-29T12:00:00Z --et 2024-06-29T13:00:00Z \
  -q "appName:order-service AND content:timeout AND response_time>5000" \
  -r -l 100
```

## 最佳实践

1. **优先使用 `--query` 而非 `-k`**：`--query` 支持更强大的查询语法
2. **合理使用时间范围**：缩小时间范围可提高查询速度
3. **组合使用逻辑运算符**：用 AND/OR/NOT 精确过滤
4. **利用排序和限制**：使用 `-r` 和 `-l` 快速获取最新日志
5. **SQL 用于统计分析**：需要聚合、分组时使用 SQL 语法
6. **JSON 输出便于处理**：使用 `-f json` 方便后续脚本处理

## 故障排查

### 问题 1：查询返回结果为空

**可能原因：**
- 时间范围不正确
- 查询条件过于严格
- 字段名拼写错误

**解决方案：**
```bash
# 先放宽条件测试
lts-cli query --st 2024-06-29T00:00:00Z --et 2024-06-29T23:59:59Z \
  -q "content:error"

# 检查是否有日志
lts-cli query --st 2024-06-29T00:00:00Z --et 2024-06-29T23:59:59Z \
  -l 10
```

### 问题 2：语法错误

**可能原因：**
- AND/OR/NOT 前后缺少空格
- 引号不匹配

**解决方案：**
```bash
# 错误示例（缺少空格）
-q "level:ERRORANDappName:myapp"  # ❌

# 正确示例
-q "level:ERROR AND appName:myapp"  # ✅
```

### 问题 3：SQL 查询失败

**可能原因：**
- SQL 语法不符合 SQL92 标准
- 字段名未使用双引号包裹

**解决方案：**
```bash
# 错误示例
-q "SELECT count(*) FROM log WHERE field.name='value'"  # ❌

# 正确示例
-q "SELECT count(*) FROM log WHERE \"field.name\"='value'"  # ✅
```

## 更多信息

- [华为云LTS官方文档](https://support.huaweicloud.com/productdesc-lts/lts_03202.html)
- [搜索语法介绍](https://support.huaweicloud.com/intl/zh-cn/ally-visitor-1-usermanual-lts/lts_07_0086.html)
- [SQL查询语法概述](https://support.huaweicloud.com/usermanual-lts/lts_07_0087.html)
