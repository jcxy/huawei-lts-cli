import { Command } from 'commander';
import chalk from 'chalk';
import { LTSClient } from '../../lts/client';
import { fetchAllPages } from '../../lts/pagination';
import { formatOutput } from '../../output';
import { QueryParams } from '../../types';
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
 * 默认按全文索引检索，而不是 REQUEST_ID。
 *
 * 理由：`REQUEST_ID` 是某类应用的字段命名约定，不是 LTS 的通用概念。新用户的日志流
 * 里往往没有这个字段，写死它会让 `trace` 在正确的用法下返回空。全文检索总能命中，
 * 而用到专用字段的人可以在 config 里设一次 `traceField`。
 */
const DEFAULT_TRACE_FIELD = 'content';

export function createTraceCommand(): Command {
  const cmd = new Command('trace');

  cmd.description('Trace a request by ID — fetch the full request chain in chronological order')
    .argument('<requestId>', 'Value to trace (request ID, trace ID, or any search text)')
    .option('-g, --group-id <groupId>', 'Log group ID (can also be set via config)')
    .option('-s, --stream-id <streamId>', 'Log stream ID (can also be set via config)')
    .option('--field <name>', `Field to match. Defaults to config.traceField, then "${DEFAULT_TRACE_FIELD}"`)
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

      const field = (options.field as string) || getConfig('traceField') || DEFAULT_TRACE_FIELD;
      // 值加双引号：含连字符的 UUID 不加引号会被分词导致匹配不到
      const query = `${field}:"${requestId}"`;

      const client = new LTSClient(config);

      const params: QueryParams = {
        groupId,
        streamId,
        ...timeParams,
        query,
        reverse: false, // 链路按时间正序
      };

      try {
        const maxTotal = options.limit || 200;
        // 每页不超过 500：再大 LTS 会开始截断，且首屏延迟明显变差
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
