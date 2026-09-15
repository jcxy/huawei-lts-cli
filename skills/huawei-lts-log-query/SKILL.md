---
name: huawei-lts-log-query
description: 查询华为云日志服务（LTS）的日志。支持组合筛选（appName+内容+时间）、REQUEST_ID 请求链路定位、上下文查看、多字段组合查询和SQL分析。当用户提到查看日志、搜索日志、查询日志、排查错误、分析慢请求、请求链路、trace 或提及华为云LTS时使用此技能。触发词：查看日志、查询日志、搜索日志、lts查询、华为云日志、log query、search logs、analyze logs、requestId、请求链路。
---

# 华为云 LTS 日志查询

通过 `lts-cli` 命令查询华为云日志服务（LTS）。

## 前置条件检查

如果 `lts-cli` 未安装或未配置，先引导用户执行：

```bash
npm install -g @cvtoolman/huawei-lts-cli
lts-cli init
```

如果用户给了 LTS 控制台的日志搜索页 URL，可以直接导入 region/groupId/streamId：

```bash
lts-cli init --from-url "<控制台URL>"
```

## 用户高频工作流（优先使用）

### 流程 1：组合筛选定位日志（最常用）

```bash
lts-cli query --last 2h --app <appName> --content <关键词> -r -l 50
```

- `--last 2h`：相对时间，支持 `30m / 2h / 1d / 7d`，不需要算 ISO 时间
- `--app`：应用名，从下方"appName 取值表"中选择**精确值**
- `--content`：日志内容关键词（如错误信息、订单号）
- `-r`：最新优先；不加 `-r` 为正序

### 流程 2：通过 REQUEST_ID 还原整条请求链路

从流程 1 的日志内容中提取 `REQUEST_ID`（日志里通常打印为 `REQUEST_ID` 或 `requestId`），然后：

```bash
lts-cli trace <requestId> --last 24h
```

- 默认按 `REQUEST_ID` 索引字段精确匹配，按时间正序输出完整链路
- `--field trace_id` 可切换为 trace_id 字段；`--field content` 回退全文搜索
- 链路日志可能跨多个 appName，trace 命令不加 appName 过滤

### 流程 3：查看关键日志的上下文

定位到某条关键日志后，查看它前后发生了什么（替代控制台"查看上下文"）：

```bash
lts-cli context --line-num <line_num> --time <毫秒时间戳> --before 20 --after 20
```

- `line_num` 在 query/trace 输出中显示为每条日志的 `[时间]` 位置值（json 格式输出中的 `logTime`）

## 环境速查（acerp，2026-09 经控制台核实）

### 默认日志组与日志流

| 项目 | 值 |
|------|-----|
| 日志组 | `acerp`（groupId `9dc0c878-ee67-450d-a729-797eebcff0f7`） |
| 默认日志流 | `acerp`（streamId `2538923d-5ef8-480c-9b50-772352ee8543`） |
| 其他日志流 | `acerp-gray`、`acerp-seata`、`acerp-seata-gray` |
| region | `cn-south-1` |

- 默认已配置的情况下 `-g`/`-s` 可省略
- 查灰度/seata 日志时，先运行 `lts-cli streams -g acerp` 获取对应 streamId，再用 `-s <streamId>` 指定

### appName 取值表（共 32 个，按日志量排序）

将用户说的自然语言应用名映射为下表中的**精确值**（如"订单服务"→ `acerp-oms-service`，"网关"→ `acerp-gateway`，"库存"→ `acerp-inventory-service`）：

```
acerp-oms-service        acerp-cdc                  acerp-wrs-service
acerp-basic-service      acerp-stock-service        acerp-job-worker-amazon
acerp-data-service       acerp-goods-service        acerp-platform-service
acerp-warehouse-service  acerp-rule-service         acerp-job-worker-business
acerp-inventory-service  acerp-domestic-service     acerp-cronrec-service
acerp-whse-service       acerp-job-worker-bi        acerp-job-worker-kingdee
acerp-admin-service      acerp-gateway              acerp-openapi-resource
acerp-sys-service        acerp-alarm-service        acerp-membership-service
acerp-message-service    acerp-platform-cron-service acerp-logistics-service
acerp-print-service      acerp-pda-service          acerp-upload-service
acerp-express-service    acerp-plan-service
```

不确定对应哪个应用时，列出候选让用户确认，不要猜。

### 可用索引字段（字段级查询只能使用这些字段）

| 字段 | 说明 | 字段 | 说明 |
|------|------|------|------|
| `appName` | 应用名（内置） | `level` | 日志级别 |
| `REQUEST_ID` | 请求链路 ID | `trace_id` | 链路追踪 ID |
| `node` | 节点 | `thread` | 线程名 |
| `throwable` | 异常堆栈 | `location` | 代码位置 |
| `USER_ID` | 用户 ID | `X-TX-XID` | Seata 全局事务 ID |
| `X-TX-BRANCH-ID` | Seata 分支事务 ID | `powerjob.jobId` | 定时任务 ID |
| `powerjob.instanceId` | 任务实例 ID | `powerjob.processor` | 任务处理器 |

**查询规则（重要）：**

