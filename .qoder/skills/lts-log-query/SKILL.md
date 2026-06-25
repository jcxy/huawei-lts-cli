---
name: lts-log-query
description: >
  华为云LTS日志查询工具。支持通过自然语言描述查询华为云日志服务(LTS)中的日志，
  支持关键词搜索、时间范围过滤、SQL语法查询和聚合统计。
  当用户提到"查询日志"、"查看日志"、"搜索日志"、"日志查询"、"lts查询"时使用。
metadata:
  version: "1.0.0"
  author: "huawei-lts-cli"
  language: "zh-CN"
  tags: ["lts", "log", "huaweicloud", "query"]
---

# 华为云LTS日志查询

## Instructions

当用户需要查询华为云LTS日志时，执行以下步骤：

### 1. 参数解析
从用户自然语言描述中提取以下参数：
- **日志组ID** (log_group_id): 用户提供的日志组标识
- **日志流ID** (log_stream_id): 用户提供的日志流标识
- **时间范围**: 解析相对时间或绝对时间
  - "最近1小时" -> 当前时间前1小时
  - "今天" -> 当天00:00:00到23:59:59
  - "最近24小时" -> 当前时间前24小时
- **关键词**: 用户提到的搜索关键词
- **返回条数**: 用户指定的条数，默认100

### 2. 时间格式转换
- 相对时间 -> ISO 8601格式: `YYYY-MM-DDTHH:mm:ssZ`
- 所有时间必须转换为ISO 8601格式

### 3. CLI命令构建
使用以下命令模板（在 `d:\projects\huawei-lts-cli` 目录下执行）：

```bash
node dist/cli/index.js query \\
  -g <log_group_id> \\
  -s <log_stream_id> \\
  --st <start_time> \\
  --et <end_time> \\
  [ -k <keyword> ] \\
  [ -l <limit> ] \\
  [ -o <format> ]
```

参数说明：
- `-g`: 日志组ID
- `-s`: 日志流ID
- `--st`: 起始时间（ISO 8601）
- `--et`: 结束时间（ISO 8601）
- `-k`: 关键词（可选）
- `-l`: 返回条数（可选，默认100）
- `-o`: 输出格式，可选 `json|table|pretty`（默认pretty）
- `-r`: 按时间倒序（可选）

### 4. 自然语言 -> CLI参数映射

| 用户输入 | CLI参数 |
|---------|---------|
| "查询group1的stream2" | `-g group1 -s stream2` |
| "最近1小时" | `--st 2024-06-24T09:00:00Z --et 2024-06-24T10:00:00Z` |
| "今天" | `--st 2024-06-24T00:00:00Z --et 2024-06-24T23:59:59Z` |
| "搜ERROR" | `-k "ERROR"` |
| "最新的50条" | `-l 50 -r` |

### 5. 输出处理

CLI返回的结果按以下结构展示：

```
找到 {total} 条日志记录：

| 时间 | 内容 | 标签 |
|------|------|------|
| {log_time} | {content} | {labels} |
```

如果日志条数较多，提示用户可以调整查询条件。

## Examples

### Example 1: 基础查询
**用户**: 查询日志组my-group、日志流my-stream最近1小时的日志
**Agent**:
```bash
cd d:\projects\huawei-lts-cli
node dist/cli/index.js query -g my-group -s my-stream --st 2024-06-24T09:00:00Z --et 2024-06-24T10:00:00Z
```

### Example 2: 关键词搜索
**用户**: 在my-group/my-stream中搜索包含"error"的日志，今天
**Agent**:
```bash
cd d:\projects\huawei-lts-cli
node dist/cli/index.js query -g my-group -s my-stream --st 2024-06-24T00:00:00Z --et 2024-06-24T23:59:59Z -k "error"
```

### Example 3: 限制条数
**用户**: 查询my-group/my-stream最新的20条日志
**Agent**:
```bash
cd d:\projects\huawei-lts-cli
node dist/cli/index.js query -g my-group -s my-stream --st 2024-06-01T00:00:00Z --et 2024-06-24T10:00:00Z -l 20 -r
```

## References
- CLI源码: `d:/projects/huawei-lts-cli/src/`
- 华为云LTS文档: https://support.huaweicloud.com/api-lts/lts_02_0001.html
