# 华为云LTS CLI+Skill日志查询工具 — 实现方案

## 1. 项目目录结构

```
huawei-lts-cli/
├── .qoder/
│   └── skills/
│       └── lts-log-query/
│           └── SKILL.md              # Qoder Skill定义文件
├── src/
│   ├── cli/
│   │   ├── index.ts                  # CLI入口
│   │   ├── commands/
│   │   │   ├── query.ts              # query命令实现
│   │   │   └── config.ts             # config命令实现
│   │   └── options.ts                # CLI参数选项定义
│   ├── lts/
│   │   ├── index.ts                  # LTS SDK封装
│   │   ├── client.ts                 # 华为云LTS客户端封装
│   │   ├── types.ts                  # 华为云API类型定义
│   │   └── query-builder.ts          # SQL/参数查询构建器
│   ├── config/
│   │   ├── index.ts                  # 配置管理
│   │   └── store.ts                  # 配置持久化
│   ├── output/
│   │   ├── index.ts                  # 输出格式化
│   │   ├── json.ts                   # JSON输出
│   │   └── table.ts                  # Table输出
│   └── types/
│       └── index.ts                  # 全局类型
├── dist/                             # 编译输出
├── bin/
│   └── lts-cli                       # CLI入口（package.json bin指向dist/cli/index.js）
├── package.json
├── tsconfig.json
└── README.md
```

---

## 2. CLI命令设计

### 2.1 全局命令结构

```
lts-cli <command> [options]
```

### 2.2 `lts-cli query` 命令

| 参数 | 短参 | 必填 | 说明 | 默认值 |
|------|------|------|------|--------|
| `--group-id` | `-g` | 是 | 日志组ID | - |
| `--stream-id` | `-s` | 是 | 日志流ID | - |
| `--start-time` | `--st` | 是 | 起始时间(ISO 8601) | - |
| `--end-time` | `--et` | 是 | 结束时间(ISO 8601) | - |
| `--keyword` | `-k` | 否 | 关键词搜索 | "" |
| `--sql` | - | 否 | SQL语法查询(覆盖keyword) | "" |
| `--limit` | `-l` | 否 | 最大返回条数 | 100 |
| `--offset` | - | 否 | 分页偏移量 | 0 |
| `--reverse` | `-r` | 否 | 是否倒序 | false |
| `--output` | `-o` | 否 | 输出格式(json/table/pretty) | pretty |
| `--no-paginate` | - | 否 | 禁用自动分页 | false |

**命令示例：**

```bash
# 基础查询
lts-cli query -g group-xxx -s stream-xxx --st 2024-01-01T00:00:00Z --et 2024-01-02T00:00:00Z

# 关键词搜索
lts-cli query -g group-xxx -s stream-xxx --st 2024-01-01T00:00:00Z --et 2024-01-02T00:00:00Z -k "ERROR"

# SQL查询
lts-cli query -g group-xxx -s stream-xxx --st 2024-01-01T00:00:00Z --et 2024-01-02T00:00:00Z --sql "SELECT * WHERE content LIKE '%ERROR%'"

# JSON输出
lts-cli query -g group-xxx -s stream-xxx --st 2024-01-01T00:00:00Z --et 2024-01-02T00:00:00Z -o json

# 限制条数+表格输出
lts-cli query -g group-xxx -s stream-xxx --st 2024-01-01T00:00:00Z --et 2024-01-02T00:00:00Z -l 50 -o table
```

### 2.3 `lts-cli config` 命令

| 参数 | 短参 | 必填 | 说明 |
|------|------|------|------|
| `--set` | - | 否 | 设置配置项(key=value) | - |
| `--get` | - | 否 | 获取配置项 | - |
| `--list` | - | 否 | 列出所有配置 | - |
| `--unset` | - | 否 | 删除配置项 | - |

**命令示例：**

```bash
# 设置认证信息
lts-cli config --set ak=your_access_key
lts-cli config --set sk=your_secret_key
lts-cli config --set project_id=your_project_id
lts-cli config --set region=cn-north-4
lts-cli config --set endpoint=lts.cn-north-4.myhuaweicloud.com

# 查看配置
lts-cli config --list
lts-cli config --get ak

# 删除配置
lts-cli config --unset sk
```

### 2.4 配置存储方案

