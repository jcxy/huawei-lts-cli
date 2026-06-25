# huawei-lts-cli — CLI + SKILL

[English](README.md) | **简体中文**

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
| **配置难度** | `npm install -g`、一个 skill 文件 | 服务进程、配置连线 |
| **适用场景** | 编码过程中顺手查日志 | 长时间运行的自动化循环 |

> **一句话：** 如果你想让 AI 在写代码时顺嘴帮你查日志——CLI + SKILL 是更轻、更省钱的方案。

## 快速开始

### 1. 安装 CLI

```bash
npm install -g @cvtoolman/huawei-lts-cli
```

### 2. 配置凭证

```bash
lts-cli init
```

向导会依次询问 AK、SK、Project ID、Region，一次配好。配置存储在 `~/.lts-cli/config.json`。

### 3. 安装 Skill（给 AI 工具用）

**Claude Code:**
```bash
mkdir -p .claude/skills/huawei-lts-log-query
curl -o .claude/skills/huawei-lts-log-query/SKILL.md \
  https://raw.githubusercontent.com/jcxy/huawei-lts-cli/main/skills/huawei-lts-log-query/SKILL.md
```

**Qoder:**
```bash
mkdir -p .qoder/skills/huawei-lts-log-query
curl -o .qoder/skills/huawei-lts-log-query/SKILL.md \
  https://raw.githubusercontent.com/jcxy/huawei-lts-cli/main/skills/huawei-lts-log-query/SKILL.md
```

**手动安装（任意 AI 工具）：** 将 [skills/huawei-lts-log-query/SKILL.md](skills/huawei-lts-log-query/SKILL.md) 复制到对应 AI 工具的 skills 目录下（`.claude/skills/`、`.qoder/skills/`、`.cursor/skills/` 等）。

### 4. 命令行直接使用（不依赖 AI）

```bash
# 基础查询
lts-cli query --st 2024-01-01T00:00:00Z --et 2024-01-02T00:00:00Z

# 关键词搜索
lts-cli query --st 2024-01-01T00:00:00Z --et 2024-01-02T00:00:00Z -k "ERROR"

# JSON 格式输出，管道给 jq 处理
lts-cli query --st 2024-01-01T00:00:00Z --et 2024-01-02T00:00:00Z -f json | jq .
```

## 命令参考

### `lts-cli query` — 查询日志

```
lts-cli query [选项]

选项:
  -g, --group-id <groupId>      日志组 ID（可在配置中预设）
  -s, --stream-id <streamId>    日志流 ID（可在配置中预设）
  --start-time, --st <time>     开始时间，ISO 8601 格式（必填）
  --end-time, --et <time>       结束时间，ISO 8601 格式（必填）
  -k, --keyword <keyword>       搜索关键词
  -l, --limit <limit>           每页条数（默认: 100）
  -o, --offset <offset>         分页偏移量（默认: 0）
  -r, --reverse                 按时间倒序
  -f, --format <format>         输出格式: pretty、json、table（默认: pretty）
  --no-paginate                 关闭自动翻页
```

### `lts-cli config` — 管理配置

```
lts-cli config [选项]

选项:
  --set <key=value>             设置配置项
  --get <key>                   查看配置项
  --list                        列出所有配置
  --unset <key>                 删除配置项
```

### `lts-cli init` — 配置向导

```
lts-cli init

交互式向导，引导设置 AK、SK、Project ID、Region、endpoint，
以及可选的默认日志组和日志流。
```

### `lts-cli completion` — Shell 补全

```
lts-cli completion <bash|zsh|powershell>

生成 shell 补全脚本。
```

## 配置说明

配置存储在 `~/.lts-cli/config.json`（Linux/macOS）或 `%USERPROFILE%\.lts-cli\config.json`（Windows）。

| 键 | 必填 | 说明 |
|---|---|---|
| `ak` | 是 | 华为云访问密钥 |
| `sk` | 是 | 华为云私有密钥 |
| `projectId` | 是 | 项目 ID |
| `region` | 否 | 如 `cn-south-1` |
| `endpoint` | 否 | 需包含 `https://` |
| `groupId` | 否 | 默认日志组 ID |
| `streamId` | 否 | 默认日志流 ID |

### 环境变量

所有配置项也支持环境变量（适用于 CI/CD）：

| 配置键 | 环境变量 |
|---|---|
| `ak` | `LTS_AK` |
| `sk` | `LTS_SK` |
| `projectId` | `LTS_PROJECT_ID` |
| `region` | `LTS_REGION` |
| `endpoint` | `LTS_ENDPOINT` |
| `groupId` | `LTS_GROUP_ID` |
| `streamId` | `LTS_STREAM_ID` |

环境变量优先级高于配置文件。

## 支持的区域

| 区域 ID | 区域名称 | Endpoint |
|---|---|---|
| `cn-north-1` | 华北-北京一 | `lts.cn-north-1.myhuaweicloud.com` |
| `cn-north-4` | 华北-北京四 | `lts.cn-north-4.myhuaweicloud.com` |
| `cn-east-2` | 华东-上海二 | `lts.cn-east-2.myhuaweicloud.com` |
| `cn-east-3` | 华东-上海三 | `lts.cn-east-3.myhuaweicloud.com` |
| `cn-south-1` | 华南-广州 | `lts.cn-south-1.myhuaweicloud.com` |
| `cn-south-4` | 华南-深圳 | `lts.cn-south-4.myhuaweicloud.com` |
| `cn-southwest-2` | 西南-贵阳一 | `lts.cn-southwest-2.myhuaweicloud.com` |
| `ap-southeast-1` | 亚太-新加坡 | `lts.ap-southeast-1.myhuaweicloud.com` |
| `ap-southeast-2` | 亚太-曼谷 | `lts.ap-southeast-2.myhuaweicloud.com` |
| `ap-southeast-3` | 亚太-雅加达 | `lts.ap-southeast-3.myhuaweicloud.com` |
| `af-south-1` | 非洲-约翰内斯堡 | `lts.af-south-1.myhuaweicloud.com` |

> 完整列表请参考 [华为云 LTS 终端节点](https://support.huaweicloud.com/api-lts/lts_api_0011.html)。

## 开发指南

```bash
git clone https://github.com/jcxy/huawei-lts-cli.git
cd huawei-lts-cli
npm install
npm run build

# 开发模式运行（无需编译）
npm run dev -- query --st 2024-01-01T00:00:00Z --et 2024-01-02T00:00:00Z

# 本地测试
npm link
lts-cli query --st 2024-01-01T00:00:00Z --et 2024-01-02T00:00:00Z
```

## License

[MIT](LICENSE)
