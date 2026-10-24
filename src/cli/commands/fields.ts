import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import { LTSClient } from '../../lts/client';
import { StreamIndex } from '../../types';
import {
  loadCheckedConfig,
  resolveGroupStream,
  resolveFormat,
  handleCommandError,
} from './common';

/**
 * 输出日志流的索引配置。
 *
 * 存在的理由：字段名、字段类型、大小写是否敏感、分词符，全都是**每条日志流各自一份**
 * 的配置（SDK 里是 LTSFullTextIndexInfo / LTSFieldsInfo）。任何写进文档的字段表都只对
 * 某一条流成立，换个环境就是错的。所以答案必须在运行时从 API 取。
 */

function boolLabel(value: boolean | undefined): string {
  if (value === undefined) return '-';
  return value ? 'yes' : 'no';
}

function formatJson(index: StreamIndex): string {
  return JSON.stringify(index, null, 2);
}

function formatTable(index: StreamIndex): string {
  const lines: string[] = [];

  const summary = new Table({ head: ['Full-text index', 'Value'] });
  summary.push(
    ['enabled', boolLabel(index.fullText.enabled)],
    ['caseSensitive', boolLabel(index.fullText.caseSensitive)],
    ['includeChinese', boolLabel(index.fullText.includeChinese)],
    ['tokenizer', index.fullText.tokenizer || '-']
  );
  lines.push(summary.toString());

  if (index.fields.length === 0) {
    lines.push('');
    lines.push('No field index configured — only full-text search is available on this stream.');
    return lines.join('\n');
  }

  lines.push('');
  const fields = new Table({
    head: ['Field', 'Type', 'Case-sensitive', 'Chinese', 'Tokenizer', 'Quick analysis'],
  });
  for (const f of index.fields) {
    fields.push([
      f.name,
      f.type || '-',
      boolLabel(f.caseSensitive),
      boolLabel(f.includeChinese),
      f.tokenizer || '-',
      boolLabel(f.quickAnalysis),
    ]);
  }
  lines.push(fields.toString());
  return lines.join('\n');
}

function formatPretty(index: StreamIndex): string {
  const lines: string[] = [];
  lines.push(chalk.bold(`Stream ${index.streamId}`));
  lines.push('');

  lines.push(chalk.bold('Full-text index'));
  lines.push(`  enabled:        ${boolLabel(index.fullText.enabled)}`);
  lines.push(`  caseSensitive:  ${boolLabel(index.fullText.caseSensitive)}`);
  lines.push(`  includeChinese: ${boolLabel(index.fullText.includeChinese)}`);
  lines.push(`  tokenizer:      ${index.fullText.tokenizer || '-'}`);
  lines.push('');

  if (index.fields.length === 0) {
    lines.push(chalk.yellow('No field index configured — only full-text search is available.'));
    return lines.join('\n');
  }

  lines.push(chalk.bold(`Fields (${index.fields.length})`));
  for (const f of index.fields) {
    const flags = [
      f.caseSensitive ? 'case-sensitive' : 'case-insensitive',
      f.includeChinese ? 'chinese' : 'no-chinese',
      f.quickAnalysis ? 'quick-analysis' : null,
    ].filter(Boolean);
    lines.push(`  ${chalk.cyan(f.name)}  ${chalk.gray(f.type || '-')}  ${chalk.gray(flags.join(', '))}`);
    if (f.tokenizer) {
      lines.push(chalk.gray(`    tokenizer: ${f.tokenizer}`));
    }
  }

  return lines.join('\n');
}

export function createFieldsCommand(): Command {
  const cmd = new Command('fields');

  cmd
    .description('Show the index config of a log stream (fields, types, case sensitivity, tokenizer)')
    .option('-g, --group-id <groupId>', 'Log group ID (can also be set via config)')
    .option('-s, --stream-id <streamId>', 'Log stream ID (can also be set via config)')
    .option('-f, --format <format>', 'Output format: json, table, pretty', 'pretty')
    .action(async (options) => {
      const config = loadCheckedConfig();
      const { groupId, streamId } = resolveGroupStream(options, config);
      const format = resolveFormat(options.format);

      const client = new LTSClient(config);

      try {
        const index = await client.getStreamIndex(groupId, streamId);
        const output =
          format === 'json'
            ? formatJson(index)
            : format === 'table'
              ? formatTable(index)
              : formatPretty(index);
        console.log(output);
      } catch (error: any) {
        handleCommandError(error);
      }
    });

  return cmd;
}