1. 全文索引**大小写敏感**：`content:ERROR` 和 `content:error` 结果不同
2. `span_id`、`REMOTE_ADDRESS`、`ACCOUNT`、`COMPANY_ID` 等字段**未建索引**，只能全文搜（`content:xxx`），不能用作字段查询
3. SQL 分析使用管道符语法：`* | SELECT ... FROM log`（裸 `SELECT` 开头会自动识别为分析查询）
4. `AND` / `OR` / `NOT` 前后必须有**空格**
5. 全部索引字段均为 string 类型
6. **字段值含连字符等分词符时必须加双引号**：如 `REQUEST_ID:"402434b5-4720-4df5-..."`，否则会被分词导致匹配不到（`--app`/`--content`/`--request-id`/`trace` 会自动加引号，手写 `-q` 时需注意）

## 从自然语言提取参数

| 用户意图 | CLI 参数 | 示例 |
|---------|---------|------|
| 时间范围 | `--last <时长>` | "最近1小时" → `--last 1h`；"今天" → `--last 1d` |
| 指定应用 | `--app <appName>` | "网关的日志" → `--app acerp-gateway` |
| 内容关键词 | `--content <词>` | "包含 timeout" → `--content timeout` |
| 请求链路 | `trace <requestId>` | "查这条请求的链路" |
| 高级查询 | `-q "expression"` | `level:ERROR AND appName:acerp-gateway` |
| 限制数量 | `-l <count>` | "最新50条" → `-l 50` |
| 倒序排列 | `-r` | "最新的" → `-r` |
| 输出格式 | `-f json\|table\|pretty` | "json格式" → `-f json` |
| 精确时间 | `--st/--et <ISO8601>` | 用户给了明确起止时间时使用 |
| 日志组/流 | `-g <id> -s <id>` | 可省略（已配置默认值） |

## 常用场景示例

### 1. 组合筛选（高频）

```bash
# 订单服务最近2小时的 ERROR 日志
lts-cli query --last 2h --app acerp-oms-service --content ERROR -r -l 50

# 网关最近30分钟包含 timeout 的日志
lts-cli query --last 30m --app acerp-gateway --content timeout -r

# 某个订单号相关的所有应用日志（不指定 app）
lts-cli query --last 4h --content "SO20260914001" -r -l 100
```

### 2. 请求链路定位（高频）

```bash
# 从上一步日志里拿到 REQUEST_ID 后，拉整条链路
lts-cli trace 0a1b2c3d4e5f --last 24h

# 需要按 trace_id 字段查
lts-cli trace <traceId> --field trace_id --last 24h
```

### 3. 上下文查看

```bash
lts-cli context --line-num 1234567890 --time 1757800000000 --before 30 --after 10
```

### 4. 多条件与 SQL 分析

```bash
# 多条件组合
lts-cli query --last 1d -q "level:ERROR AND (content:timeout OR content:exception)" -r

# 统计各应用错误数（自动包装管道语法）
lts-cli query --last 1d -q "SELECT count(*) as cnt, appName FROM log WHERE level='ERROR' GROUP BY appName" -f json

# 显式管道语法：先过滤再统计
lts-cli query --last 1d -q "level:ERROR | SELECT count(*) as cnt, appName FROM log GROUP BY appName" -f json
```

## 常见问题处理

| 问题 | 解决方案 |
|------|---------|
| 无结果 | 检查大小写（全文索引区分大小写）；扩大 `--last` 范围；确认 appName 与取值表完全一致 |
| 结果太多 | 缩小时间范围；加 `--app` 或更多 `-q` 条件 |
| 字段查询报错/无结果 | 确认字段在索引字段清单中；未索引字段改用 `--content` 全文搜 |
| 语法错误 | 检查 AND/OR/NOT 前后是否有空格 |
| 认证失败 | 运行 `lts-cli config --list` 检查凭证 |
| 不知道 streamId | 运行 `lts-cli groups` / `lts-cli streams -g acerp` 查询 |

## 完整命令参考

### query
```
选项：
  -g, --group-id <groupId>      日志组 ID（可选，已配置默认）
  -s, --stream-id <streamId>    日志流 ID（可选，已配置默认）
  --last <duration>             相对时间：30m/2h/1d/7d（推荐）
  --st, --start-time <time>     开始时间，ISO 8601
  --et, --end-time <time>       结束时间，ISO 8601
  --app <appName>               按 appName 字段过滤
  --content <keyword>           按日志内容过滤
  --request-id <id>             按 REQUEST_ID 过滤（正序输出）
  -q, --query <query>           高级查询表达式 / SQL
  -k, --keyword <keyword>       简单关键词（旧版，不推荐）
  -l, --limit <limit>           每页结果数（默认: 100）
  -o, --offset <offset>         分页偏移量（默认: 0）
  -r, --reverse                 倒序（最新优先）
  -f, --format <format>         输出格式: pretty/json/table（默认: pretty）
  --all                         自动翻页拉取全部（上限 10000 条，默认单页）
```

### trace
```
lts-cli trace <requestId> [--field REQUEST_ID|trace_id|content] [--last 24h] [-l 200] [-f format]
```

### context
```
lts-cli context --line-num <n> --time <ms> [--before 20] [--after 20] [-f format]
```

### groups / streams
```
lts-cli groups                     列出日志组
lts-cli streams [-g <组名>]         列出日志流（按组名过滤，注意是组名不是组ID）
```

## 详细参考资料

需要更多信息时，按需阅读以下参考文档：

- **[查询语法速查表](references/cheatsheet.md)** - 所有语法快速查阅，常见错误提示
- **[高级查询指南](references/advanced-query-guide.md)** - 完整语法详解，实用场景和故障排查
- **[控制台 vs CLI 对照](references/query-comparison.md)** - 从控制台迁移参考，操作映射关系
- **[实现说明](references/implementation-notes.md)** - 技术实现细节，供开发者参考
