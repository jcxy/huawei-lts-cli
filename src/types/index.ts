export interface LTSConfig {
  ak: string;
  sk: string;
  projectId: string;
  region: string;
  endpoint: string;
  groupId?: string;
  streamId?: string;
}

export interface QueryParams {
  groupId: string;
  streamId: string;
  startTime: string; // ISO 8601
  endTime: string;     // ISO 8601
  keyword?: string;    // 向后兼容：简单关键词搜索
  query?: string;      // SQL查询语句或结构化查询表达式
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
