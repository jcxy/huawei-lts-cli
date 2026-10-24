# lts-cli 命令参考

## 全局

```bash
lts-cli --version      # 取自 package.json，不会漂移
lts-cli --help
```

环境变量优先于配置文件：`LTS_AK` `LTS_SK` `LTS_PROJECT_ID` `LTS_REGION` `LTS_ENDPOINT` `LTS_GROUP_ID` `LTS_STREAM_ID`。

## 发现类命令

### groups

```bash
lts-cli groups [-f json|pretty]
```

列出全部日志组（名称 + ID）。

### streams

```bash
lts-cli streams [--group <组名>] [-f json|pretty]
```

列出日志流。注意过滤参数是**组名不是组 ID**（API 如此），所以先用 `groups` 拿名字。不加过滤会返回所有组的流。

### fields

```bash
lts-cli fields [-g <groupId>] [-s <streamId>] [-f json|table|pretty]
```

读取该日志流的索引配置，`-f json` 的结构：

```json
{
  "streamId": "...",
  "fullText": {
    "enabled": true,
    "caseSensitive": false,
    "includeChinese": true,
    "tokenizer": " .,:;"
  },
  "fields": [
    {
      "name": "level",
      "type": "string",
      "caseSensitive": false,
      "includeChinese": false,
      "tokenizer": " .,:;",
      "quickAnalysis": true
    }
  ]
}
```

`fields` 为空时表示这条流只有全文检索，任何 `field:value` 都不会命中。

## query

```bash
lts-cli query [选项]
```

| 选项 | 说明 |
| --- | --- |
| `-g, --group-id <id>` | 日志组 ID，缺省取配置 |
| `-s, --stream-id <id>` | 日志流 ID，缺省取配置 |
| `--last <时长>` | `30m` / `2h` / `1d` / `7d`，与 `--st/--et` 互斥 |
| `--st, --start-time <ISO>` | 开始时间 |
| `--et, --end-time <ISO>` | 结束时间 |
| `-q, --query <expr>` | 搜索表达式或管道分析，见 query-syntax.md |
| `--app <取值>` | `appName:"<取值>"`，与 `-q` 用 AND 合并 |
| `--content <关键词>` | `content:"<关键词>"`，与 `-q` 用 AND 合并 |
| `--request-id <id>` | `REQUEST_ID:"<id>"`，并强制时间正序（链路定位用） |
| `-l, --limit <n>` | 每页条数，默认 100；`--all` 时即单页大小 |
| `-r, --reverse` | 最新优先 |
| `-f, --format <fmt>` | `pretty`（默认）/ `table` / `json` |
| `--all` | 沿游标读到末尾，上限 10000 条 |

已移除：`--offset`（LTS 没有 offset 语义）、`-k/--keyword`（与 `-q` 完全等价）、`--no-paginate`（单页本来就是默认）。脚本升级到 2.x 时这三处需要改。

## trace

```bash
lts-cli trace <id> [--field <name>] [--last 24h] [-l 200] [-f fmt]
```

按时间正序拉出一条 ID 的完整链路。

- `--field` 缺省时依次取 `config.traceField`、`content`（全文检索）
- 值会被自动加引号，因此含连字符的 UUID 能整体匹配
- `-l` 是总数上限；内部每页最多 500 条

## context

```bash
lts-cli context --line-num <n> --time <毫秒> [--before 20] [--after 20] [-f fmt]
```

读取某条日志前后各 N 行，等价于控制台的「查看上下文」。`lineNum` 与 `time` 都取自 `query` 的输出。

## config

```bash
lts-cli config --set <key>=<value>
lts-cli config --get <key>
lts-cli config --list          # ak/sk 自动脱敏
lts-cli config --unset <key>
```

键：`ak` `sk` `projectId` `region` `endpoint` `groupId` `streamId` `traceField`。

## init

```bash
lts-cli init                          # 交互式
lts-cli init --from-url "<控制台URL>"   # 从日志搜索页 URL 解析 region/groupId/streamId
```

跑完会在 `~/.lts-cli/` 下生成 `config.json`（0600，含明文 AK/SK）和 `profile.md`（业务词表骨架，已存在则不覆盖）。

## completion

```bash
lts-cli completion bash       # 追加到 ~/.bashrc
lts-cli completion zsh        # 追加到 ~/.zshrc
lts-cli completion powershell # 追加到 $PROFILE
```

## 输出字段

`-f json` 的结构：

```json
{
  "logs": [
    { "lineNum": "4100000000000000000", "content": "...", "labels": { "k": "v" } }
  ],
  "total": 1,
  "isQueryComplete": true
}
```

- `lineNum` 是 LTS 的 `line_num`，同时是排序键和翻页游标。**它不是时间戳**——LTS 日志记录本身不带时间字段。
- `isQueryComplete` 为 `false` 表示服务端没给全；字段缺失（`undefined`）不代表不完整，不要当成 `false`。
- 分析查询的结果在 `analysisLogs` 里，转成 `logs` 后 `lineNum` 为空，无法翻页。

## 翻页与完整性

LTS 没有 offset，只有「从某个 `line_num` 往一个方向续读」：首页不带游标，之后每次把上一页最后一条的 `line_num` 当游标，方向由排序决定（倒序 → `backwards`，正序 → `forwards`）。

CLI 的 `--all` 已经实现了这件事，包括：

- 不满一页即停
- 游标不前进即停（防止服务端把同一段重放时无限循环）
- 触达 10000 条上限时向 stderr 输出 `stopped at the N-log cap`
- 任何一页报告 `isQueryComplete=false` 时向 stderr 输出警告

**stderr 的警告不是装饰。** 它出现时，把这个结果当结论就是错的。
