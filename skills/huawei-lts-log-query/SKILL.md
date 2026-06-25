---
name: huawei-lts-log-query
description: >
  Query Huawei Cloud Log Tank Service (LTS) logs through natural language.
  Use when the user wants to search, view, query, or analyze logs on Huawei Cloud LTS.
  Supports time range filtering, keyword search, and log aggregation.
  Trigger phrases: "query logs", "search logs", "查看日志", "查询日志", "搜索日志",
  "日志查询", "lts查询", "华为云日志", "Huawei Cloud logs".
metadata:
  version: "1.0.0"
  author: "huawei-lts-cli"
  language: "zh-CN"
  tags: ["huawei-cloud", "lts", "logs", "query", "logging"]
---

# Huawei Cloud LTS Log Query

Query logs from Huawei Cloud Log Tank Service (LTS) via the `lts-cli` command.

## Prerequisites

The `lts-cli` CLI must be installed and configured:

```bash
npm install -g @cvtoolman/huawei-lts-cli
lts-cli init
```

If `lts-cli` is not found, guide the user to run the above commands first.

## How It Works

When the user asks to query logs, extract parameters from their natural language request, build the CLI command, execute it, and present the results.

### Step 1: Extract Parameters

| User Input | Parameter | Notes |
|---|---|---|
| "group1" / "stream2" | `-g group1 -s stream2` | Can be omitted if set in config |
| "last 1 hour" / "最近1小时" | `--st <1h ago> --et <now>` | Convert to ISO 8601 |
| "today" / "今天" | `--st <today 00:00:00Z> --et <today 23:59:59Z>` | |
| "last 24 hours" / "最近24小时" | `--st <24h ago> --et <now>` | |
| "ERROR" / "exception" | `-k "ERROR"` | Keyword search |
| "latest 50" / "最新50条" | `-l 50 -r` | Limit + reverse order |
| "json output" / "json格式" | `-f json` | Output format |

### Step 2: Build the Command

```
lts-cli query \
  [-g <groupId>] \
  [-s <streamId>] \
  --st <start_time> \
  --et <end_time> \
  [-k <keyword>] \
  [-l <limit>] \
  [-r] \
  [-f json|table|pretty]
```

All times must be ISO 8601 format: `YYYY-MM-DDTHH:mm:ssZ`.

`-g` and `-s` can be omitted if the user has set them in config.

### Step 3: Execute and Present

Run the command and present results clearly:

```
Found {total} log entries:

  [2024-06-24T10:30:00Z] log content here...
  [2024-06-24T10:29:55Z] another log entry...
```

If no logs are found, suggest widening the time range or removing keyword filters.
If too many logs are returned, suggest narrowing the query.

## Command Reference

```
Options:
  -g, --group-id <groupId>      Log group ID (optional if set in config)
  -s, --stream-id <streamId>    Log stream ID (optional if set in config)
  --start-time, --st <time>     Start time in ISO 8601 (required)
  --end-time, --et <time>       End time in ISO 8601 (required)
  -k, --keyword <keyword>       Search keyword
  -l, --limit <limit>           Results per page (default: 100)
  -r, --reverse                 Newest first
  -f, --format <format>         Output: pretty (default), json, table
  --no-paginate                 Single page only
```

## Examples

### Example 1: Basic Time-Range Query

**User**: Query logs from the last hour
**Agent**:
```bash
lts-cli query --st 2024-06-24T09:00:00Z --et 2024-06-24T10:00:00Z
```

### Example 2: Keyword Search

**User**: Search for "ERROR" in the logs from today
**Agent**:
```bash
lts-cli query --st 2024-06-24T00:00:00Z --et 2024-06-24T23:59:59Z -k "ERROR"
```

### Example 3: Latest N Entries

**User**: Show me the latest 20 log entries
**Agent**:
```bash
lts-cli query --st 2024-06-01T00:00:00Z --et 2024-06-24T10:00:00Z -l 20 -r
```

### Example 4: Specific Group/Stream

**User**: Query logs from group abc123, stream xyz456, last 30 minutes
**Agent**:
```bash
lts-cli query -g abc123 -s xyz456 --st 2024-06-24T09:30:00Z --et 2024-06-24T10:00:00Z
```

### Example 5: JSON Output for Further Processing

**User**: Export today's logs as JSON
**Agent**:
```bash
lts-cli query --st 2024-06-24T00:00:00Z --et 2024-06-24T23:59:59Z -f json
```
