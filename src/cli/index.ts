#!/usr/bin/env node
import { Command } from 'commander';
import { createQueryCommand } from './commands/query';
import { createConfigCommand } from './commands/config';

const program = new Command();

program
  .name('lts-cli')
  .description('Huawei Cloud LTS CLI')
  .version('1.0.0');

program.addCommand(createQueryCommand());
program.addCommand(createConfigCommand());

program.parse();
