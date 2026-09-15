import { Command } from 'commander';
import { LTSClient } from '../../lts/client';
import { formatOutput } from '../../output';
import { ContextParams } from '../../types';
import {
  loadCheckedConfig,
  resolveGroupStream,
  resolveFormat,
  handleCommandError,
} from './common';

export function createContextCommand(): Command {
  const cmd = new Command('context');

  cmd.description('View logs before/after a specific log entry (like "View Context" in the console)')
    .option('-g, --group-id <groupId>', 'Log group ID (can also be set via config)')
    .option('-s, --stream-id <streamId>', 'Log stream ID (can also be set via config)')
    .requiredOption('--line-num <lineNum>', 'line_num of the anchor log entry')
    .requiredOption('--time <time>', 'Timestamp (ms) of the anchor log entry')
    .option('--before <count>', 'Number of logs before the anchor', (v: string) => parseInt(v, 10), 20)
    .option('--after <count>', 'Number of logs after the anchor', (v: string) => parseInt(v, 10), 20)
    .option('-f, --format <format>', 'Output format: json, table, pretty', 'pretty')
    .action(async (options) => {
      const config = loadCheckedConfig();
      const { groupId, streamId } = resolveGroupStream(options, config);
      const format = resolveFormat(options.format);

      const client = new LTSClient(config);

      const params: ContextParams = {
        groupId,
        streamId,
        lineNum: options.lineNum,
        time: options.time,
        before: options.before,
        after: options.after,
      };

      try {
        const result = await client.queryContext(params);
        console.log(formatOutput(result, format));
      } catch (error: any) {
        handleCommandError(error);
      }
    });

  return cmd;
}
