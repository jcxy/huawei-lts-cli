import Table from 'cli-table3';
import { QueryResult } from '../types';

export function formatTable(data: QueryResult): string {
  if (data.logs.length === 0) {
    return 'No logs found.';
  }

  const table = new Table({
    head: ['Time', 'Content', 'Labels'],
    colWidths: [25, 50, 30],
    wordWrap: true,
  });

  for (const log of data.logs) {
    const labelsStr = Object.entries(log.labels)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ');
    table.push([log.logTime, log.content, labelsStr]);
  }

  return table.toString();
}