- **存储路径**: `~/.lts-cli/config.json`
- **配置内容**:
  ```json
  {
    "ak": "string",
    "sk": "string",
    "project_id": "string",
    "region": "string",
    "endpoint": "string"
  }
  ```
- **优先级**: 命令行参数 > 环境变量(LTS_AK, LTS_SK, LTS_PROJECT_ID) > 配置文件

### 2.5 输出格式

| 格式 | 说明 | 适用场景 |
|------|------|----------|
| `json` | 标准JSON输出 | 管道传输、脚本处理 |
| `table` | 表格输出 | 人工查看 |
| `pretty` | 带颜色、换行的美化输出 | 默认，人工查看 |

---

## 3. LTS API封装方案

### 3.1 使用华为云SDK方案

**核心依赖**：`@huaweicloud/huaweicloud-sdk-core`、`@huaweicloud/huaweicloud-sdk-lts`

**封装设计**：

```typescript
// src/lts/client.ts
export class LTSClient {
  private client: LtsClient;
  private credentials: BasicCredentials;
  
  constructor(config: LTSConfig) {
    this.credentials = new BasicCredentials()
      .withAk(config.ak)
      .withSk(config.sk);
    
    this.client = LtsClient.newBuilder()
      .withCredential(this.credentials)
      .withEndpoint(config.endpoint)
      .build();
  }

  // 查询日志
  async queryLogs(params: QueryLogParams): Promise<LogResult> {
    const request = new QueryLogRequest()
      .withProjectId(params.projectId)
      .withLogGroupId(params.groupId)
      .withLogStreamId(params.streamId);
    
    // ... 设置请求参数
    
    return this.client.queryLog(request);
  }
}
```

### 3.2 错误处理机制

```
错误分类：
├── 认证错误 (401/403) -> 提示用户检查AK/SK
├── 参数错误 (400) -> 输出详细参数校验信息
├── 限流错误 (429) -> 自动退避重试
├── 服务端错误 (5xx) -> 指数退避重试
└── 网络错误 -> 自动重试3次
```

**重试策略**：
- 最大重试次数：3次
- 退避策略：指数退避（1s, 2s, 4s）
- 仅对429和5xx错误重试

### 3.3 分页查询支持

```typescript
// src/lts/index.ts
async function* queryLogsGenerator(params: QueryParams): AsyncGenerator<LogEntry[]> {
  let offset = params.offset || 0;
  const limit = params.limit || 100;
  
  while (true) {
    const result = await client.queryLogs({ ...params, offset, limit });
    
    if (result.logs.length === 0) break;
    
    yield result.logs;
    
    if (result.logs.length < limit) break;
    
    offset += limit;
  }
}

// 聚合查询
async function queryAllLogs(params: QueryParams): Promise<LogResult> {
  const allLogs: LogEntry[] = [];
  
  for await (const batch of queryLogsGenerator(params)) {
    allLogs.push(...batch);
  }
  
  return { logs: allLogs, total: allLogs.length };
}
```

---

## 4. Skill文件设计

### 4.1 目录结构

```
.qoder/
└── skills/
    └── lts-log-query/
        └── SKILL.md
```

### 4.2 SKILL.md 完整内容

```markdown
---
name: lts-log-query
description: >
  华为云LTS日志查询工具。支持通过自然语言描述查询华为云日志服务(LTS)中的日志，
  支持关键词搜索、时间范围过滤、SQL语法查询和聚合统计。
metadata:
  version: "1.0.0"
  author: "huawei-lts-cli"
  language: "zh-CN"
  tags: ["lts", "log", "huaweicloud", "query"]
triggers:
  - "查询日志"
  - "查看日志"
  - "搜索日志"
  - "日志查询"
  - "lts查询"
---

## Instructions

你是一个华为云LTS日志查询助手。当用户需要查询日志时，使用以下步骤：

### 1. 参数解析
从用户自然语言描述中提取以下参数：
- **日志组ID** (log_group_id): 用户提供的日志组标识
- **日志流ID** (log_stream_id): 用户提供的日志流标识
- **时间范围**: 解析相对时间（如"最近1小时"）或绝对时间（如"2024-01-01 00:00:00"）
- **关键词**: 用户提到的搜索关键词
- **SQL查询**: 如果用户提到聚合、统计、分组等操作，构建SQL查询

### 2. 时间格式转换
- 相对时间 -> ISO 8601格式: `YYYY-MM-DDTHH:mm:ssZ`
- "最近1小时" -> 当前时间前1小时
- "今天" -> 当天00:00:00到23:59:59
- "最近24小时" -> 当前时间前24小时

### 3. CLI命令构建

使用以下CLI命令模板：

```bash
lts-cli query \\
  -g <log_group_id> \\
  -s <log_stream_id> \\
  --st <start_time> \\
  --et <end_time> \\
  [ -k <keyword> ] \\
  [ --sql <sql_query> ] \\
  [ -l <limit> ] \\
  [ -o <format> ]
