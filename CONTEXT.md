# Context: huawei-lts-cli

本仓库的领域词汇表。写 issue、ADR、测试名、重构提案时，一律使用这里的定义，不要漂移到「不要写成」列的同义词。

## 这是什么

一个 CLI（`lts-cli`）加一份 SKILL.md。CLI 对接华为云 LTS API；SKILL 教 AI 把自然语言转成正确的 CLI 命令。两者都不假设任何具体用户环境。

## 四个层次

| 层次 | 载体 | 谁读 | 职责 |
|---|---|---|---|
| CLI | `src/` → `dist/` | 人、AI、脚本 | 对接 LTS API，把结果格式化输出 |
| Skill | `skills/huawei-lts-log-query/` | AI | 把用户意图翻译成 CLI 调用 |
| 配置 | `~/.lts-cli/config.json` | 仅 CLI | CLI 行为：凭证、`traceField`、默认 group/stream |
| 词表 | `<skill目录>/references/vocab.md` | 仅 AI | 业务词义：应用名映射、命名约定、团队黑话。可选，默认不存在 |

**AI 不读 config。** 边界不可模糊：`config.json` 含明文凭证，任何让 AI 读取它、或把它所在目录整个交给 AI 的设计都是错的。词表因此不在凭证目录，而在 skill 目录。

## 术语

| 术语 | 定义 | 不要写成 |
|---|---|---|
| 日志组 (log group) | LTS 中日志流的容器，有独立 ID | group、组、项目 |
| 日志流 (log stream) | 实际承载日志的单元，查询的最小范围 | stream、topic、主题 |
| 索引字段 (indexed field) | 在日志流索引配置中声明过的字段，可用于 `field:value` 查询 | 字段、column、属性 |
| 全文索引 (full-text index) | 未被索引字段覆盖的内容所做的分词索引 | 全文搜索、content 字段 |
| 分词符 (tokenizer) | 把字段值切分成检索词的字符集合；字段值含分词符时必须加双引号 | 分隔符、separator |
| 搜索语句 (search statement) | 管道符之前、用于过滤日志的那段表达式 | 关键词、keyword、filter |
| 分析语句 (analysis statement) | 管道符之后、或以 `SELECT` 开头的那段聚合查询 | SQL 查询、SQL92 |
| 查询表达式 (query expression) | `-q` 的入参，可能是搜索语句、管道组合，或裸分析语句 | query、条件 |
| 游标分页 (cursor pagination) | 用 `line_num` + `search_type(forwards\|backwards)` 连续翻页 | offset 分页、翻页 |
| skill | `SKILL.md` 及其 `references/`，被 AI 加载的说明书 | 提示词、插件、prompt |
| 词表 | `<skill目录>/references/vocab.md`，可选文件，只装 API 拿不到的业务词义 | profile、词库、字典 |
| traceField | `trace` 命令用于匹配链路 ID 的字段名，存于 `config.json` | requestId 字段、链路字段 |

## 已废弃的词汇

出现即视为错误，见到就改：

| 废弃 | 现状 |
|---|---|
| `-k` / `--keyword` | 已删除。`-q "error"` 与其请求完全一致 |
| `--offset` | 已删除。LTS API 没有 offset 语义 |
| `--no-paginate` | 已删除。该参数从未被读取 |
| `profile.md` / Profile 层 | 已废除。业务词表改为 skill 目录下的 `references/vocab.md`，`init` 不再生成任何词表文件 |
| 「SQL92 查询」 | 改用「分析语句」。官方已将旧 SQL 分析标注为即将下线 |
| 「控制台迁移指南」 | 不设独立文档，映射关系并入 `query-syntax.md` |

## 真相来源

同一个事实只允许有一个去向。往第二个地方写，就会变成会过期的第二真相。

| 事实 | 唯一来源 |
|---|---|
| 有哪些字段、类型、大小写敏感、分词符 | `lts-cli fields`（运行时读索引配置） |
| 有哪些日志组 / 日志流 | `lts-cli groups` / `lts-cli streams` |
| CLI 有哪些选项 | `lts-cli <command> --help` |
| 业务名对应哪个应用 | `references/vocab.md`（若存在）；否则用管道 SQL 实时枚举候选值 |
| 公开文档里能不能出现某个词 | 本文件的「已废弃的词汇」 |

公开文件（README、SKILL.md、`references/`、issue、ADR）中**不得出现任何具体业务系统名、日志组 ID、日志流 ID 或内部项目代号**。示例一律使用 `my-app`、`service-a`、`appName:myapp` 这类中性占位。
