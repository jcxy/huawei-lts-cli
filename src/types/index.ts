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
  startTime?: string; // ISO 8601，与 last 二选一
  endTime?: string;   // ISO 8601，与 last 二选一
  last?: string;      // 相对时间范围，如 30m / 2h / 1d / 7d
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

export interface ContextParams {
  groupId: string;
  streamId: string;
  lineNum: string;   // 目标日志的 line_num
  time: string;      // 目标日志的时间戳（毫秒）
  before?: number;   // 向前（更早）查询条数，默认 20
  after?: number;    // 向后（更晚）查询条数，默认 20
}

export interface GroupInfo {
  id: string;
  name: string;
}

export interface StreamInfo {
  id: string;
  name: string;
  groupId?: string;
}

export type OutputFormat = 'json' | 'table' | 'pretty';
