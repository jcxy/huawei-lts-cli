#!/usr/bin/env node
import { Command } from 'commander';
import { createQueryCommand } from './commands/query';
import { createConfigCommand } from './commands/config';
import { createInitCommand } from './commands/init';

const program = new Command();

program
  .name('lts-cli')
  .description('Huawei Cloud LTS (Log Tank Service) CLI — query logs from the terminal')
  .version('1.0.0')
  .addHelpText('after', `
Examples:
  $ lts-cli init                     Setup credentials interactively
  $ lts-cli config --list            Show current configuration
  $ lts-cli query --st 2024-01-01T00:00:00Z --et 2024-01-02T00:00:00Z

Environment variables:
  LTS_AK           Access Key
  LTS_SK           Secret Key
  LTS_PROJECT_ID   Project ID
  LTS_REGION       Region
  LTS_ENDPOINT     Service endpoint
  LTS_GROUP_ID     Default log group ID
  LTS_STREAM_ID    Default log stream ID
`);

program.addCommand(createInitCommand());
program.addCommand(createQueryCommand());
program.addCommand(createConfigCommand());

// Shell completion support
const completionCmd = new Command('completion')
  .description('Generate shell completion script')
  .argument('<shell>', 'Shell type: bash, zsh, or powershell')
  .action((shell: string) => {
    switch (shell) {
      case 'bash':
        console.log(`# lts-cli bash completion — add to ~/.bashrc or ~/.bash_profile
_lts_cli_completion() {
  local words cword
  _get_comp_words_by_ref -n : words cword
  local cur="\${words[cword]}"

  if (( cword == 1 )); then
    COMPREPLY=( $(compgen -W "query config init completion" -- "\$cur") )
    return
  fi

  local cmd="\${words[1]}"
  case "\$cmd" in
    query)
      case "\$prev" in
        -g|--group-id|-s|--stream-id|-k|--keyword|-l|--limit|-o|--offset|-f|--format)
          COMPREPLY=()
          return
          ;;
        *)
          COMPREPLY=( $(compgen -W "-g --group-id -s --stream-id --start-time --end-time --st --et -k --keyword -l --limit -o --offset -r --reverse -f --format --no-paginate" -- "\$cur") )
          return
          ;;
      esac
      ;;
    config)
      COMPREPLY=( $(compgen -W "--set --get --list --unset" -- "\$cur") )
      return
      ;;
    completion)
      COMPREPLY=( $(compgen -W "bash zsh powershell" -- "\$cur") )
      return
      ;;
    *)
      COMPREPLY=()
      return
      ;;
  esac
}
complete -F _lts_cli_completion lts-cli`);
        break;
      case 'zsh':
        console.log(`# lts-cli zsh completion — add to ~/.zshrc
#compdef lts-cli
_lts_cli() {
  local -a commands
  commands=(
    'query:Query LTS logs'
    'config:Manage configuration'
    'init:Interactive setup wizard'
    'completion:Generate shell completion script'
  )

  local context state state_descr line
  typeset -A opt_args

  _arguments -C \\
    '1: :->command' \\
    '*:: :->args'

  case "\$state" in
    command)
      _describe 'command' commands
      ;;
    args)
      case "\$line[1]" in
        query)
          _arguments \\
            '-g[Log group ID]:group ID:' \\
            '-s[Log stream ID]:stream ID:' \\
            '--start-time[Start time (ISO 8601)]:time:' \\
            '--end-time[End time (ISO 8601)]:time:' \\
            '--st[Alias for --start-time]:time:' \\
            '--et[Alias for --end-time]:time:' \\
            '-k[Search keyword]:keyword:' \\
            '-l[Limit]:number:' \\
            '-o[Offset]:number:' \\
            '-r[Reverse order]' \\
            '-f[Output format]:format:(json table pretty)' \\
            '--no-paginate[Disable pagination]'
          ;;
        config)
          _arguments \\
            '--set[Set config value]:key=value:' \\
            '--get[Get config value]:key:' \\
            '--list[List all config]' \\
            '--unset[Remove config value]:key:'
          ;;
        completion)
          _values 'shell' bash zsh powershell
          ;;
      esac
      ;;
  esac
}
compdef _lts_cli lts-cli`);
        break;
      case 'powershell':
        console.log(`# lts-cli PowerShell completion — add to $PROFILE
Register-ArgumentCompleter -CommandName lts-cli -ScriptBlock {
  param(\$wordToComplete, \$commandAst, \$cursorPosition)

  \$commands = @('query', 'config', 'init', 'completion')

  \$args = \$commandAst.ToString() -split '\\s+'
  if (\$args.Count -le 1) {
    return \$commands | Where-Object { \$_ -like "\$wordToComplete*" }
  }

  switch (\$args[1]) {
    'query' {
      \$opts = @('-g', '-s', '--start-time', '--end-time', '--st', '--et', '-k', '-l', '-o', '-r', '-f', '--no-paginate')
      return \$opts | Where-Object { \$_ -like "\$wordToComplete*" }
    }
    'config' {
      \$opts = @('--set', '--get', '--list', '--unset')
      return \$opts | Where-Object { \$_ -like "\$wordToComplete*" }
    }
    'completion' {
      return @('bash', 'zsh', 'powershell') | Where-Object { \$_ -like "\$wordToComplete*" }
    }
  }
}`);
        break;
      default:
        console.error(`Unknown shell: ${shell}. Supported: bash, zsh, powershell`);
        process.exit(1);
    }
  });

program.addCommand(completionCmd);

program.parse();
