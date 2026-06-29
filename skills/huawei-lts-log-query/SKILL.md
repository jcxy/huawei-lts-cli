---
name: huawei-lts-log-query
description: 查询华为云日志服务（LTS）的日志。支持多字段组合查询、逻辑运算符（AND/OR/NOT）、数值比较和SQL分析。当用户提到查看日志、搜索日志、查询日志、排查错误、分析慢请求或提及华为云LTS时使用此技能。触发词：查看日志、查询日志、搜索日志、lts查询、华为云日志、log query、search logs、analyze logs。
---

# 华为云 LTS 日志查询

通过 `lts-cli` 命令查询华为云日志服务（LTS）。

## 前置条件检查

如果 `lts-cli` 未安装或未配置，先引导用户执行：

```bash
npm install -g @cvtoolman/huawei-lts-cli
lts-cli init
```

## 快速工作流程

### 步骤 1：从自然语言提取参数

| 用户意图 | CLI 参数 | 示例 |
|---------|---------|------|
| 时间范围 | `--st <start> --et <end>` | "最近1小时" → ISO 8601 |
| 简单关键词 | `-k "keyword"` | "ERROR" |
| **高级查询**（推荐） | `-q "expression"` | `content:error AND level:ERROR` |
| 限制数量 | `-l <count>` | "最新50条" → `-l 50` |
| 倒序排列 | `-r` | "最新的" → `-r` |
| 输出格式 | `-f json\|table\|pretty` | "json格式" → `-f json` |
| 日志组/流 | `-g <id> -s <id>` | 可省略（如已配置） |

### 步骤 2：构建并执行命令

```bash
lts-cli query \
  --st <ISO_8601_start> \
  --et <ISO_8601_end> \
  [-q "query_expression"] \
  [-l limit] [-r] [-f format]
```

### 步骤 3：呈现结果

清晰展示找到的日志，包括时间戳和内容。如果无结果，建议扩大时间范围；如果结果过多，建议缩小范围。

## 高级查询语法概要

使用 `-q` 参数支持以下查询能力：

| 语法类型 | 格式 | 示例 |
|---------|------|------|
| 字段查询 | `field:value` | `content:error` |
| 逻辑组合 | `A AND B` / `A OR B` / `A NOT B` | `content:error AND level:ERROR` |
| 数值比较 | `field>value` | `response_time>1000` |
| SQL统计 | `SELECT ... FROM log ...` | `SELECT count(*) FROM log GROUP BY level` |

⚠️ **关键规则**：AND、OR、NOT 前后必须有**空格**，查询表达式必须用引号包裹。

> 完整语法说明和更多示例，请阅读 [references/cheatsheet.md](references/cheatsheet.md)

## 常用场景示例

### 1. 基础查询

```bash
# 今天的 ERROR 日志
lts-cli query --st 2024-06-29T00:00:00Z --et 2024-06-29T23:59:59Z \
  -q "level:ERROR" -r -l 50
```

### 2. 多条件组合

```bash
# 生产环境的错误日志
lts-cli query --st 2024-06-29T00:00:00Z --et 2024-06-29T23:59:59Z \
  -q "level:ERROR AND env:production" -r

# 支付服务的异常（排除测试环境）
lts-cli query --st 2024-06-29T00:00:00Z --et 2024-06-29T23:59:59Z \
  -q "appName:payment-service AND (content:error OR content:exception) NOT env:test" -r
```

### 3. 性能分析

```bash
# 慢请求（响应时间 > 2秒）
lts-cli query --st 2024-06-29T00:00:00Z --et 2024-06-29T23:59:59Z \
  -q "response_time>2000 AND method:POST" -r -f json

# 统计各应用错误数
lts-cli query --st 2024-06-29T00:00:00Z --et 2024-06-29T23:59:59Z \
  -q "SELECT count(*) as cnt, appName FROM log WHERE level='ERROR' GROUP BY appName" \
  -f json
```

## 常见问题处理

| 问题 | 解决方案 |
|------|---------|
| 无结果 | 扩大时间范围或移除部分条件 |
| 结果太多 | 缩小时间范围或增加过滤条件 |
| 语法错误 | 检查 AND/OR/NOT 前后是否有空格 |
| 认证失败 | 运行 `lts-cli config --list` 检查凭证 |

## 完整命令参考

```
选项：
  -g, --group-id <groupId>      日志组 ID（可选，如已配置）
  -s, --stream-id <streamId>    日志流 ID（可选，如已配置）
  --st, --start-time <time>     开始时间，ISO 8601（必填）
  --et, --end-time <time>       结束时间，ISO 8601（必填）
  -k, --keyword <keyword>       简单关键词（旧版，不推荐）
  -q, --query <query>           高级查询表达式（推荐）
  -l, --limit <limit>           每页结果数（默认: 100）
  -o, --offset <offset>         分页偏移量（默认: 0）
  -r, --reverse                 倒序（最新优先）
  -f, --format <format>         输出格式: pretty/json/table（默认: pretty）
  --no-paginate                 禁用自动翻页
```

## 详细参考资料

需要更多信息时，按需阅读以下参考文档：

- **[查询语法速查表](references/cheatsheet.md)** - 所有语法快速查阅，常见错误提示
- **[高级查询指南](references/advanced-query-guide.md)** - 完整语法详解，实用场景和故障排查
- **[控制台 vs CLI 对照](references/query-comparison.md)** - 从控制台迁移参考，操作映射关系
- **[实现说明](references/implementation-notes.md)** - 技术实现细节，供开发者参考
