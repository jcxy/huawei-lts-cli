import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.lts-cli');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
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
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

export function getConfigFilePath(): string {
  return CONFIG_FILE;
}
