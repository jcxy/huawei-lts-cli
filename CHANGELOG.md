# Changelog

本文件记录面向使用者的变更。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)。

## [未发布]

### 修复

- 降序翻页静默返回大量重复数据：`--all -r` 之前按排序方向把 `search_type` 推成 `backwards`，服务端会把刚拿到的那一段再给一遍（实测第二页与第一页重叠 38%~100%，且不报错）。现在续读一律用 `forwards`（详见 [ADR-0005](docs/adr/0005-full-scan-invariants.md)）
- `--last` 每页重算导致时间窗口向后滑动，游标可能滑出 `[start, end]` 而报 `LTS.0701`。相对时间现在在开查前就固定成绝对区间
- `trace` 默认搜 `content` 在结构化日志上永远零命中（全文索引只覆盖正文，ID 在 labels 里）。现在按 `--field` → `config.traceField` → 流索引里发现的 `REQUEST_ID` / `trace_id` / `span_id` 逐个 OR，找不到时 stderr 列出试过的字段
- SDK 的 log4js 把整个 axios 错误对象（含 Authorization 头）写进 stdout，`-f json` 输出因此不可解析。现在改道 stderr 并默认关闭，排查 SDK 问题时设 `LTS_CLI_DEBUG=1`
- `config --set` 回显明文 AK/SK；现在与 `--get` / `--list` 一样脱敏，且值里含 `=` 时不再拆错
- `-l` 超过服务端单页上限（5000）时直接报 `LTS.1903`；现在本地就给出 `--limit must be between 1 and 5000`，翻页内部也会封顶
- bash 补全里 `$prev` 从未赋值，取值型选项后面仍会提示选项；`context` / `groups` / `streams` 也补上了补全分支

### 变更

- `context` 的 `--time` 改为可选：`line_num` 本身就是纳秒时间戳，前 13 位即毫秒，CLI 自己推
- `query --all` 显式传 `-l` 时以 `-l` 为总数上限（与帮助文本一致），未传仍为 10000

### 移除

- `src/cli/options.ts`：无任何引用的死代码，且含 `--offset` 等已废弃选项

## [2.1.0] - 2026-10-24

### 变更

- `lts-cli init` 不再生成 `~/.lts-cli/profile.md`。业务词表改为 skill 目录下可选的 `references/vocab.md`，AI 不再被引向存有明文 AK/SK 的目录（详见 [ADR-0004](docs/adr/0004-retire-local-profile.md)）
- `SKILL.md` 的业务词定位主路径改为**运行时枚举候选值**（管道 SQL `GROUP BY`），静态词表退化为可选缓存
- `SKILL.md` 新增铁律：不读、不遍历 `~/.lts-cli/`；要看配置用已脱敏的 `lts-cli config --list`
- 业务词表默认不进版本控制（`.gitignore` 白名单，只放行两份内置参考文档）
- README 补充 `npx skills add` 安装方式，替换手工 clone + copy

### 新增

- `CHANGELOG.md`、`CONTRIBUTING.md`、`SECURITY.md`、issue / PR 模板、GitHub Actions CI

### 修复

- `init` 遇到 2.0 遗留的 `profile.md` 时打印一次性提示（不代删用户手写的文件）

### 移除

- `src/config/profile.ts` 及词表骨架生成逻辑

## [2.0.0] - 2026-10-24

破坏性变更，修的是三个会**静默出错**的问题：

### 变更

- `trace` 默认匹配字段由 `REQUEST_ID` 改为 `content`（全文检索）。`REQUEST_ID` 只是某类应用的命名约定，不是 LTS 概念；需要精确字段时 `lts-cli config --set traceField=REQUEST_ID`
- `-f json` 输出的 `logTime` 字段改名为 `lineNum`。LTS 日志记录只有 `content` / `line_num` / `labels`，本来就没有时间戳

### 新增

- `lts-cli fields`：读取日志流的索引配置（字段、类型、大小写敏感、分词符），是 skill 敢不写死字段表的前提
- `--all` 沿 `line_num` 游标读到末尾，上限 10000 条
- 结果不完整时向 stderr 输出警告（`isQueryComplete=false`、触达上限）

### 移除

- `--offset`：LTS 的 SDK 没有 offset 字段，该参数一直静默失效
- `-k, --keyword`：与 `-q` 请求完全一致
- `--no-paginate`：单页本来就是默认行为，该参数从未被读取

[2.1.0]: https://github.com/jcxy/huawei-lts-cli/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/jcxy/huawei-lts-cli/releases/tag/v2.0.0
