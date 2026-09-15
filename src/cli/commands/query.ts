import { Command } from 'commander';
import { LTSClient } from '../../lts/client';
import { formatOutput } from '../../output';
import { QueryParams, LogEntry } from '../../types';
import {
  loadCheckedConfig,
  resolveGroupStream,
  resolveTimeParams,
  buildQueryExpression,
  resolveFormat,
  handleCommandError,
} from './common';

// commander 的处理函数会收到 (value, previous)，直接传 parseInt 会把 previous 当作进制
function parseIntOption(value: string): number {
  return parseInt(value, 10);
}

export function createQueryCommand(): Command {
  const cmd = new Command('query');

  cmd.description('Query LTS logs')
    .option('-g, --group-id <groupId>', 'Log group ID (can also be set via config)')
    .option('-s, --stream-id <streamId>', 'Log stream ID (can also be set via config)')
    .option('--start-time <startTime>', 'Start time (ISO 8601, e.g. 2024-01-01T00:00:00Z)')
    .option('--end-time <endTime>', 'End time (ISO 8601, e.g. 2024-01-02T00:00:00Z)')
    .option('--st <startTime>', 'Alias for --start-time')
    .option('--et <endTime>', 'Alias for --end-time')
    .option('--last <duration>', 'Relative time range: 30m, 2h, 1d, 7d (mutually exclusive with --st/--et)')
    .option('-k, --keyword <keyword>', 'Simple keyword search (legacy, use --query for advanced queries)')
    .option('-q, --query <query>', 'Advanced query expression. Supports:\n' +
      '  - Field queries: content:error AND appName:myapp\n' +
      '  - Comparison: time>60 AND region:r\n' +
      '  - SQL syntax: SELECT * FROM log WHERE content LIKE \'%error%\'\n' +
      '  - Logical operators: AND, OR, NOT (must be surrounded by spaces)')
    .option('--app <appName>', 'Filter by appName field (e.g. --app acerp-gateway), merged with -q via AND')
    .option('--content <keyword>', 'Filter by log content (content:<keyword>), merged with -q via AND')
    .option('--request-id <id>', 'Filter by REQUEST_ID field; output in chronological order')
    .option('-l, --limit <limit>', 'Limit number of results', parseIntOption, 100)
    .option('-o, --offset <offset>', 'Offset for pagination', parseIntOption, 0)
    .option('-r, --reverse', 'Reverse order (newest first)')
    .option('-f, --format <format>', 'Output format: json, table, pretty', 'pretty')
    .option('--all', 'Fetch all pages (up to 10000 logs; default is single page)')
    .option('--no-paginate', '(deprecated) Single page is the default; kept for compatibility')
    .action(async (options) => {
      const config = loadCheckedConfig();
      const { groupId, streamId } = resolveGroupStream(options, config);
      const timeParams = resolveTimeParams(options);
      const query = buildQueryExpression(options);
      const format = resolveFormat(options.format);

      // --request-id 用于链路定位，按时间正序输出
      const reverse = options.requestId ? false : options.reverse;

      const client = new LTSClient(config);

      const params: QueryParams = {
        groupId,
        streamId,
        ...timeParams,
        keyword: options.keyword,
        query,
        limit: options.limit,
        offset: options.offset,
        reverse,
      };

      try {
        if (!options.all) {
          // 默认单页查询，结果量由 --limit 控制
          const result = await client.queryLogs(params);
          console.log(formatOutput(result, format));
        } else {
          // --all：自动翻页拉取全部日志，上限 10000 条防止失控
          const MAX_LOGS = 10000;
          const allLogs: LogEntry[] = [];
          let offset = options.offset || 0;
          const limit = options.limit || 100;
          let hasMore = true;

          while (hasMore && allLogs.length < MAX_LOGS) {
            const pageParams: QueryParams = {
              ...params,
              offset,
              limit,
            };
            const result = await client.queryLogs(pageParams);
            allLogs.push(...result.logs);

            if (result.logs.length < limit) {
              hasMore = false;
            } else {
              offset += limit;
            }
          }

          const result = {
            logs: allLogs,
            total: allLogs.length,
          };
          console.log(formatOutput(result, format));
        }
      } catch (error: any) {
        handleCommandError(error);
      }
    });

  return cmd;
}
