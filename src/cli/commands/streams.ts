import { Command } from 'commander';
import chalk from 'chalk';
import { LTSClient } from '../../lts/client';
import { GroupInfo, StreamInfo } from '../../types';
import { loadCheckedConfig, handleCommandError } from './common';

function printGroups(groups: GroupInfo[], format: string): void {
  if (format === 'json') {
    console.log(JSON.stringify(groups, null, 2));
    return;
  }
  if (groups.length === 0) {
    console.log(chalk.yellow('No log groups found.'));
    return;
  }
  console.log(chalk.bold.green(`Found ${groups.length} log groups:`));
  console.log('');
  for (const g of groups) {
    console.log(`  ${chalk.cyan(g.name)}  ${chalk.gray(g.id)}`);
  }
  console.log('');
  console.log(chalk.gray('Set default: lts-cli config --set groupId=<id>'));
}

function printStreams(streams: StreamInfo[], format: string): void {
  if (format === 'json') {
    console.log(JSON.stringify(streams, null, 2));
    return;
  }
  if (streams.length === 0) {
    console.log(chalk.yellow('No log streams found.'));
    return;
  }
  console.log(chalk.bold.green(`Found ${streams.length} log streams:`));
  console.log('');
  for (const s of streams) {
    const group = s.groupId ? chalk.gray(`  group: ${s.groupId}`) : '';
    console.log(`  ${chalk.cyan(s.name)}  ${chalk.gray(s.id)}${group}`);
  }
  console.log('');
  console.log(chalk.gray('Set default: lts-cli config --set streamId=<id>'));
}

export function createGroupsCommand(): Command {
  const cmd = new Command('groups');

  cmd.description('List all LTS log groups (name + ID)')
    .option('-f, --format <format>', 'Output format: json, pretty', 'pretty')
    .action(async (options) => {
      const config = loadCheckedConfig();
      const client = new LTSClient(config);

      try {
        const groups = await client.listGroups();
        printGroups(groups, options.format);
      } catch (error: any) {
        handleCommandError(error);
      }
    });

  return cmd;
}

export function createStreamsCommand(): Command {
  const cmd = new Command('streams');

  cmd.description('List LTS log streams, optionally filtered by log group name')
    .option('-g, --group <name>', 'Filter by log group NAME (e.g. acerp)')
    .option('-f, --format <format>', 'Output format: json, pretty', 'pretty')
    .action(async (options) => {
      const config = loadCheckedConfig();
      const client = new LTSClient(config);

      try {
        const streams = await client.listStreams(options.group);
        printStreams(streams, options.format);
      } catch (error: any) {
        handleCommandError(error);
      }
    });

  return cmd;
}
