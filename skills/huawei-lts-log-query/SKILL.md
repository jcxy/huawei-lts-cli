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
5. **不碰 `~/.lts-cli/`。** 那里住着明文 AK/SK（`config.json`）。不要读它，也不要 `ls` / `cat` / `Get-ChildItem` 整个目录——一次通配符展开就会把凭证带进上下文，而且无法撤回。要看配置用 `lts-cli config --list`（已脱敏）。

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

用户说的往往不是日志里的值（「订单服务」而不是 `order-svc`）。按这个顺序找，不要跳步。

**第一步：本 skill 自带的词表（可选）。** 用户可能在本 skill 的 `references/` 下放了一份业务词表，约定文件名是 `vocab.md`。存在才读，不存在就直接进第二步：

```bash
cat <skill目录>/references/vocab.md   # 如 .qoder/skills/huawei-lts-log-query/references/vocab.md
```

**第二步：运行时枚举候选值（主要手段）。** 把该字段的实际取值分布连条数一起列出来，拿着这张候选表去问用户：

```bash
lts-cli query --last 1d -q '* | SELECT appName, count(*) AS cnt GROUP BY appName ORDER BY cnt DESC LIMIT 50' -f json
```

字段名本身也不能猜——先用 `lts-cli fields` 确认哪个字段装的是应用名（`appName`、`service_name`、`app` 都有可能）。

**第三步：仍然不确定就问。** 把候选值列出来让用户指认，不要自己挑一个最像的往下走。

这三步的产物只活在当前这次会话里。不要把映射写进任何文件再提交——词表是用户本机的，随 skill 安装目录走，不进版本控制。

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

字段顺序是 `--field` → `config.traceField` → 读一次流的索引配置，把 `REQUEST_ID` / `trace_id` / `span_id` 这类字段和全文检索 `content` 一起 OR 上（哪个命中都算）。结构化日志的 ID 通常住在 labels 里，全文索引覆盖不到正文以外的字段，所以不能只搜 `content`。零命中时 stderr 会写出试过哪些字段：

```bash
lts-cli trace <id> --field REQUEST_ID   # 临时指定
lts-cli config --set traceField=REQUEST_ID   # 这条流长期如此才值得配
```

`trace` 按时间正序输出，不加应用过滤（一条链路本来就会横跨多个应用）。

### 3. 查看某条日志的上下文

```bash
lts-cli context --line-num <lineNum> --before 20 --after 20
```

`lineNum` 就是 `query` / `trace` 输出里每行开头方括号内的值（`-f json` 里的 `lineNum` 字段）。毫秒时间戳不用自己算：`line_num` 本身就是纳秒时间戳，前 13 位即目标日志的毫秒时间，CLI 会自己推。只有 line_num 格式意外时，才需要补 `--time <毫秒>`。

### 4. 拉全量结果

```bash
lts-cli query --last 1h -q "<条件>" --all -f json
```

- `--all` 沿游标读到末尾，默认上限 10000 条；显式给 `-l N` 时以 N 为上限（N ≤ 5000，服务端单页上限）
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
| 指定应用 | `--app <取值>` | 取值来自 `references/vocab.md`、候选值枚举或用户确认，不要编 |
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
