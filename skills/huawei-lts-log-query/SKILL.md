---
name: huawei-lts-log-query
description: 查询华为云日志服务（LTS）日志。先发现环境再查询：列日志组与日志流、读取该流的字段索引配置，再做组合筛选、请求链路还原、上下文查看与管道分析。当用户提到查看日志、搜索日志、查询日志、排查线上错误、分析慢请求、还原请求链路、trace、LTS 或华为云日志时使用。触发词：查看日志、查询日志、搜索日志、lts查询、华为云日志、log query、search logs、analyze logs、requestId、请求链路。
---

# 华为云 LTS 日志查询

用 `lts-cli` 查华为云日志服务（LTS）的日志。

## 铁律

这五条是这个 skill 存在的理由，违反任何一条都会得到「看起来成功但答案是错的」结果。

1. **不猜字段名。** 任何 `field:value` 里的 `field`，必须来自 `lts-cli fields` 的实际输出。凭印象构造的字段查询在 LTS 上不会报错，只会返回空——然后你会误判「没有这条日志」。
2. **不猜大小写是否敏感。** 这是每条日志流各自的配置（`caseSensitive`），用 `fields` 读，不要假设。
3. **不把 stderr 的警告当噪音。** 出现 `isQueryComplete=false` 或 `truncated` 警告时，结果是不完整的。此时**不要**把条数当结论、不要说「只有 N 条」，而要缩小时间范围重查。
4. **没有 offset。** LTS 只能从某个 `line_num` 往一个方向续读。想拿全部结果用 `--all`，不要自己拼翻页。
5. **不读 `~/.lts-cli/config.json`。** 里面是明文 AK/SK。需要业务词义时读 `~/.lts-cli/profile.md`。

## 前置检查

```bash
lts-cli --version     # 未安装则：npm install -g @cvtoolman/huawei-lts-cli
lts-cli config --list # 看凭证是否配好（ak/sk 已脱敏）
```

未配置时引导用户执行 `lts-cli init`。用户给了控制台日志搜索页 URL 时可直接导入：

```bash
lts-cli init --from-url "<控制台URL>"
```

## 第一步永远是发现环境

任何查询之前，先把「要查哪儿」和「有什么字段」确定下来。跳过这一步是本 skill 最常见的失败原因。

```bash
lts-cli groups                      # 日志组 name + ID
lts-cli streams --group <组名>       # 该组下的日志流 name + ID
lts-cli fields                      # 当前日志流的字段索引配置
```

`fields` 的输出里，每行给出字段名、类型、是否大小写敏感、是否支持中文分词、分词符。**后续所有查询条件都必须以这份输出为准。**

- 如果 `fields` 显示某字段不存在，就不要用它做字段查询，改用 `content:"关键词"` 全文检索。
- 如果输出提示 `No field index configured`，说明这条流只有全文检索，所有条件都走 `-q "关键词"`。

## 业务词 → 日志取值

用户说的往往不是日志里的值（「订单服务」而不是 `order-svc`）。先看有没有本机词表：

```bash
cat ~/.lts-cli/profile.md      # 存在才读；不存在就跳过，直接问用户对应哪个应用
```

词表里有映射就直接用；没有就**列候选让用户确认，不要猜**。`profile.md` 由 `lts-cli init` 生成骨架，内容是本机私有的，不要写进任何提交。

## 工作流

### 1. 组合筛选（最常用）

```bash
lts-cli query --last 2h --app <appName> --content <关键词> -r -l 50
```

- `--last` 接受 `30m / 2h / 1d / 7d`，优先用它，不要自己算 ISO 时间
- `--app` / `--content` / `--request-id` 都会自动加双引号并与其他条件用 `AND` 合并；手写 `-q` 时含连字符的值要自己加引号
- `-r` 最新优先，不加为正序
- 要机器解析就加 `-f json`

### 2. 还原请求链路

从日志内容里取到请求 ID 后：

```bash
lts-cli trace <id> --last 24h
```

默认走全文检索（`content:"<id>"`），因此不依赖任何特定字段命名。如果这条流确实有专用字段（比如 `REQUEST_ID`、`trace_id`），只配一次即可：

```bash
lts-cli config --set traceField=REQUEST_ID
lts-cli trace <id>              # 之后都按该字段精确匹配
```

`trace` 按时间正序输出，不加应用过滤（一条链路本来就会横跨多个应用）。

### 3. 查看某条日志的上下文

```bash
lts-cli context --line-num <lineNum> --time <毫秒时间戳> --before 20 --after 20
```

`lineNum` 就是 `query` / `trace` 输出里每行开头方括号内的值（`-f json` 里的 `lineNum` 字段）。

### 4. 拉全量结果

```bash
lts-cli query --last 1h -q "<条件>" --all -f json
```

- `--all` 沿游标读到末尾，上限 10000 条
- 出现 `stopped at the N-log cap` 说明还有更多，缩小范围或加条件
- 出现 `isQueryComplete=false` 说明服务端本身没给全，必须缩时间范围重查

### 5. 统计与聚合（管道语法）

```bash
lts-cli query --last 1d -q '<搜索语句> | SELECT count(*) AS cnt, <字段> GROUP BY <字段>' -f json
```

左侧是搜索语句，右侧是 SQL；也可以直接写裸 `SELECT ...`（会被识别为纯分析查询）。SQL 字段名含特殊字符时用双引号包裹。

## 从自然语言取参数

| 用户意图 | CLI 参数 | 示例 |
| --- | --- | --- |
| 时间范围 | `--last <时长>` | 「最近1小时」→ `--last 1h` |
| 精确起止 | `--st/--et <ISO8601>` | 用户给了明确时间时用，与 `--last` 互斥 |
| 指定应用 | `--app <取值>` | 取值来自 `profile.md` 或 `streams`，不要编 |
| 内容关键词 | `--content <词>` | 「包含 timeout」→ `--content timeout` |
| 请求链路 | `trace <id>` | 「查这条请求的链路」 |
| 任意组合 / 聚合 | `-q "<表达式>"` | 见 references/query-syntax.md |
| 条数 | `-l <n>` | 「最新50条」→ `-l 50 -r` |
| 排序 | `-r` | 「最新的」→ `-r` |
| 输出格式 | `-f json\|table\|pretty` | 需要程序处理时用 `json` |
| 日志组/流 | `-g <id> -s <id>` | 已配置默认值时省略 |

## 排错

按这个顺序查，不要跳过：

| 现象 | 先做什么 |
| --- | --- |
| 结果为空 | ① `-l 5` 不带条件查一次，确认这条流真的在写日志；② `lts-cli fields` 确认字段存在；③ 再逐条加回条件 |
| 字段查询为空但全文能搜到 | 该字段没有索引，改用 `--content` |
| 大小写不同结果不同 | `fields` 里该字段 `caseSensitive=yes`，按实际大小写查 |
| 结果比预期少 | 看 stderr 是否有 `isQueryComplete=false` / `truncated`，有就缩范围 |
| 认证失败 | `lts-cli config --list` 检查凭证（已脱敏） |
| 语法错误 | `AND` / `OR` / `NOT` 前后必须有空格 |
| 不知道 groupId/streamId | `lts-cli groups` / `lts-cli streams --group <组名>` |

## 参考文档

- **[查询语法](references/query-syntax.md)** — 字段查询、逻辑与比较运算、管道 SQL、引号与分词陷阱、常见错误
- **[CLI 参考](references/cli-reference.md)** — 每个命令的完整选项、输出字段、分页与完整性语义