```

### 4. 自然语言 -> CLI参数映射规则

| 用户输入 | CLI参数 |
|---------|---------|
| "查询group1的stream2" | `-g group1 -s stream2` |
| "最近1小时" | `--st $(date -d '1 hour ago' -u +%Y-%m-%dT%H:%M:%SZ) --et $(date -u +%Y-%m-%dT%H:%M:%SZ)` |
| "今天" | `--st $(date -d '00:00:00' +%Y-%m-%dT%H:%M:%SZ) --et $(date -d '23:59:59' +%Y-%m-%dT%H:%M:%SZ)` |
| "搜ERROR" | `-k "ERROR"` |
| "统计每个状态码的数量" | `--sql "SELECT labels.status, COUNT(*) GROUP BY labels.status"` |

### 5. 输出处理

CLI返回JSON格式结果，按以下结构展示给用户：

```
找到 {total} 条日志记录：

| 时间 | 内容 | 标签 |
|------|------|------|
| {log_time} | {content} | {labels} |

...（最多展示前100条）
```

如果日志条数超过100条，提示用户："共找到 {total} 条日志，仅展示前100条，如需查看更多请调整查询条件。"

## Examples

### Example 1: 基础查询
**用户**: 查询日志组my-group、日志流my-stream最近1小时的日志
**Agent**: 
```bash
lts-cli query -g my-group -s my-stream --st 2024-06-24T09:00:00Z --et 2024-06-24T10:00:00Z
```

### Example 2: 关键词搜索
**用户**: 在my-group/my-stream中搜索包含"connection refused"的日志，时间范围今天下午2点到4点
**Agent**:
```bash
lts-cli query -g my-group -s my-stream --st 2024-06-24T06:00:00Z --et 2024-06-24T08:00:00Z -k "connection refused"
```

### Example 3: SQL聚合查询
**用户**: 统计my-group/my-stream今天ERROR级别日志按小时的分布
**Agent**:
```bash
lts-cli query -g my-group -s my-stream --st 2024-06-24T00:00:00Z --et 2024-06-24T23:59:59Z --sql "SELECT substr(log_time, 0, 13) as hour, COUNT(*) as count WHERE content LIKE '%ERROR%' GROUP BY hour ORDER BY hour"
```

### Example 4: 限制条数
**用户**: 查询my-group/my-stream最新的50条日志
**Agent**:
```bash
lts-cli query -g my-group -s my-stream --st 2024-06-01T00:00:00Z --et 2024-06-24T10:00:00Z -l 50 -r
```
```

---

## 5. package.json 配置

```json
{
  "name": "huawei-lts-cli",
  "version": "1.0.0",
  "description": "华为云LTS CLI+Skill日志查询工具",
  "main": "dist/index.js",
  "bin": {
    "lts-cli": "./dist/cli/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/cli/index.ts",
    "start": "node dist/cli/index.js",
    "lint": "eslint src/ --ext .ts",
    "test": "jest",
    "clean": "rm -rf dist"
  },
  "keywords": [
    "huaweicloud",
    "lts",
    "log",
    "cli",
    "qoder",
    "skill"
  ],
  "author": "",
  "license": "MIT",
  "dependencies": {
    "@huaweicloud/huaweicloud-sdk-core": "^3.1.0",
    "@huaweicloud/huaweicloud-sdk-lts": "^3.1.0",
    "commander": "^12.0.0",
    "chalk": "^5.3.0",
    "cli-table3": "^0.6.4"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "typescript": "^5.3.0",
    "tsx": "^4.7.0",
    "eslint": "^8.57.0",
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0",
    "jest": "^29.7.0",
    "@types/jest": "^29.5.0",
    "ts-jest": "^29.1.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

---

## 6. tsconfig.json 配置

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": [
    "src/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "**/*.test.ts"
  ]
}
```

