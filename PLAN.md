# 华为云LTS CLI+Skill日志查询工具 — 实施计划

## Context

用户需要一个基于Node.js/TypeScript的CLI工具，用于查询华为云日志服务(LTS)中的日志。同时需要以Qoder Skill的形式集成，使得Agent可以通过自然语言或命令行参数调用该工具进行日志查询。项目目录为 `d:\projects\huawei-lts-cli`（当前为空）。

## 目标

构建一个功能完整的CLI工具 `lts-cli`，支持通过华为云API查询日志，并以Qoder Skill形式暴露给Agent使用。支持基础查询、关键词搜索、时间范围过滤、分页和多种输出格式。

## 技术栈

- **Runtime**: Node.js >= 18
- **Language**: TypeScript 5.3
- **CLI框架**: Commander.js
- **SDK**: `@huaweicloud/huaweicloud-sdk-core` + `@huaweicloud/huaweicloud-sdk-lts`
- **输出格式化**: chalk (v4, CJS兼容) + cli-table3
- **构建工具**: tsc + tsx

## 项目结构

```
huawei-lts-cli/
├── .qoder/
│   └── skills/
│       └── lts-log-query/
│           └── SKILL.md              # Qoder Skill定义
├── src/
│   ├── cli/
│   │   ├── index.ts                  # CLI入口（commander）
│   │   ├── commands/
│   │   │   ├── query.ts              # query命令
│   │   │   └── config.ts             # config命令
│   │   └── options.ts                # CLI参数定义
│   ├── lts/
│   │   ├── index.ts                  # LTS模块导出
│   │   ├── client.ts                 # 华为云LTS客户端封装
│   │   └── types.ts                  # API类型定义
│   ├── config/
│   │   ├── index.ts                  # 配置管理
│   │   └── store.ts                  # 配置文件读写（~/.lts-cli/config.json）
│   ├── output/
│   │   ├── index.ts                  # 输出格式化入口
│   │   ├── json.ts                   # JSON输出
│   │   └── table.ts                  # 表格输出
│   └── types/
│       └── index.ts                  # 全局类型定义
├── dist/                             # 编译输出
├── package.json
├── tsconfig.json
└── README.md
```

## 关键实现要点

### 1. CLI命令 (`lts-cli`)

**`lts-cli query`** — 查询日志
- `-g, --group-id <id>`: 日志组ID（必填）
- `-s, --stream-id <id>`: 日志流ID（必填）
- `--st, --start-time <time>`: 起始时间（ISO 8601，必填）
- `--et, --end-time <time>`: 结束时间（ISO 8601，必填）
- `-k, --keyword <word>`: 关键词搜索
- `-l, --limit <n>`: 返回条数（默认100）
- `--offset <n>`: 分页偏移量（默认0）
- `-r, --reverse`: 按时间倒序
- `-o, --output <format>`: 输出格式 `json|table|pretty`（默认pretty）
- `--no-paginate`: 禁用自动分页

**`lts-cli config`** — 配置管理
- `--set <key=value>`: 设置配置项
- `--get <key>`: 获取配置项
- `--list`: 列出所有配置
- `--unset <key>`: 删除配置项

配置优先级: 命令行参数 > 环境变量(`LTS_AK`, `LTS_SK`, `LTS_PROJECT_ID`) > 配置文件(`~/.lts-cli/config.json`)

### 2. LTS API封装

- 使用 `@huaweicloud/huaweicloud-sdk-lts` 封装客户端
- 实现 `queryLogs()` 方法调用 `POST /v2/{project_id}/groups/{log_group_id}/streams/{log_stream_id}/content/query`
- 支持Generator模式的分页查询
- 错误处理：401/403提示检查AK/SK，429限流自动退避重试（指数退避，最多3次），5xx服务端错误重试

### 3. Skill文件 (`.qoder/skills/lts-log-query/SKILL.md`)

- YAML frontmatter包含`name`、`description`、`metadata`
- Instructions描述参数解析、时间格式转换、CLI命令构建规则
- Examples提供基础查询、关键词搜索、SQL查询、限制条数4个示例
- 通过description自动触发或手动 `/lts-log-query` 触发

### 4. 依赖注意事项

- `chalk` 使用v4（CommonJS兼容），避免v5的ESM问题
- `@huaweicloud/huaweicloud-sdk-lts` 版本选择`^3.1.0`

## 实现步骤

### Task 1: 项目初始化和依赖安装
- 初始化npm项目，创建`package.json`和`tsconfig.json`
- 安装所有生产依赖和开发依赖
- 创建项目目录结构

### Task 2: 实现核心模块
- `src/types/index.ts` — 全局类型定义（LTSConfig, QueryParams, LogEntry, QueryResult, OutputFormat）
- `src/config/store.ts` + `src/config/index.ts` — 配置管理（读写~/.lts-cli/config.json，环境变量读取，优先级管理）
- `src/lts/types.ts` — API类型定义
- `src/lts/client.ts` — LTS客户端封装（初始化SDK、queryLogs方法、分页Generator、错误处理）
- `src/output/json.ts` + `src/output/table.ts` + `src/output/index.ts` — 输出格式化

### Task 3: 实现CLI命令
- `src/cli/options.ts` — CLI参数选项定义
- `src/cli/commands/config.ts` — config命令实现
- `src/cli/commands/query.ts` — query命令实现（参数解析、调用LTS API、格式化输出）
- `src/cli/index.ts` — CLI入口（commander配置、版本、帮助）

### Task 4: 实现Skill文件
- 创建 `.qoder/skills/lts-log-query/` 目录
- 编写 `SKILL.md`（YAML frontmatter + Instructions + Examples）

### Task 5: 验证和测试
- 运行 `npm run build` 确保编译通过
- 测试 `lts-cli --help` 和 `lts-cli query --help`
- 测试配置管理命令
- 测试日志查询功能（如果环境允许）

## 验证方式

1. **构建验证**: `npm run build` 成功编译无错误
2. **CLI验证**: `node dist/cli/index.js --help` 正确显示帮助信息
3. **配置验证**: `lts-cli config --set ak=xxx && lts-cli config --get ak` 正确读写配置
4. **Skill验证**: 确认 `.qoder/skills/lts-log-query/SKILL.md` 符合Qoder Skill规范
