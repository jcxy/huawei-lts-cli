import { Command } from 'commander';
import { LTSClient } from '../../lts/client';
import { fetchAllPages } from '../../lts/pagination';
import { formatOutput } from '../../output';
import { QueryParams } from '../../types';
import {
  loadCheckedConfig,
  resolveGroupStream,
  resolveTimeParams,
  buildQueryExpression,
  resolveFormat,
  handleCommandError,
  warnIfIncomplete,
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
    .option('-q, --query <query>', 'Query expression. Supports:\n' +
      '  - Field queries: content:error AND appName:myapp\n' +
      '  - Comparison: time>60 AND region:r\n' +
      '  - Pipeline analysis: error | SELECT count(*) AS c\n' +
      '  - Logical operators: AND, OR, NOT (must be surrounded by spaces)')
    .option('--app <appName>', 'Filter by appName field, merged with -q via AND')
    .option('--content <keyword>', 'Filter by log content (content:<keyword>), merged with -q via AND')
    .option('--request-id <id>', 'Filter by REQUEST_ID field; output in chronological order')
    .option('-l, --limit <limit>', 'Page size (also the cap for --all)', parseIntOption, 100)
    .option('-r, --reverse', 'Reverse order (newest first)')
    .option('-f, --format <format>', 'Output format: json, table, pretty', 'pretty')
    .option('--all', 'Follow the cursor to the end (up to 10000 logs; default is a single page)')
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
        query,
        limit: options.limit,
        reverse,
      };

      try {
        if (!options.all) {
          // 默认单页查询，结果量由 --limit 控制
          const result = await client.queryLogs(params);
          warnIfIncomplete(result);
          console.log(formatOutput(result, format));
        } else {
          // --all：沿游标读到末尾，上限 10000 条防止失控
          const result = await fetchAllPages((p) => client.queryLogs(p), params, {
            max: 10000,
            pageSize: options.limit,
          });

          warnIfIncomplete(result);
          if (result.truncated) {
            console.error(
              `Warning: stopped at the ${result.logs.length}-log cap; more logs matched. Narrow the time range or add a filter.`
            );
          }
          console.log(formatOutput({ logs: result.logs, total: result.total }, format));
        }
      } catch (error: any) {
        handleCommandError(error);
      }
    });

  return cmd;
}
