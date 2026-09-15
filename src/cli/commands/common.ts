import { loadConfig } from '../../config';
import { LTSConfig, QueryParams, OutputFormat } from '../../types';

/** 加载配置并校验凭证，缺失时打印引导并退出 */
export function loadCheckedConfig(): LTSConfig {
  const config = loadConfig();

  if (!config.ak || !config.sk || !config.projectId) {
    console.error('Error: Missing required credentials. Please configure them first:');
    console.error('');
    console.error('  Quick setup (recommended):');
    console.error('    lts-cli init');
    console.error('');
    console.error('  Or set individually:');
    console.error('    lts-cli config --set ak=<your-access-key>');
    console.error('    lts-cli config --set sk=<your-secret-key>');
    console.error('    lts-cli config --set projectId=<your-project-id>');
    process.exit(1);
  }

  return config;
}

/** groupId/streamId：CLI 参数优先，其次配置默认值，都没有则报错退出 */
export function resolveGroupStream(
  options: { groupId?: string; streamId?: string },
  config: LTSConfig
): { groupId: string; streamId: string } {
  const groupId = options.groupId || config.groupId;
  const streamId = options.streamId || config.streamId;

  if (!groupId || !streamId) {
    console.error('Error: groupId and streamId are required. Provide them via:');
    console.error('  lts-cli config --set groupId=<your-group-id>');
    console.error('    lts-cli config --set streamId=<your-stream-id>');
    console.error('  or use -g <groupId> -s <streamId> flags');
    console.error('  Tip: run "lts-cli groups" / "lts-cli streams" to discover IDs');
    process.exit(1);
  }

  return { groupId, streamId };
}

export interface TimeOptions {
  startTime?: string;
  endTime?: string;
  st?: string;
  et?: string;
  last?: string;
}

/** 解析时间选项：--last 与 --st/--et 互斥，至少提供一组 */
export function resolveTimeParams(options: TimeOptions, defaultLast?: string): Pick<QueryParams, 'startTime' | 'endTime' | 'last'> {
  const startTime = options.startTime || options.st;
  const endTime = options.endTime || options.et;
  const last = options.last || (!startTime && !endTime ? defaultLast : undefined);

  if (last && (startTime || endTime)) {
    console.error('Error: --last is mutually exclusive with --start-time/--end-time. Provide only one style.');
    process.exit(1);
  }

  if (!last && (!startTime || !endTime)) {
    console.error('Error: time range required. Use --last (e.g. --last 2h) or both --start-time and --end-time.');
    process.exit(1);
  }

  return last ? { last } : { startTime, endTime };
}

export interface FilterOptions {
  query?: string;
  app?: string;
  content?: string;
  requestId?: string;
}

/** 将 -q 表达式与便捷筛选 flag 合并为一个查询表达式（AND 连接）
 *  字段值统一加双引号：含连字符等分词符的值（如 UUID）不加引号会匹配不到 */
export function buildQueryExpression(options: FilterOptions): string | undefined {
  const parts: string[] = [];

  if (options.query) {
    parts.push(options.query);
  }
  if (options.app) {
    parts.push(`appName:"${options.app}"`);
  }
  if (options.content) {
    parts.push(`content:"${options.content}"`);
  }
  if (options.requestId) {
    parts.push(`REQUEST_ID:"${options.requestId}"`);
  }

  return parts.length > 0 ? parts.join(' AND ') : undefined;
}

/** 解析输出格式，非法值回退 pretty */
export function resolveFormat(value: string): OutputFormat {
  return ['json', 'table', 'pretty'].includes(value) ? (value as OutputFormat) : 'pretty';
}

/** 统一错误处理：常见错误给出友好提示 */
export function handleCommandError(error: any): never {
  const msg = error.message || String(error);

  if (msg.includes('Invalid URL')) {
    console.error('Error: Invalid endpoint URL. Make sure it starts with https://');
    console.error('  Example: https://lts.cn-south-1.myhuaweicloud.com');
  } else if (msg.includes('Authentication failed') || msg.includes('401') || msg.includes('403')) {
    console.error('Error: Authentication failed. Please check your AK/SK credentials:');
    console.error('  lts-cli config --list');
  } else if (msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED')) {
    console.error('Error: Cannot reach the LTS service. Please check your endpoint and network connection.');
  } else if (msg.includes('Request failed after retries')) {
    console.error('Error: The service is temporarily unavailable. Please try again later.');
  } else {
    console.error('Error:', msg);
  }
  process.exit(1);
}
