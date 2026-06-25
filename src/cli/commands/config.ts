import { Command } from 'commander';
import { setConfig, getConfig, listConfig, unsetConfig } from '../../config';

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
          console.log(value);
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
            console.log(`${key}=${value}`);
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
