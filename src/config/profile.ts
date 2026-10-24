import * as fs from 'fs';
import * as path from 'path';
import { getConfigDir } from './store';

/**
 * `profile.md` 是给人写、给 AI 读的业务词表。CLI 从不读它。
 *
 * 分界线：`config.json` 存 CLI 的行为（凭证、traceField、默认 group/stream）；
 * `profile.md` 存 API 拿不到的东西（业务词 → 日志里的值、命名约定、黑话）。
 * 字段清单、日志组/流 ID 一律不进 profile —— 那是第二份会过期的真相，
 * 用 `lts-cli groups` / `streams` / `fields` 现查。
 */

export function getProfilePath(): string {
  return path.join(getConfigDir(), 'profile.md');
}

export function profileExists(): boolean {
  return fs.existsSync(getProfilePath());
}

const SKELETON = `# LTS 业务词表（本机私有）

> 这份文件给人改、给 AI 读。\`lts-cli\` 本身**不读**它——CLI 的行为配置在 \`~/.lts-cli/config.json\`。
>
> 只写 API 拿不到的东西：业务词怎么落到日志里的值、团队自己的命名约定、黑话。
> **不要**把日志组/日志流 ID、字段清单写进来——用 \`lts-cli groups\` / \`lts-cli streams\` /
> \`lts-cli fields\` 现查。抄进文档的那一刻它就开始过期。

## 1. 业务称呼 → 日志里的取值

查日志前先在这里翻译，避免每次重新猜应用名。

| 业务称呼 | 日志中的取值 | 说明 |
| --- | --- | --- |
| 订单服务 | （填字段值和值） | 例如 appName 或 service_name 的取值 |

## 2. 字段含义

只写「这个字段在我们这里表示什么」。类型、是否大小写敏感、分词符请用 \`lts-cli fields\` 查。

| 字段 | 含义 |
| --- | --- |
| （字段名） | （说明） |

## 3. 命名约定与分词陷阱

- 哪些值含连字符/下划线，必须加双引号才会被当成一个词
- 值的大小写约定（全大写？小写？）
- 哪些字段看起来该有索引、实际上没建（没建索引的字段只能全文检索命中）

## 4. 团队黑话

| 说法 | 实际指什么 |
| --- | --- |
| （黑话） | （含义） |

## 5. 常用排查入口

| 想查什么 | 建议命令 |
| --- | --- |
| 某个 ID 的完整链路 | \`lts-cli trace <id>\` |
| 某业务最近的报错 | \`lts-cli query --last 1h -q '(字段):(值)'\` |
| 先看清楚这条流有什么字段 | \`lts-cli fields\` |
`;

export interface WriteProfileResult {
  path: string;
  /** false 表示文件已存在、原样保留（绝不覆盖用户手写的内容） */
  created: boolean;
}

export function writeProfileSkeleton(): WriteProfileResult {
  const target = getProfilePath();
  if (fs.existsSync(target)) {
    return { path: target, created: false };
  }
  fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
  fs.writeFileSync(target, SKELETON, { encoding: 'utf-8', mode: 0o600 });
  return { path: target, created: true };
}
