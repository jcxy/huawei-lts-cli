import { Command } from 'commander';
import { setConfig, getConfig, listConfig, unsetConfig } from '../../config';

/** 凭证类字段一律脱敏：`config --list` 会把输出留在终端滚屏、shell 历史、agent 上下文里。 */
const SECRET_KEYS = new Set(['ak', 'sk']);

export function maskSecret(value: string): string {
  if (value.length <= 4) return '****';
  return `${value.slice(0, 2)}${'*'.repeat(Math.max(4, value.length - 4))}${value.slice(-2)}`;
}

/** 输出任何配置值时都经过这里：密钥只看得到首尾，其余原样。 */
export function displayValue(key: string, value: string): string {
  return SECRET_KEYS.has(key) ? maskSecret(value) : value;
}

/** 拆 `key=value`。值里可能含 `=`（base64 密钥、URL 参数），只切第一个等号。 */
export function parseAssignment(input: string): { key: string; value: string } | undefined {
  const eq = input.indexOf('=');
  if (eq <= 0) return undefined;
  return { key: input.slice(0, eq), value: input.slice(eq + 1) };
}

export function createConfigCommand(): Command {
  const cmd = new Command('config');

  cmd.description('Manage LTS CLI configuration')
    .option('--set <key=value>', 'Set a configuration value')
    .option('--get <key>', 'Get a configuration value')
    .option('--list', 'List all configuration values')
    .option('--unset <key>', 'Remove a configuration value')
    .action((options) => {
      if (options.set) {
        const assignment = parseAssignment(options.set);
        if (!assignment) {
          console.error('Usage: config --set key=value');
          process.exit(1);
        }
        const { key, value } = assignment;
        setConfig(key, value);
        console.log(`Set ${key}=${displayValue(key, value)}`);
      } else if (options.get) {
        const value = getConfig(options.get);
        if (value !== undefined) {
          console.log(displayValue(options.get, value));
        } else {
          console.error(`Config key '${options.get}' not found`);
          process.exit(1);
        }
      } else if (options.list) {
        const config = listConfig();
        const entries = Object.entries(config);
        if (entries.length === 0) {
          console.log('No configuration values set');
        } else {
          for (const [key, value] of entries) {
            console.log(`${key}=${displayValue(key, value)}`);
          }
        }
      } else if (options.unset) {
        unsetConfig(options.unset);
        console.log(`Removed ${options.unset}`);
      } else {
        console.error('Usage: lts-cli config [--set key=value | --get key | --list | --unset key]');
        process.exit(1);
      }
    });

  return cmd;
}
