export interface LTSConfig {
  ak: string;
  sk: string;
  projectId: string;
  region: string;
  endpoint: string;
}

export interface QueryParams {
  groupId: string;
  streamId: string;
  startTime: string; // ISO 8601
  endTime: string;     // ISO 8601
  keyword?: string;
  limit?: number;
  offset?: number;
  reverse?: boolean;
}

export interface LogEntry {
  logTime: string;
  content: string;
  labels: Record<string, string>;
}

export interface QueryResult {
  logs: LogEntry[];
  total: number;
}

export type OutputFormat = 'json' | 'table' | 'pretty';
