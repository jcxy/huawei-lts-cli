# huawei-lts-cli — CLI + SKILL

[简体中文](README.md) | **English**

[![npm version](https://img.shields.io/npm/v/@cvtoolman/huawei-lts-cli.svg)](https://www.npmjs.com/package/@cvtoolman/huawei-lts-cli)
[![CI](https://github.com/jcxy/huawei-lts-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/jcxy/huawei-lts-cli/actions/workflows/ci.yml)
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
| **Setup** | One `npm install`, one skill directory | Server process, config wiring |
| **Best for** | Query-style tasks inside a coding session | Long-running, stateful automation loops |

> **Bottom line:** If you want your AI coding assistant to query Huawei Cloud logs while working on your codebase — CLI + SKILL is the lighter, cheaper option.

## Core design: discover first, then query

Field names, field types, case sensitivity, tokenizers — **all of these are per-log-stream configuration**, not universal LTS facts. Any field table baked into documentation is wrong for every other environment, and it fails silently: the query returns nothing instead of erroring.

So this tool always gets its answers at runtime:

```bash
lts-cli groups                    # which log groups do I have
lts-cli streams --group <name>    # which streams are in this group
lts-cli fields                    # which fields exist, of what type, case-sensitive?
lts-cli query --last 2h -q '...'  # now query
```

`fields` is new in 2.0 and is why the skill ships without any field table. SKILL.md tells the AI: every field name in a `field:value` query must come from actual `fields` output. A guessed field query does not error on LTS — it just returns nothing, and the AI concludes "that log doesn't exist".

## Quick Start

### 1. Install the CLI

```bash
npm install -g @cvtoolman/huawei-lts-cli
```

Requires Node.js >= 18.

### 2. Configure credentials

```bash
lts-cli init
```

The wizard asks for AK, SK, Project ID and Region once, and writes exactly one file:

| File | Holds | Read by |
|---|---|---|
| `~/.lts-cli/config.json` | credentials, default group/stream, `traceField` (mode 0600) | the CLI only |

**Never hand that directory to an agent.** It holds a plaintext AK/SK. To inspect config, use `lts-cli config --list` (masked) instead of opening the file.

Which log groups exist, what the fields are called, what values they take — all of that is read live via `lts-cli groups` / `streams` / `fields`. No second copy is kept in the repo or the config.

If you have a console log-search page URL, import region / groupId / streamId from it:

```bash
lts-cli init --from-url "<console URL>"
```

### 3. Install the skill (for AI tools)

Use the [skills CLI](https://skills.sh) — one command, and it knows where each agent expects its skills:

```bash
npx skills add jcxy/huawei-lts-cli -a claude-code    # Claude Code
npx skills add jcxy/huawei-lts-cli -a qoder          # Qoder
npx skills add jcxy/huawei-lts-cli -a cursor         # Cursor
npx skills add jcxy/huawei-lts-cli                   # pick interactively
```

Restart your AI tool afterwards: skills are loaded at session start, so an already-open session will not pick it up. Use `npx skills update` to upgrade and `npx skills remove` to uninstall.

Or copy it by hand — works with any tool:

```bash
git clone --depth 1 https://github.com/jcxy/huawei-lts-cli.git /tmp/huawei-lts-cli
cp -r /tmp/huawei-lts-cli/skills/huawei-lts-log-query <your skills dir>/
```

> By default `npx skills` symlinks to one git clone, so updates stay in sync. With `--copy` (the fallback when Windows refuses symlinks) or plugin-style installs, an upgrade replaces the whole directory — back up your vocabulary file first.

### 4. Business vocabulary (optional)

The AI does not know what "order service" is called in your logs. Two paths, neither needs a config file:

- **Default**: the AI enumerates candidate values at runtime with pipeline SQL (`* | SELECT appName, count(*) GROUP BY appName`) and asks you which one to use. Nothing is persisted, so nothing goes stale.
- **To skip that step**: put the mapping in `references/vocab.md` inside the skill. The file does not exist by default, and it is git-ignored so it cannot be committed by accident.

### 5. Use from the command line (without AI)

```bash
# Latest 50 logs in the past 2 hours
lts-cli query --last 2h -r -l 50

# Combined filters
lts-cli query --last 2h --app <appName> --content timeout -r

# Arbitrary expression
lts-cli query --last 1d -q '(level:ERROR OR level:WARN) NOT env:test' -r

# Pipeline analysis: filter, then aggregate
lts-cli query --last 1d -q 'level:ERROR | SELECT count(*) AS cnt, appName GROUP BY appName' -f json

# Machine-readable
lts-cli query --last 1h -f json | jq '.logs[].content'
```

> 💡 Syntax details: [query syntax](skills/huawei-lts-log-query/references/query-syntax.md). Full command surface: [CLI reference](skills/huawei-lts-log-query/references/cli-reference.md).

## Commands

| Command | Purpose |
|---|---|
| `lts-cli groups` | List log groups |
| `lts-cli streams` | List log streams (`--group <name>` to filter) |
| `lts-cli fields` | Read a stream's index configuration |
| `lts-cli query` | Query logs |
| `lts-cli trace <id>` | Rebuild a full request chain by ID |
| `lts-cli context` | Show logs before/after a given entry |
| `lts-cli config` | Manage configuration |
| `lts-cli init` | Setup wizard |
| `lts-cli completion` | Generate shell completion |

### `lts-cli query`

```
-g, --group-id <id>       Log group ID (falls back to config)
-s, --stream-id <id>      Log stream ID (falls back to config)
--last <duration>         30m / 2h / 1d / 7d; mutually exclusive with --st/--et
--st, --start-time <ISO>  Start time
--et, --end-time <ISO>    End time
-q, --query <expr>        Query expression or pipeline analysis
--app <value>             appName:"<value>", ANDed with -q
--content <keyword>       content:"<keyword>", ANDed with -q
--request-id <id>         REQUEST_ID:"<id>", chronological output
-l, --limit <n>           Page size (default 100); also the page size for --all
-r, --reverse             Newest first
-f, --format <fmt>        pretty (default) / table / json
--all                     Follow the cursor to the end (up to 10000 logs)
```

`--app` / `--content` / `--request-id` quote the value for you — a UUID with hyphens is tokenized apart without quotes, and then never matches.

### `lts-cli trace`

```bash
lts-cli trace <id> [--field <name>] [--last 24h] [-l 200] [-f fmt]
```

Fetches one ID's full chain in chronological order. It searches full text by default (no dependence on any particular field naming). If your stream does have a dedicated field, configure it once:

```bash
lts-cli config --set traceField=REQUEST_ID
```

## Configuration

`~/.lts-cli/config.json` (`%USERPROFILE%\.lts-cli\config.json` on Windows):

| Key | Required | Meaning |
|---|---|---|
| `ak` | yes | Huawei Cloud access key |
| `sk` | yes | Huawei Cloud secret key |
| `projectId` | yes | Project ID |
| `region` | no | e.g. `cn-north-4` |
| `endpoint` | no | Must include `https://` |
| `groupId` | no | Default log group ID |
| `streamId` | no | Default log stream ID |
| `traceField` | no | Field `trace` matches against; defaults to `content` |

`lts-cli config --list` masks `ak` / `sk`, so credentials don't end up in terminal scrollback, shell history, or an AI context window.

### Environment variables

Every key is also readable from the environment (useful in CI), and takes precedence over the config file:

`LTS_AK` `LTS_SK` `LTS_PROJECT_ID` `LTS_REGION` `LTS_ENDPOINT` `LTS_GROUP_ID` `LTS_STREAM_ID`

## Supported regions

The region → endpoint map built into `lts-cli init`:

| Region ID | Endpoint |
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

If yours isn't listed, pass `--set endpoint=https://...` or see the [LTS endpoint reference](https://support.huaweicloud.com/api-lts/lts_api_0011.html).

## Upgrading

### From 2.0 to 2.1

| Change | Notes |
|---|---|
| `init` no longer writes `~/.lts-cli/profile.md` | Business vocabulary now lives in the skill as `references/vocab.md`. The old file can be deleted; leaving it changes nothing (the CLI never read it) |
| SKILL.md gained runtime value enumeration | App names can be located without a vocabulary file |
| `npx skills` install added | See “Install the skill” above |

No command-line flags changed, so scripts keep working.

### From 1.x to 2.0

2.0 fixes three silent-failure bugs, hence the breaking changes:

| Change | Why | Migration |
|---|---|---|
| `--offset` removed | The LTS SDK has no offset field at all — the flag never worked. `--all` re-fetched the same page until it hit the 10000 cap | Use `--all`, or narrow the time range |
| `-k, --keyword` removed | Behaviourally identical to `-q` | Use `-q "<keyword>"` |
| `--no-paginate` removed | Single page was already the default; the flag was never read | Just delete it |
| `trace` default field: `REQUEST_ID` → `content` | `REQUEST_ID` is one app family's naming convention, not an LTS concept | `lts-cli config --set traceField=REQUEST_ID` |
| `-f json` field `logTime` renamed to `lineNum` | LTS log records only carry `content` / `line_num` / `labels` — there is no timestamp, so the old name was a lie | Update your parsing scripts |

Results also now warn on stderr when incomplete (`isQueryComplete=false`, or the 10000-log cap). **Do not ignore those warnings** — the result really is partial.

## Development

```bash
git clone https://github.com/jcxy/huawei-lts-cli.git
cd huawei-lts-cli
npm install

npm run build      # compile to dist/
npm run dev -- query --last 2h     # run straight from source
npm test           # node:test — pure functions and cursor advancement
npm run typecheck  # tsc --noEmit
```

Tests use Node's built-in `node:test` with `tsx`; no extra test dependency. Running them needs Node >= 20.6 (`--import` support).

Architecture notes live in [CONTEXT.md](CONTEXT.md) and [docs/adr/](docs/adr/).

## License

[MIT](LICENSE)
