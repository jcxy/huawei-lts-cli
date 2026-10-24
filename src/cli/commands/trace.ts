import { Command } from 'commander';
import chalk from 'chalk';
import { LTSClient } from '../../lts/client';
import { fetchAllPages } from '../../lts/pagination';
import { formatOutput } from '../../output';
import { QueryParams, StreamIndex } from '../../types';
import { getConfig } from '../../config';
import {
  loadCheckedConfig,
  resolveGroupStream,
  resolveTimeParams,
  resolveFormat,
  handleCommandError,
  warnIfIncomplete,
} from './common';

/**
 * 默认字段的选择顺序：`--field` → `config.traceField` → 运行时发现。
 *
 * 以前第三步写死 `content`（全文检索）。实测不对：结构化日志的 ID 住在 labels 里
 * （REQUEST_ID / trace_id …），而全文索引只覆盖正文，`content:"<uuid>"` 一条都
 * 匹配不到——而且不报错，只是空结果。所以第三步改成读索引配置，把形如
 * request/trace/span + id 的字段都 OR 上，再由 full-text 兜底。
 */
const DEFAULT_TRACE_FIELD = 'content';

/** 字段名能凭空进查询语句（不能含连字符，否则会被当成运算符） */
const SAFE_FIELD_NAME = /^[A-Za-z][A-Za-z0-9_]*$/;
const ID_FIELD_PATTERN = /(request|trace|span)[_-]?id$/i;

/** 从索引配置里挑出可能装链路 ID 的字段名（运行时发现，不维护字段表） */
export function traceCandidateFields(index: StreamIndex): string[] {
  const idFields = index.fields
    .map((f) => f.name)
    .filter((name) => SAFE_FIELD_NAME.test(name) && ID_FIELD_PATTERN.test(name));

  // 全文索引用在两种情况下：有 ID 字段时做兜底，没有 ID 字段时是唯一手段
  if (idFields.length === 0 || index.fullText.enabled) {
    return [...idFields, DEFAULT_TRACE_FIELD];
  }
  return idFields;
}

/** 候选字段拼成 OR 表达式，值统一加双引号（含连字符的 UUID 不分词就匹配不到） */
export function buildTraceExpression(fields: string[], requestId: string): string {
  return fields.map((field) => `${field}:"${requestId}"`).join(' OR ');
}

export function createTraceCommand(): Command {
  const cmd = new Command('trace');

  cmd.description('Trace a request by ID — fetch the full request chain in chronological order')
    .argument('<requestId>', 'Value to trace (request ID, trace ID, or any search text)')
    .option('-g, --group-id <groupId>', 'Log group ID (can also be set via config)')
    .option('-s, --stream-id <streamId>', 'Log stream ID (can also be set via config)')
    .option(
      '--field <name>',
      'Field to match. Defaults to config.traceField, then the ID fields found in the stream index'
    )
    .option('--last <duration>', 'Relative time range: 30m, 2h, 1d, 7d (default: 24h)')
    .option('--start-time <startTime>', 'Start time (ISO 8601)')
    .option('--end-time <endTime>', 'End time (ISO 8601)')
    .option('--st <startTime>', 'Alias for --start-time')
    .option('--et <endTime>', 'Alias for --end-time')
    .option('-l, --limit <limit>', 'Max number of logs to fetch', (v: string) => parseInt(v, 10), 200)
    .option('-f, --format <format>', 'Output format: json, table, pretty', 'pretty')
    .action(async (requestId: string, options) => {
      const config = loadCheckedConfig();
      const { groupId, streamId } = resolveGroupStream(options, config);
      const timeParams = resolveTimeParams(options, '24h');
      const format = resolveFormat(options.format);

      const explicitField = (options.field as string) || getConfig('traceField');

      const client = new LTSClient(config);

      // 链路按时间正序，且不加应用过滤：一条链路本来就会横跨多个应用
      const params: QueryParams = {
        groupId,
        streamId,
        ...timeParams,
        reverse: false,
      };

      try {
        const fields = explicitField
          ? [explicitField]
          : await discoverTraceFields(client, groupId, streamId);
        params.query = buildTraceExpression(fields, requestId);

        const maxTotal = options.limit || 200;
        // 每页 500 条：服务端单页最多 5000，但 500 的首屏延迟明显更好，
        // 而一条链路本来就只有几十条，多跑几页也不痛不痒
        const pageSize = Math.min(maxTotal, 500);

        const result = await fetchAllPages((p) => client.queryLogs(p), params, {
          max: maxTotal,
          pageSize,
        });

        warnIfIncomplete(result);
        if (result.truncated) {
          console.error(
            `Warning: stopped at --limit ${maxTotal}; the chain may continue. Re-run with a larger --limit.`
          );
        }

        if (result.logs.length === 0) {
          console.error(
            `No logs matched "${requestId}" in ${fields.join(', ')}. ` +
              'Widen --last, or pick the exact field with --field <name>.'
          );
        }

        let output = formatOutput({ logs: result.logs, total: result.total }, format);

        // pretty 格式下高亮 requestId，便于肉眼定位
        if (format === 'pretty' && result.logs.length > 0) {
          output = output.split(requestId).join(chalk.yellow.bold(requestId));
        }
        console.log(output);
      } catch (error: any) {
        handleCommandError(error);
      }
    });

  return cmd;
}

/**
 * 读一次索引配置来决定搜哪些字段。读不到（权限/接口异常）时退回全文检索：
 * 宁可退化成以前的行为，也不要让 trace 直接报错。
 */
async function discoverTraceFields(
  client: LTSClient,
  groupId: string,
  streamId: string
): Promise<string[]> {
  try {
    return traceCandidateFields(await client.getStreamIndex(groupId, streamId));
  } catch {
    return [DEFAULT_TRACE_FIELD];
  }
}
