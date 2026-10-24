import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.lts-cli');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
}

export function readConfigFile(): Record<string, string> {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      return {};
    }
    const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(data) as Record<string, string>;
  } catch {
    return {};
  }
}

export function writeConfigFile(config: Record<string, string>): void {
  ensureDir(CONFIG_DIR);
  // 配置里是明文 AK/SK：目录 0700、文件 0600，别让同机器上的其他账号读到
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { encoding: 'utf-8', mode: 0o600 });
}

export function getConfigFilePath(): string {
  return CONFIG_FILE;
}

export function getConfigDir(): string {
  return CONFIG_DIR;
}
