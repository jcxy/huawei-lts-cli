# huawei-lts-cli — CLI + SKILL

**简体中文** | [English](README_en.md)

[![npm version](https://img.shields.io/npm/v/@cvtoolman/huawei-lts-cli.svg)](https://www.npmjs.com/package/@cvtoolman/huawei-lts-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> 让你的 AI 编程助手（Claude Code、Cursor、Copilot、Qoder 等）通过自然语言查询华为云日志服务（LTS）。

**一个工具，两部分：**

| 部分 | 作用 |
|---|---|
| **CLI** (`lts-cli`) | 轻量命令行工具，对接华为云 LTS API |
| **SKILL** (`SKILL.md`) | 一份给 AI 看的"说明书"，教它如何把自然语言转成 CLI 命令 |

AI 读完 skill 后，你只需说一句"查下今天的 ERROR 日志"，AI 就能自动拼出正确的 `lts-cli` 命令并执行。不用记参数，不用手写 ISO 8601 时间格式。

## 为什么用 CLI + SKILL 而不是 MCP？

AI 编程助手的上下文窗口很宝贵——一边要装代码库、一边要推理、一边还要跑工具。**省 token 就是省时省钱。**

| | CLI + SKILL | MCP |
|---|---|---|
| **上下文开销** | **低** — skill 就一个短 markdown 文件，CLI 输出是纯文本 | **高** — 工具 schema + 快照数据常驻上下文 |
| **AI 使用方式** | 执行 shell 命令，读取结果 | 通过协议调用结构化工具 |
| **配置难度** | `npm install -g`、一个 skill 目录 | 服务进程、配置连线 |
| **适用场景** | 编码过程中顺手查日志 | 长时间运行的自动化循环 |

> **一句话：** 如果你想让 AI 在写代码时顺嘴帮你查日志——CLI + SKILL 是更轻、更省钱的方案。

## 核心设计：先发现，再查询

字段名、字段类型、是否大小写敏感、分词符——**这些全是每条日志流各自的配置**，不是 LTS 的通用事实。任何写死在文档里的字段表，换个环境就是错的，而且不会报错，只会返回空结果。

所以这个工具的答案永远来自运行时：

```bash
lts-cli groups                    # 我有哪些日志组
lts-cli streams --group <组名>     # 这个组下有哪些流
lts-cli fields                    # 这条流有哪些字段、什么类型、大小写敏感吗
lts-cli query --last 2h -q '...'  # 这才开始查
```

`fields` 是 2.0 新增的命令，也是 skill 敢不写任何字段表的前提。SKILL.md 里明确要求 AI：任何 `field:value` 里的字段，必须来自 `fields` 的实际输出；凭印象构造的字段查询在 LTS 上不会报错，只会返回空——然后 AI 会误判"没有这条日志"。

## 快速开始

### 1. 安装 CLI

```bash
npm install -g @cvtoolman/huawei-lts-cli
```

需要 Node.js >= 18。

### 2. 配置凭证

```bash
lts-cli init
```

向导会依次询问 AK、SK、Project ID、Region，一次配好。同时会生成两个文件：

| 文件 | 内容 | 谁读 |
|---|---|---|
| `~/.lts-cli/config.json` | 凭证、默认日志组/流、`traceField`（权限 0600） | 仅 CLI |
| `~/.lts-cli/profile.md` | 业务词表：把「订单服务」映射到日志里的实际取值 | 仅 AI |

**CLI 不读 `profile.md`，AI 不读 `config.json`。** 后者含明文 AK/SK，任何让 AI 读它的设计都是错的。

拿到控制台日志搜索页的 URL 时，可以直接导入 region / groupId / streamId：

```bash
lts-cli init --from-url "<控制台URL>"
```

### 3. 安装 Skill（给 AI 工具用）

skill 目录含 `SKILL.md` 和 2 个参考文档，整目录复制：

```bash
# Claude Code
git clone --depth 1 https://github.com/jcxy/huawei-lts-cli.git /tmp/huawei-lts-cli
mkdir -p .claude/skills/huawei-lts-log-query
cp -r /tmp/huawei-lts-cli/skills/huawei-lts-log-query/. .claude/skills/huawei-lts-log-query/

# Qoder：把 .claude/skills/ 换成 .qoder/skills/
# 其他工具：换成对应目录（.cursor/skills/ 等）
```

Windows PowerShell：

```powershell
git clone --depth 1 https://github.com/jcxy/huawei-lts-cli.git $env:TEMP\huawei-lts-cli
New-Item -ItemType Directory -Force .claude\skills\huawei-lts-log-query | Out-Null
Copy-Item -Recurse -Force $env:TEMP\huawei-lts-cli\skills\huawei-lts-log-query\* .claude\skills\huawei-lts-log-query\
```

### 4. 命令行直接使用（不依赖 AI）

```bash
# 最近 2 小时最新 50 条
lts-cli query --last 2h -r -l 50

# 组合条件
lts-cli query --last 2h --app <appName> --content timeout -r

# 任意表达式
lts-cli query --last 1d -q '(level:ERROR OR level:WARN) NOT env:test' -r

# 管道分析：先过滤再统计
lts-cli query --last 1d -q 'level:ERROR | SELECT count(*) AS cnt, appName GROUP BY appName' -f json

# 机器处理
lts-cli query --last 1h -f json | jq '.logs[].content'
```

> 💡 语法细节见 [查询语法](skills/huawei-lts-log-query/references/query-syntax.md)，命令全貌见 [CLI 参考](skills/huawei-lts-log-query/references/cli-reference.md)。

## 命令参考

| 命令 | 作用 |
|---|---|
| `lts-cli groups` | 列出日志组 |
| `lts-cli streams` | 列出日志流（`--group <组名>` 过滤） |
| `lts-cli fields` | 读取日志流的索引配置 |
| `lts-cli query` | 查询日志 |
| `lts-cli trace <id>` | 按 ID 还原完整请求链路 |
| `lts-cli context` | 查看某条日志的前后文 |
| `lts-cli config` | 管理配置 |
| `lts-cli init` | 配置向导 |
| `lts-cli completion` | 生成 shell 补全 |

### `lts-cli query`

```
-g, --group-id <id>       日志组 ID（可在配置中预设）
-s, --stream-id <id>      日志流 ID（可在配置中预设）
--last <时长>             30m / 2h / 1d / 7d，与 --st/--et 互斥
--st, --start-time <ISO>  开始时间
--et, --end-time <ISO>    结束时间
-q, --query <expr>        查询表达式或管道分析
--app <取值>              appName:"<取值>"，与 -q 用 AND 合并
--content <关键词>        content:"<关键词>"，与 -q 用 AND 合并
--request-id <id>         REQUEST_ID:"<id>"，按时间正序输出
-l, --limit <n>           每页条数（默认 100），--all 时即单页大小
-r, --reverse             最新优先
-f, --format <fmt>        pretty（默认）/ table / json
--all                     沿游标读到末尾（上限 10000 条）
```

`--app` / `--content` / `--request-id` 自动为值加双引号——含连字符的 UUID 不加引号会被分词导致匹配不到。

### `lts-cli trace`

```bash
lts-cli trace <id> [--field <name>] [--last 24h] [-l 200] [-f fmt]
```

按时间正序拉出一条 ID 的完整链路。默认走全文检索（不依赖任何特定字段命名）；如果你的日志流有专用字段，配一次即可：

```bash
lts-cli config --set traceField=REQUEST_ID
```

## 配置说明

配置文件 `~/.lts-cli/config.json`（Windows 为 `%USERPROFILE%\.lts-cli\config.json`）：

| 键 | 必填 | 说明 |
|---|---|---|
| `ak` | 是 | 华为云访问密钥 |
| `sk` | 是 | 华为云私有密钥 |
| `projectId` | 是 | 项目 ID |
| `region` | 否 | 如 `cn-north-4` |
| `endpoint` | 否 | 需包含 `https://` |
| `groupId` | 否 | 默认日志组 ID |
| `streamId` | 否 | 默认日志流 ID |
| `traceField` | 否 | `trace` 默认匹配的字段名，缺省为 `content` |

`lts-cli config --list` 会把 `ak` / `sk` 脱敏输出，避免凭证进入终端滚屏、shell 历史或 AI 上下文。

### 环境变量

所有配置项都支持环境变量（适用于 CI/CD），优先级高于配置文件：

`LTS_AK` `LTS_SK` `LTS_PROJECT_ID` `LTS_REGION` `LTS_ENDPOINT` `LTS_GROUP_ID` `LTS_STREAM_ID`

## 支持的区域

以下是 `lts-cli init` 内置的 region → endpoint 映射：

| 区域 ID | Endpoint |
|---|---|
| `cn-north-1` | `lts.cn-north-1.myhuaweicloud.com` |
| `cn-north-2` | `lts.cn-north-2.myhuaweicloud.com` |
| `cn-north-4` | `lts.cn-north-4.myhuaweicloud.com` |
| `cn-north-5` | `lts.cn-north-5.myhuaweicloud.com` |
| `cn-north-9` | `lts.cn-north-9.myhuaweicloud.com` |
| `cn-east-2` | `lts.cn-east-2.myhuaweicloud.com` |
| `cn-east-3` | `lts.cn-east-3.myhuaweicloud.com` |
| `cn-east-4` | `lts.cn-east-4.myhuaweicloud.com` |
| `cn-south-1` | `lts.cn-south-1.myhuaweicloud.com` |
| `cn-south-2` | `lts.cn-south-2.myhuaweicloud.com` |
| `cn-south-4` | `lts.cn-south-4.myhuaweicloud.com` |
| `cn-southwest-2` | `lts.cn-southwest-2.myhuaweicloud.com` |
| `ap-southeast-1` | `lts.ap-southeast-1.myhuaweicloud.com` |
| `ap-southeast-2` | `lts.ap-southeast-2.myhuaweicloud.com` |
| `ap-southeast-3` | `lts.ap-southeast-3.myhuaweicloud.com` |
| `af-south-1` | `lts.af-south-1.myhuaweicloud.com` |
| `la-south-2` | `lts.la-south-2.myhuaweicloud.com` |
| `la-north-2` | `lts.la-north-2.myhuaweicloud.com` |
| `sa-brazil-1` | `lts.sa-brazil-1.myhuaweicloud.com` |
| `na-mexico-1` | `lts.na-mexico-1.myhuaweicloud.com` |

不在表里时用 `--set endpoint=https://...` 手动指定，或参考 [华为云 LTS 终端节点](https://support.huaweicloud.com/api-lts/lts_api_0011.html)。

## 从 1.x 升级到 2.0

2.0 修了三个会静默出错的问题，因此有破坏性变更：

| 变更 | 原因 | 迁移 |
|---|---|---|
| 删除 `--offset` | LTS 的 SDK 根本没有 offset 字段，该参数一直静默失效；`--all` 会重复拉同一页直到塞满 10000 条 | 用 `--all`，或缩小时间范围 |
| 删除 `-k, --keyword` | 与 `-q` 行为完全等价 | 改成 `-q "<关键词>"` |
| 删除 `--no-paginate` | 单页本来就是默认行为，该参数从未被读取 | 直接删掉 |
| `trace` 默认字段由 `REQUEST_ID` 改为 `content` | `REQUEST_ID` 只是某类应用的命名约定，不是 LTS 通用概念 | 需要精确字段时 `lts-cli config --set traceField=REQUEST_ID` |
| `-f json` 输出字段 `logTime` 改名为 `lineNum` | LTS 的日志记录只有 `content` / `line_num` / `labels`，没有时间戳，原名是错的 | 更新解析脚本 |

此外，结果不完整时会向 stderr 输出警告（`isQueryComplete=false` 或触达 10000 条上限）。**这些警告不能忽略**——此时结果就是残缺的。

## 开发指南

```bash
git clone https://github.com/jcxy/huawei-lts-cli.git
cd huawei-lts-cli
npm install

npm run build      # 编译到 dist/
npm run dev -- query --last 2h     # 直接从源码跑
npm test           # node:test，覆盖纯函数与游标推进
npm run typecheck  # tsc --noEmit
```

测试使用 Node 内置的 `node:test` + `tsx`，不引入额外测试依赖。跑测试需要 Node >= 20.6（`--import` 的要求）。

架构约定见 [CONTEXT.md](CONTEXT.md) 与 [docs/adr/](docs/adr/)。

## License

[MIT](LICENSE)
