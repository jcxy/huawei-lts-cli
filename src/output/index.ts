import * as chalk from 'chalk';
import { QueryResult, OutputFormat } from '../types';
import { formatJson } from './json';
import { formatTable } from './table';

export function formatOutput(data: QueryResult, format: OutputFormat): string {
  switch (format) {
    case 'json':
      return formatJson(data);
    case 'table':
      return formatTable(data);
    case 'pretty':
      return formatPretty(data);
    default:
      return formatJson(data);
  }
}

function formatPretty(data: QueryResult): string {
  if (data.logs.length === 0) {
    return chalk.yellow('No logs found.');
  }

  const lines: string[] = [];
  lines.push(chalk.bold.green(`Found ${data.total} logs:`));
  lines.push('');

  for (const log of data.logs) {
    lines.push(chalk.cyan(`[${log.logTime}]`));
    lines.push(chalk.white(log.content));
    if (Object.keys(log.labels).length > 0) {
      const labels = Object.entries(log.labels)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ');
      lines.push(chalk.gray(`  labels: ${labels}`));
    }
    lines.push('');
  }

  return lines.join('\n');
}
