#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { Command } from 'commander';
import { createQueryCommand } from './commands/query';
import { createTraceCommand } from './commands/trace';
import { createContextCommand } from './commands/context';
import { createGroupsCommand, createStreamsCommand } from './commands/streams';
import { createConfigCommand } from './commands/config';
import { createInitCommand } from './commands/init';
import { createFieldsCommand } from './commands/fields';

/**
 * Read the version from package.json at runtime.
 *
 * A hard-coded version string drifts silently from package.json — `lts-cli --version`
 * then reports a build that was never published. Resolved relative to __dirname so it
 * works both from src/ (tsx) and dist/ (published package).
 */
function readVersion(): string {
  try {
    const pkgPath = path.resolve(__dirname, '..', '..', 'package.json');
    return JSON.parse(fs.readFileSync(pkgPath, 'utf-8')).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

const program = new Command();

program
  .name('lts-cli')
  .description('Huawei Cloud LTS (Log Tank Service) CLI — query logs from the terminal')
  .version(readVersion())
  .addHelpText('after', `
Examples:
  $ lts-cli init                     Setup credentials interactively
  $ lts-cli init --from-url <url>    Import region/groupId/streamId from a console URL
  $ lts-cli config --list            Show current configuration
  $ lts-cli groups                   List log groups
  $ lts-cli streams                  List log streams in a group
  $ lts-cli fields                   Show the index config of a log stream
  $ lts-cli query --last 2h -q 'level:error' --all
  $ lts-cli trace <requestId>        Fetch the full request chain

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
program.addCommand(createTraceCommand());
program.addCommand(createContextCommand());
program.addCommand(createGroupsCommand());
program.addCommand(createStreamsCommand());
program.addCommand(createFieldsCommand());
program.addCommand(createConfigCommand());

/**
 * 补全列表手写在下面，和命令定义分居两处，很容易漏更新。
 * 改任何命令的选项时请同步这三段。
 */
const QUERY_OPTS =
  '-g --group-id -s --stream-id --start-time --end-time --st --et --last -q --query --app --content --request-id -l --limit -r --reverse -f --format --all';
const TRACE_OPTS =
  '-g --group-id -s --stream-id --field --last --start-time --end-time --st --et -l --limit -f --format';
const CONTEXT_OPTS = '-g --group-id -s --stream-id --line-num --time --before --after -f --format';
const VALUE_OPTS = '-g --group-id -s --stream-id -f --format';

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
  local prev="\${words[cword-1]}"

  if (( cword == 1 )); then
    COMPREPLY=( $(compgen -W "query trace context groups streams fields config init completion" -- "\$cur") )
    return
  fi

  local cmd="\${words[1]}"
  case "\$cmd" in
    query)
      case "\$prev" in
        -g|--group-id|-s|--stream-id|-q|--query|--app|--content|--request-id|--start-time|--end-time|--st|--et|--last|-l|--limit|-f|--format)
          COMPREPLY=()
          return
          ;;
        *)
          COMPREPLY=( $(compgen -W "${QUERY_OPTS}" -- "\$cur") )
          return
          ;;
      esac
      ;;
    trace)
      case "\$prev" in
        -g|--group-id|-s|--stream-id|--field|--start-time|--end-time|--st|--et|--last|-l|--limit|-f|--format)
          COMPREPLY=()
          return
          ;;
        *)
          COMPREPLY=( $(compgen -W "${TRACE_OPTS}" -- "\$cur") )
          return
          ;;
      esac
      ;;
    context)
      case "\$prev" in
        -g|--group-id|-s|--stream-id|--line-num|--time|--before|--after|-f|--format)
          COMPREPLY=()
          return
          ;;
        *)
          COMPREPLY=( $(compgen -W "${CONTEXT_OPTS}" -- "\$cur") )
          return
          ;;
      esac
      ;;
    groups)
      COMPREPLY=( $(compgen -W "-f --format" -- "\$cur") )
      return
      ;;
    streams)
      COMPREPLY=( $(compgen -W "${VALUE_OPTS}" -- "\$cur") )
      return
      ;;
    fields)
      COMPREPLY=( $(compgen -W "${VALUE_OPTS}" -- "\$cur") )
      return
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
    'trace:Trace a request by ID'
    'context:View logs before/after a log entry'
    'groups:List log groups'
    'streams:List log streams'
    'fields:Show the index config of a log stream'
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
            '--last[Relative range: 30m, 2h, 1d, 7d]:duration:' \\
            '-q[Query expression]:query:' \\
            '--app[Filter by appName]:appName:' \\
            '--content[Filter by content]:keyword:' \\
            '--request-id[Filter by REQUEST_ID]:id:' \\
            '-l[Page size]:number:' \\
            '-r[Reverse order]' \\
            '-f[Output format]:format:(json table pretty)' \\
            '--all[Follow the cursor to the end]'
          ;;
        trace)
          _arguments \\
            '-g[Log group ID]:group ID:' \\
            '-s[Log stream ID]:stream ID:' \\
            '--field[Field to match]:field:' \\
            '--last[Relative range: 30m, 2h, 1d, 7d]:duration:' \\
            '--start-time[Start time (ISO 8601)]:time:' \\
            '--end-time[End time (ISO 8601)]:time:' \\
            '--st[Alias for --start-time]:time:' \\
            '--et[Alias for --end-time]:time:' \\
            '-l[Max logs]:number:' \\
            '-f[Output format]:format:(json table pretty)'
          ;;
        fields|groups|streams)
          _arguments \\
            '-g[Log group ID]:group ID:' \\
            '-s[Log stream ID]:stream ID:' \\
            '-f[Output format]:format:(json table pretty)'
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

  \$commands = @('query', 'trace', 'context', 'groups', 'streams', 'fields', 'config', 'init', 'completion')

  \$args = \$commandAst.ToString() -split '\\s+'
  if (\$args.Count -le 1) {
    return \$commands | Where-Object { \$_ -like "\$wordToComplete*" }
  }

  switch (\$args[1]) {
    'query' {
      \$opts = @('-g', '-s', '--start-time', '--end-time', '--st', '--et', '--last', '-q', '--app', '--content', '--request-id', '-l', '-r', '-f', '--all')
      return \$opts | Where-Object { \$_ -like "\$wordToComplete*" }
    }
    'trace' {
      \$opts = @('-g', '-s', '--field', '--last', '--start-time', '--end-time', '--st', '--et', '-l', '-f')
      return \$opts | Where-Object { \$_ -like "\$wordToComplete*" }
    }
    'fields' {
      \$opts = @('-g', '-s', '-f')
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
