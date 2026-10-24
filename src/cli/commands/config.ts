import { Command } from 'commander';
import { setConfig, getConfig, listConfig, unsetConfig } from '../../config';

/** 凭证类字段一律脱敏：`config --list` 会把输出留在终端滚屏、shell 历史、agent 上下文里。 */
const SECRET_KEYS = new Set(['ak', 'sk']);

function maskSecret(value: string): string {
  if (value.length <= 4) return '****';
  return `${value.slice(0, 2)}${'*'.repeat(Math.max(4, value.length - 4))}${value.slice(-2)}`;
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
        const parts = options.set.split('=');
        if (parts.length !== 2) {
          console.error('Usage: config --set key=value');
          process.exit(1);
        }
        const [key, value] = parts;
        setConfig(key, value);
        console.log(`Set ${key}=${value}`);
      } else if (options.get) {
        const value = getConfig(options.get);
        if (value !== undefined) {
          console.log(SECRET_KEYS.has(options.get) ? maskSecret(value) : value);
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
            console.log(`${key}=${SECRET_KEYS.has(key) ? maskSecret(value) : value}`);
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
