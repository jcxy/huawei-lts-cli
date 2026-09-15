import { Command } from 'commander';
import chalk from 'chalk';
import { LTSClient } from '../../lts/client';
import { formatOutput } from '../../output';
import { QueryParams, LogEntry } from '../../types';
import {
  loadCheckedConfig,
  resolveGroupStream,
  resolveTimeParams,
  resolveFormat,
  handleCommandError,
} from './common';

export function createTraceCommand(): Command {
  const cmd = new Command('trace');

  cmd.description('Trace a request by REQUEST_ID — fetch the full request chain in chronological order')
    .argument('<requestId>', 'REQUEST_ID value to trace')
    .option('-g, --group-id <groupId>', 'Log group ID (can also be set via config)')
    .option('-s, --stream-id <streamId>', 'Log stream ID (can also be set via config)')
    .option('--field <name>', 'Field to match: REQUEST_ID (default), trace_id, or content (full-text fallback)', 'REQUEST_ID')
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

      const field = options.field as string;
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
        // Auto-pagination up to --limit
        const pageSize = Math.min(options.limit || 200, 500);
        const maxTotal = options.limit || 200;
        const allLogs: LogEntry[] = [];
        let offset = 0;
        let hasMore = true;

        while (hasMore && allLogs.length < maxTotal) {
          const result = await client.queryLogs({ ...params, offset, limit: pageSize });
          allLogs.push(...result.logs);

          if (result.logs.length < pageSize) {
            hasMore = false;
          } else {
            offset += pageSize;
          }
        }

        const result = { logs: allLogs.slice(0, maxTotal), total: allLogs.length };
        let output = formatOutput(result, format);

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
