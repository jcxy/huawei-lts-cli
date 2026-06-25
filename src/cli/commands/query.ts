import { Command } from 'commander';
import { LTSClient } from '../../lts/client';
import { loadConfig } from '../../config';
import { formatOutput } from '../../output';
import { QueryParams, OutputFormat } from '../../types';

export function createQueryCommand(): Command {
  const cmd = new Command('query');

  cmd.description('Query LTS logs')
    .requiredOption('-g, --group-id <groupId>', 'Log group ID')
    .requiredOption('-s, --stream-id <streamId>', 'Log stream ID')
    .requiredOption('--start-time <startTime>', 'Start time (ISO 8601)')
    .requiredOption('--end-time <endTime>', 'End time (ISO 8601)')
    .option('-k, --keyword <keyword>', 'Search keyword')
    .option('-l, --limit <limit>', 'Limit number of results', parseInt, 100)
    .option('-o, --offset <offset>', 'Offset for pagination', parseInt, 0)
    .option('-r, --reverse', 'Reverse order')
    .option('-f, --format <format>', 'Output format: json, table, pretty')
    .option('--no-paginate', 'Disable pagination')
    .action(async (options) => {
      const config = loadConfig();

      if (!config.ak || !config.sk || !config.projectId) {
        console.error('Error: Missing required configuration. Please set ak, sk, and projectId using:');
        console.error('  lts-cli config --set ak=<your-ak>');
        console.error('  lts-cli config --set sk=<your-sk>');
        console.error('  lts-cli config --set projectId=<your-project-id>');
        process.exit(1);
      }

      const format: OutputFormat = ['json', 'table', 'pretty'].includes(options.format)
        ? options.format
        : 'pretty';

      const client = new LTSClient(config);

      const params: QueryParams = {
        groupId: options.groupId,
        streamId: options.streamId,
        startTime: options.startTime,
        endTime: options.endTime,
        keyword: options.keyword,
        limit: options.limit,
        offset: options.offset,
        reverse: options.reverse,
      };

      try {
        if (options.paginate) {
          const result = await client.queryLogs(params);
          console.log(formatOutput(result, format));
        } else {
          // Auto-pagination: fetch all logs
          const allLogs: import('../../types').LogEntry[] = [];
          let offset = options.offset || 0;
          const limit = options.limit || 100;
          let hasMore = true;

          while (hasMore) {
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
        console.error('Error querying logs:', error.message || error);
        process.exit(1);
      }
    });

  return cmd;
}
