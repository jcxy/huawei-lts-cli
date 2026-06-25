import { readConfigFile, writeConfigFile } from './store';
import { LTSConfig } from '../types';

const ENV_MAP: Record<string, string> = {
  ak: 'LTS_AK',
  sk: 'LTS_SK',
  projectId: 'LTS_PROJECT_ID',
  region: 'LTS_REGION',
  endpoint: 'LTS_ENDPOINT',
};

function getEnvValue(key: string): string | undefined {
  const envKey = ENV_MAP[key];
  if (envKey) {
    return process.env[envKey];
  }
  return undefined;
}

export function loadConfig(): LTSConfig {
  const config = readConfigFile();
  return {
    ak: getEnvValue('ak') ?? config.ak ?? '',
    sk: getEnvValue('sk') ?? config.sk ?? '',
    projectId: getEnvValue('projectId') ?? config.projectId ?? '',
    region: getEnvValue('region') ?? config.region ?? '',
    endpoint: getEnvValue('endpoint') ?? config.endpoint ?? '',
  };
}

export function getConfig(key: string): string | undefined {
  const envValue = getEnvValue(key);
  if (envValue !== undefined) {
    return envValue;
  }
  const config = readConfigFile();
  return config[key];
}

export function setConfig(key: string, value: string): void {
  const config = readConfigFile();
  config[key] = value;
  writeConfigFile(config);
}

export function listConfig(): Record<string, string> {
  return readConfigFile();
}

export function unsetConfig(key: string): void {
  const config = readConfigFile();
  delete config[key];
  writeConfigFile(config);
}