---

## 7. 实现步骤

### 阶段一：项目初始化（1-2小时）

1. **初始化项目**
   ```bash
   mkdir huawei-lts-cli && cd huawei-lts-cli
   npm init -y
   ```

2. **安装依赖**
   ```bash
   npm install @huaweicloud/huaweicloud-sdk-core @huaweicloud/huaweicloud-sdk-lts commander chalk cli-table3
   npm install -D typescript tsx @types/node eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser
   ```

3. **配置TypeScript**
   - 创建 `tsconfig.json`
   - 设置编译选项

4. **配置package.json**
   - 添加 `bin` 入口
   - 配置 `scripts`
   - 设置 `engines`

### 阶段二：核心模块开发（4-6小时）

5. **实现配置管理模块** (`src/config/`)
   - 配置文件读写（`~/.lts-cli/config.json`）
   - 环境变量读取（`LTS_AK`, `LTS_SK` 等）
   - 配置优先级管理

6. **实现LTS API封装** (`src/lts/`)
   - SDK客户端初始化
   - `queryLogs` 方法封装
   - 分页查询支持
   - 错误处理和重试机制

7. **实现输出格式化** (`src/output/`)
   - JSON格式化
   - 表格格式化（cli-table3）
   - Pretty格式化（chalk颜色）

### 阶段三：CLI命令开发（3-4小时）

8. **实现config命令** (`src/cli/commands/config.ts`)
   - `config --set key=value`
   - `config --get key`
   - `config --list`
   - `config --unset key`

9. **实现query命令** (`src/cli/commands/query.ts`)
   - 参数解析和校验
   - 调用LTS API
   - 结果格式化输出
   - 支持分页自动拉取

10. **实现CLI入口** (`src/cli/index.ts`)
    - 使用 `commander` 构建命令行
    - 版本信息
    - 帮助文档

### 阶段四：Skill集成（2-3小时）

11. **创建Skill目录结构**
    ```
    .qoder/skills/lts-log-query/SKILL.md
    ```

12. **编写SKILL.md**
    - YAML frontmatter
    - Instructions（参数解析、时间转换、CLI构建规则）
    - Examples（基础查询、关键词搜索、SQL查询、限制条数）

### 阶段五：测试与优化（2-3小时）

13. **本地测试**
    ```bash
    npm run build
    npm link
    lts-cli --help
    lts-cli config --list
    lts-cli query --help
    ```

14. **功能测试**
    - 配置管理测试
    - 查询命令测试（不同参数组合）
    - 输出格式测试
    - 错误处理测试

15. **优化与文档**
    - 完善错误提示信息
    - 添加README文档
    - 添加CHANGELOG

### 总预计工时

| 阶段 | 预计工时 |
|------|----------|
| 阶段一：项目初始化 | 1-2小时 |
| 阶段二：核心模块开发 | 4-6小时 |
| 阶段三：CLI命令开发 | 3-4小时 |
| 阶段四：Skill集成 | 2-3小时 |
| 阶段五：测试与优化 | 2-3小时 |
| **总计** | **12-18小时** |

---

## 附录：关键文件内容速查

### CLI入口 (src/cli/index.ts)

```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { queryCommand } from './commands/query.js';
import { configCommand } from './commands/config.js';

const program = new Command();

program
  .name('lts-cli')
  .description('华为云LTS日志查询CLI工具')
  .version('1.0.0');

program.addCommand(queryCommand);
program.addCommand(configCommand);

program.parse();
```

### 类型定义 (src/types/index.ts)

```typescript
export interface LTSConfig {
  ak: string;
  sk: string;
  projectId: string;
  region: string;
  endpoint: string;
}

export interface QueryParams {
  groupId: string;
  streamId: string;
  startTime: string;
  endTime: string;
  keyword?: string;
  sql?: string;
  limit?: number;
  offset?: number;
  reverse?: boolean;
}

export interface LogEntry {
  logTime: string;
  content: string;
  labels: Record<string, string>;
}

export interface QueryResult {
  logs: LogEntry[];
  total: number;
}

export type OutputFormat = 'json' | 'table' | 'pretty';
```
