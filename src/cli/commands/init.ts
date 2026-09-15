import { Command } from 'commander';
import * as readline from 'readline';
import { setConfig } from '../../config';

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

const ENDPOINT_MAP: Record<string, string> = {
  'cn-north-1': 'lts.cn-north-1.myhuaweicloud.com',
  'cn-north-2': 'lts.cn-north-2.myhuaweicloud.com',
  'cn-north-4': 'lts.cn-north-4.myhuaweicloud.com',
  'cn-north-5': 'lts.cn-north-5.myhuaweicloud.com',
  'cn-north-9': 'lts.cn-north-9.myhuaweicloud.com',
  'cn-east-2': 'lts.cn-east-2.myhuaweicloud.com',
  'cn-east-3': 'lts.cn-east-3.myhuaweicloud.com',
  'cn-east-4': 'lts.cn-east-4.myhuaweicloud.com',
  'cn-south-1': 'lts.cn-south-1.myhuaweicloud.com',
  'cn-south-2': 'lts.cn-south-2.myhuaweicloud.com',
  'cn-south-4': 'lts.cn-south-4.myhuaweicloud.com',
  'cn-southwest-2': 'lts.cn-southwest-2.myhuaweicloud.com',
  'ap-southeast-1': 'lts.ap-southeast-1.myhuaweicloud.com',
  'ap-southeast-2': 'lts.ap-southeast-2.myhuaweicloud.com',
  'ap-southeast-3': 'lts.ap-southeast-3.myhuaweicloud.com',
  'af-south-1': 'lts.af-south-1.myhuaweicloud.com',
  'la-south-2': 'lts.la-south-2.myhuaweicloud.com',
  'sa-brazil-1': 'lts.sa-brazil-1.myhuaweicloud.com',
  'na-mexico-1': 'lts.na-mexico-1.myhuaweicloud.com',
  'la-north-2': 'lts.la-north-2.myhuaweicloud.com',
};

export function createInitCommand(): Command {
  const cmd = new Command('init');

  cmd.description('Interactive setup wizard — configure credentials step by step')
    .option('--from-url <url>', 'Import region/groupId/streamId from an LTS console URL (non-interactive)')
    .action(async (options) => {
      // 从控制台 URL 导入：解析 region、groupId、topicId（即 streamId），无需交互
      if (options.fromUrl) {
        importFromConsoleUrl(options.fromUrl);
        return;
      }

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      console.log('');
      console.log('╔══════════════════════════════════════════════╗');
      console.log('║   Huawei Cloud LTS CLI — Setup Wizard       ║');
      console.log('╚══════════════════════════════════════════════╝');
      console.log('');
      console.log('This wizard will guide you through setting up your credentials.');
      console.log('You can find AK/SK in the Huawei Cloud console under:');
      console.log('  My Credentials > Access Keys');
      console.log('');
      console.log('Press Enter to skip any optional field.');
      console.log('');

      try {
        // Required: AK
        const ak = await ask(rl, 'Access Key (AK): ');
        if (ak) {
          setConfig('ak', ak);
        }

        // Required: SK
        const sk = await ask(rl, 'Secret Key (SK): ');
        if (sk) {
          setConfig('sk', sk);
        }

        // Required: Project ID
        const projectId = await ask(rl, 'Project ID: ');
        if (projectId) {
          setConfig('projectId', projectId);
        }

        // Required: Region
        console.log('');
        console.log('Common regions: cn-north-1, cn-north-4, cn-east-2, cn-east-3, cn-south-1');
        const region = await ask(rl, 'Region (e.g. cn-south-1): ');
        if (region) {
          setConfig('region', region);

          // Auto-suggest endpoint based on region
          const autoEndpoint = ENDPOINT_MAP[region];
          if (autoEndpoint) {
            const useDefault = await ask(rl, `Endpoint [https://${autoEndpoint}]: `);
            if (!useDefault) {
              setConfig('endpoint', `https://${autoEndpoint}`);
            } else {
              const customEndpoint = useDefault.startsWith('http') ? useDefault : `https://${useDefault}`;
              setConfig('endpoint', customEndpoint);
            }
          } else {
            const endpoint = await ask(rl, 'Endpoint (e.g. https://lts.cn-south-1.myhuaweicloud.com): ');
            if (endpoint) {
              const normalized = endpoint.startsWith('http') ? endpoint : `https://${endpoint}`;
              setConfig('endpoint', normalized);
            }
          }
        }

        // Optional: default groupId & streamId
        console.log('');
        console.log('Optional — set default log group & stream so you can query without -g / -s:');
        const groupId = await ask(rl, 'Default Log Group ID (optional): ');
        if (groupId) {
          setConfig('groupId', groupId);
        }

        const streamId = await ask(rl, 'Default Log Stream ID (optional): ');
        if (streamId) {
          setConfig('streamId', streamId);
        }

        console.log('');
        console.log('✅ Configuration saved!');
        console.log('');
        console.log('Try it out:');
        if (groupId && streamId) {
          console.log('  lts-cli query --start-time 2024-01-01T00:00:00Z --end-time 2024-01-02T00:00:00Z');
        } else {
          console.log('  lts-cli query -g <group-id> -s <stream-id> --start-time 2024-01-01T00:00:00Z --end-time 2024-01-02T00:00:00Z');
        }
        console.log('');
      } finally {
        rl.close();
      }
    });

  return cmd;
}

/** 从华为云 LTS 控制台 URL 中解析 region / groupId / streamId 并写入配置 */
function importFromConsoleUrl(raw: string): void {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    console.error('Error: Invalid URL. Please paste the full console URL, e.g.:');
    console.error('  https://console.huaweicloud.com/lts/?region=cn-south-1#/cts/logEventsLeftMenu/events?groupId=...&topicId=...');
    process.exit(1);
  }

  const region = url.searchParams.get('region') || undefined;

  // groupId / topicId 位于 hash 段的查询参数中：#/cts/logEventsLeftMenu/events?groupId=...&topicId=...
  const hash = url.hash || '';
  const qIndex = hash.indexOf('?');
  const hashParams = new URLSearchParams(qIndex >= 0 ? hash.slice(qIndex + 1) : '');
  const groupId = hashParams.get('groupId') || url.searchParams.get('groupId') || undefined;
  const streamId = hashParams.get('topicId') || hashParams.get('streamId') || url.searchParams.get('topicId') || undefined;

  if (!region && !groupId && !streamId) {
    console.error('Error: No region/groupId/topicId found in the URL. Make sure it is an LTS log search page URL.');
    process.exit(1);
  }

  console.log('');
  console.log('Importing from console URL:');

  if (region) {
    setConfig('region', region);
    console.log(`  region   = ${region}`);

    const autoEndpoint = ENDPOINT_MAP[region];
    if (autoEndpoint) {
      setConfig('endpoint', `https://${autoEndpoint}`);
      console.log(`  endpoint = https://${autoEndpoint} (derived from region)`);
    }
  }
  if (groupId) {
    setConfig('groupId', groupId);
    console.log(`  groupId  = ${groupId}`);
  }
  if (streamId) {
    setConfig('streamId', streamId);
    console.log(`  streamId = ${streamId}`);
  }

  console.log('');
  console.log('✅ Configuration saved!');
  console.log('');
  console.log('Next steps:');
  console.log('  1. Configure credentials if not done yet: lts-cli init');
  console.log('  2. Query logs: lts-cli query --last 2h --content "error"');
  console.log('');
}
