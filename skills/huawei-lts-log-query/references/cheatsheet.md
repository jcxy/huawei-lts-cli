# LTS 查询语法速查表

## 基础语法

### 字段查询
```
field:value          # 模糊匹配（包含）
```

**示例：**
- `content:error` - content 包含 "error"
- `appName:myapp` - appName 包含 "myapp"
- `node:server1` - node 包含 "server1"

### 逻辑运算符 ⚠️ 前后必须有空格！

| 运算符 | 含义 | 示例 |
|--------|------|------|
| `AND` | 且 | `content:error AND level:ERROR` |
| `OR` | 或 | `level:ERROR OR level:WARN` |
| `NOT` | 非 | `level:DEBUG NOT module:test` |

### 比较运算符

| 运算符 | 含义 | 示例 |
|--------|------|------|
| `>` | 大于 | `response_time>1000` |
| `<` | 小于 | `duration<500` |
| `>=` | 大于等于 | `status_code>=400` |
| `<=` | 小于等于 | `retry_count<=3` |
| `!=` | 不等于 | `env!=test` |
| `=` | 等于 | `method=POST` |

### SQL 语法

```sql
SELECT * FROM log WHERE condition
SELECT count(*) as cnt, field FROM log GROUP BY field
SELECT avg(field) FROM log WHERE condition
```

## 常用场景

### 1. 单条件查询
```bash
-q "content:error"
-q "level:ERROR"
-q "appName:payment-service"
```

### 2. 多条件组合（且）
```bash
-q "content:error AND level:ERROR"
-q "content:error AND appName:myapp AND node:server1"
-q "level:ERROR AND env:production AND method:POST"
```

### 3. 多条件组合（或）
```bash
-q "level:ERROR OR level:WARN"
-q "appName:service-a OR appName:service-b"
-q "status_code:500 OR status_code:502 OR status_code:503"
```

### 4. 排除条件
```bash
-q "level:DEBUG NOT module:test"
-q "content:error NOT env:test"
-q "level:ERROR NOT node:test-server"
```

### 5. 复杂组合
```bash
# (A 或 B) 且 非 C
-q "(level:ERROR OR level:WARN) NOT env:test"

# A 且 (B 或 C)
-q "appName:payment AND (content:error OR content:timeout)"

# 多层嵌套
-q "(level:ERROR AND env:prod) OR (level:WARN AND env:staging)"
```

### 6. 数值范围
```bash
-q "response_time>1000"
-q "duration>=100 AND duration<=500"
-q "status_code!=200 AND response_time>2000"
```

### 7. SQL 统计
```bash
# 按级别统计
-q "SELECT count(*) as cnt, level FROM log GROUP BY level"

# 按应用统计错误
-q "SELECT count(*) as errors, appName FROM log WHERE level='ERROR' GROUP BY appName"

# 平均响应时间
-q "SELECT avg(response_time) as avg_time, max(response_time) as max_time FROM log"

# 慢请求统计
-q "SELECT count(*) as slow_requests, method FROM log WHERE response_time>1000 GROUP BY method"
```

## 完整命令模板

### query
```bash
lts-cli query \
  --last <相对时间> \        # 如 30m/2h/1d/7d，推荐
  [--st <开始时间>] \        # 或用 ISO 8601 精确时间
  [--et <结束时间>] \
  [--app <appName>] \        # 按应用过滤
  [--content <关键词>] \     # 按内容过滤
  [-q "<查询表达式>"] \
  [-g <日志组ID>] \
  [-s <日志流ID>] \
  [-l <每页条数>] \
  [-r] \                     # 倒序（最新优先）
  [-f <输出格式>]            # pretty/json/table
```

### trace（请求链路）
```bash
lts-cli trace <requestId> [--field REQUEST_ID|trace_id|content] [--last 24h] [-l 200]
```

### context（上下文）
```bash
lts-cli context --line-num <n> --time <毫秒时间戳> [--before 20] [--after 20]
```

### groups / streams（发现日志组/流）
```bash
lts-cli groups
lts-cli streams [-g <日志组名>]
```

## 时间格式

**优先使用相对时间 `--last`**：
- 最近30分钟：`--last 30m`
- 最近2小时：`--last 2h`
- 最近1天：`--last 1d`
- 最近7天：`--last 7d`

**精确时间**（ISO 8601：`YYYY-MM-DDTHH:mm:ssZ`）：
- 今天：`--st 2024-06-29T00:00:00Z --et 2024-06-29T23:59:59Z`
- 最近24小时：`--st 2024-06-28T13:00:00Z --et 2024-06-29T13:00:00Z`

`--last` 与 `--st/--et` 互斥，只能选一种。

## 常见字段（acerp 日志流已核实，2026-09）

**已建索引字段**（可用于字段查询 `field:value`，全部 string 类型）：

| 字段名 | 说明 | 示例 |
|--------|------|------|
| `appName` | 应用名称（内置） | `appName:acerp-gateway` |
| `REQUEST_ID` | 请求链路 ID | `REQUEST_ID:0a1b2c3d` |
| `trace_id` | 链路追踪 ID | `trace_id:abc123` |
| `level` | 日志级别 | `level:ERROR` |
| `node` | 节点名称 | `node:server1` |
| `thread` | 线程名 | `thread:http-nio` |
| `throwable` | 异常堆栈 | `throwable:NullPointerException` |
| `location` | 代码位置 | `location:OrderService` |
| `USER_ID` | 用户 ID | `USER_ID:12345` |
| `X-TX-XID` | Seata 全局事务 ID | - |
| `X-TX-BRANCH-ID` | Seata 分支事务 ID | - |
| `powerjob.jobId` / `powerjob.instanceId` / `powerjob.processor` | 定时任务相关 | - |

**未建索引**（只能全文搜 `content:xxx`）：`span_id`、`REMOTE_ADDRESS`、`ACCOUNT`、`COMPANY_ID`

> **注意：** 全文索引大小写敏感，`content:ERROR` ≠ `content:error`

## SQL 管道语法

控制台新版使用管道符语法：`搜索语句 | SQL分析语句`

```bash
# 裸 SELECT 会自动包装为 "* | SELECT ..."
-q "SELECT count(*) as cnt, level FROM log GROUP BY level"

# 显式管道语法：先过滤再统计
-q "level:ERROR | SELECT count(*) as cnt, appName FROM log GROUP BY appName"
```

## 常见错误

### ❌ 错误：运算符缺少空格
```bash
# 错误
-q "level:ERRORANDappName:myapp"

# 正确
-q "level:ERROR AND appName:myapp"
```

### ❌ 错误：SQL 字段名未加引号
```bash
# 错误（字段名含特殊字符时）
-q "SELECT count(*) FROM log WHERE field.name='value'"

# 正确
-q "SELECT count(*) FROM log WHERE \"field.name\"='value'"
```

### ❌ 错误：引号不匹配
```bash
# 错误
-q 'SELECT * FROM log WHERE content LIKE "%error%"'

# 正确（外层双引号，内层单引号）
-q "SELECT * FROM log WHERE content LIKE '%error%'"
```

## 从控制台迁移

| 控制台操作 | CLI 命令 |
|-----------|---------|
| 选择字段 + 输入值 | `-q "field:value"` |
| 点击"且"按钮 | `AND`（带空格） |
| 点击"或"按钮 | `OR`（带空格） |
| 添加排除条件 | `NOT`（带空格） |
| 选择比较符 | `field>value` |
| SQL分析标签 | `-q "SELECT ..."` |
