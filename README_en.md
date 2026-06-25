# huawei-lts-cli — CLI + SKILL

[简体中文](README.md) | **English**

[![npm version](https://img.shields.io/npm/v/@cvtoolman/huawei-lts-cli.svg)](https://www.npmjs.com/package/@cvtoolman/huawei-lts-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> Let your AI coding assistant (Claude Code, Cursor, Copilot, Qoder, etc.) query Huawei Cloud Log Tank Service (LTS) logs — through natural language.

**Two parts, one tool:**

| Part | Role |
|---|---|
| **CLI** (`lts-cli`) | A lightweight command-line tool that talks to the Huawei Cloud LTS API |
| **SKILL** (`SKILL.md`) | A "cheat sheet" that teaches AI assistants how to use the CLI from natural language |

The AI reads the skill, you ask "show me today's error logs" in plain English (or Chinese), and the AI builds and runs the right `lts-cli` command for you. No need to memorize flags or time formats.

## Why CLI + SKILL instead of MCP?

For high-throughput coding assistants that juggle large codebases, tests, and reasoning inside a limited context window, **token efficiency matters**.

| | CLI + SKILL | MCP |
|---|---|---|
| **Context cost** | **Low** — the skill is a short markdown file; CLI output is lean text | **High** — tool schemas + snapshots stay in context |
| **How AI uses it** | Executes a shell command, reads the result | Calls structured tools via protocol |
| **Setup** | One `npm install`, one skill file | Server process, config wiring |
| **Best for** | Query-style tasks inside a coding session | Long-running, stateful automation loops |

> **Bottom line:** If you want your AI coding assistant to query Huawei Cloud logs while working on your codebase — CLI + SKILL is the lighter, cheaper option.

## Quick Start

### 1. Install the CLI

```bash
npm install -g @cvtoolman/huawei-lts-cli
```

### 2. Configure credentials

```bash
lts-cli init
```

The wizard asks for AK, SK, Project ID, Region — once. Values are stored in `~/.lts-cli/config.json`.

### 3. Install the skill (for AI tools)

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

**Manual (any AI tool):** Copy [skills/huawei-lts-log-query/SKILL.md](skills/huawei-lts-log-query/SKILL.md) into your AI tool's skills directory (`.claude/skills/`, `.qoder/skills/`, `.cursor/skills/`, etc.).

### 4. Use from the command line (without AI)

```bash
# Basic query
lts-cli query --st 2024-01-01T00:00:00Z --et 2024-01-02T00:00:00Z

# Keyword search
lts-cli query --st 2024-01-01T00:00:00Z --et 2024-01-02T00:00:00Z -k "ERROR"

# JSON output for piping
lts-cli query --st 2024-01-01T00:00:00Z --et 2024-01-02T00:00:00Z -f json | jq .
```

## Command Reference

### `lts-cli query`

```
lts-cli query [options]

Options:
  -g, --group-id <groupId>      Log group ID (can be preset in config)
  -s, --stream-id <streamId>    Log stream ID (can be preset in config)
  --start-time, --st <time>     Start time, ISO 8601 (required)
  --end-time, --et <time>       End time, ISO 8601 (required)
  -k, --keyword <keyword>       Search keyword
  -l, --limit <limit>           Results per page (default: 100)
  -o, --offset <offset>         Pagination offset (default: 0)
  -r, --reverse                 Newest first
  -f, --format <format>         Output: pretty, json, table (default: pretty)
  --no-paginate                 Single page only
```

### `lts-cli config`

```
lts-cli config [options]

Options:
  --set <key=value>             Set a config value
  --get <key>                   Get a config value
  --list                        List all config values
  --unset <key>                 Remove a config value
```

### `lts-cli init`

```
lts-cli init

Interactive setup wizard for AK, SK, Project ID, region, endpoint,
and optional default log group/stream.
```

### `lts-cli completion`

```
lts-cli completion <bash|zsh|powershell>

Generate shell completion script.
```

## Configuration

Stored in `~/.lts-cli/config.json` (Linux/macOS) or `%USERPROFILE%\.lts-cli\config.json` (Windows).

| Key | Required | Description |
|---|---|---|
| `ak` | Yes | Huawei Cloud Access Key |
| `sk` | Yes | Huawei Cloud Secret Key |
| `projectId` | Yes | Project ID |
| `region` | No | e.g. `cn-south-1` |
| `endpoint` | No | Must include `https://` |
| `groupId` | No | Default log group ID |
| `streamId` | No | Default log stream ID |

### Environment Variables

All keys can also be set via env vars (useful for CI/CD):

| Config Key | Environment Variable |
|---|---|
| `ak` | `LTS_AK` |
| `sk` | `LTS_SK` |
| `projectId` | `LTS_PROJECT_ID` |
| `region` | `LTS_REGION` |
| `endpoint` | `LTS_ENDPOINT` |
| `groupId` | `LTS_GROUP_ID` |
| `streamId` | `LTS_STREAM_ID` |

Env vars take precedence over config file values.

## Supported Regions

| Region ID | Name | Endpoint |
|---|---|---|
| `cn-north-1` | CN North-Beijing1 | `lts.cn-north-1.myhuaweicloud.com` |
| `cn-north-4` | CN North-Beijing4 | `lts.cn-north-4.myhuaweicloud.com` |
| `cn-east-2` | CN East-Shanghai2 | `lts.cn-east-2.myhuaweicloud.com` |
| `cn-east-3` | CN East-Shanghai3 | `lts.cn-east-3.myhuaweicloud.com` |
| `cn-south-1` | CN South-Guangzhou | `lts.cn-south-1.myhuaweicloud.com` |
| `cn-south-4` | CN South-Shenzhen | `lts.cn-south-4.myhuaweicloud.com` |
| `cn-southwest-2` | CN Southwest-Guiyang | `lts.cn-southwest-2.myhuaweicloud.com` |
| `ap-southeast-1` | AP-Singapore | `lts.ap-southeast-1.myhuaweicloud.com` |
| `ap-southeast-2` | AP-Bangkok | `lts.ap-southeast-2.myhuaweicloud.com` |
| `ap-southeast-3` | AP-Jakarta | `lts.ap-southeast-3.myhuaweicloud.com` |
| `af-south-1` | AF-Johannesburg | `lts.af-south-1.myhuaweicloud.com` |

> Full list: [Huawei Cloud LTS Endpoints](https://support.huaweicloud.com/intl/en-us/api-lts/lts_api_0011.html).

## Development

```bash
git clone https://github.com/jcxy/huawei-lts-cli.git
cd huawei-lts-cli
npm install
npm run build

# Dev mode (no build step needed)
npm run dev -- query --st 2024-01-01T00:00:00Z --et 2024-01-02T00:00:00Z

# Local testing
npm link
lts-cli query --st 2024-01-01T00:00:00Z --et 2024-01-02T00:00:00Z
```

## License

[MIT](LICENSE)
