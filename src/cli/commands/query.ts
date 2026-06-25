import { Command } from 'commander';
import { LTSClient } from '../../lts/client';
import { loadConfig } from '../../config';
import { formatOutput } from '../../output';
import { QueryParams, OutputFormat } from '../../types';

export function createQueryCommand(): Command {
  const cmd = new Command('query');

  cmd.description('Query LTS logs')
    .option('-g, --group-id <groupId>', 'Log group ID (can also be set via config)')
    .option('-s, --stream-id <streamId>', 'Log stream ID (can also be set via config)')
    .requiredOption('--start-time <startTime>', 'Start time (ISO 8601, e.g. 2024-01-01T00:00:00Z)')
    .requiredOption('--end-time <endTime>', 'End time (ISO 8601, e.g. 2024-01-02T00:00:00Z)')
    .option('--st <startTime>', 'Alias for --start-time')
    .option('--et <endTime>', 'Alias for --end-time')
    .option('-k, --keyword <keyword>', 'Search keyword')
    .option('-l, --limit <limit>', 'Limit number of results', parseInt, 100)
    .option('-o, --offset <offset>', 'Offset for pagination', parseInt, 0)
    .option('-r, --reverse', 'Reverse order (newest first)')
    .option('-f, --format <format>', 'Output format: json, table, pretty', 'pretty')
    .option('--no-paginate', 'Disable auto-pagination (single page only)')
    .action(async (options) => {
      const config = loadConfig();

      // Validate required credentials
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

      // groupId & streamId: CLI args take priority over config
      const groupId = options.groupId || config.groupId;
      const streamId = options.streamId || config.streamId;

      if (!groupId || !streamId) {
        console.error('Error: groupId and streamId are required. Provide them via:');
        console.error('  lts-cli config --set groupId=<your-group-id>');
        console.error('  lts-cli config --set streamId=<your-stream-id>');
        console.error('  or use -g <groupId> -s <streamId> flags');
        process.exit(1);
      }

      // --st / --et are aliases for --start-time / --end-time
      const startTime = options.startTime || options.st;
      const endTime = options.endTime || options.et;

      if (!startTime || !endTime) {
        console.error('Error: --start-time and --end-time are required.');
        process.exit(1);
      }

      const format: OutputFormat = ['json', 'table', 'pretty'].includes(options.format)
        ? options.format
        : 'pretty';

      const client = new LTSClient(config);

      const params: QueryParams = {
        groupId,
        streamId,
        startTime,
        endTime,
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
        const msg = error.message || String(error);

        // Friendlier error messages for common issues
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
          console.error('Error querying logs:', msg);
        }
        process.exit(1);
      }
    });

  return cmd;
}
