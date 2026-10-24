export interface LTSConfig {
  ak: string;
  sk: string;
  projectId: string;
  region: string;
  endpoint: string;
  groupId?: string;
  streamId?: string;
}

/** 翻页方向。LTS 没有 offset，只能从一个 line_num 往一个方向续读。 */
export type SearchType = 'forwards' | 'backwards';

export interface QueryParams {
  groupId: string;
  streamId: string;
  startTime?: string; // ISO 8601，与 last 二选一
  endTime?: string;   // ISO 8601，与 last 二选一
  last?: string;      // 相对时间范围，如 30m / 2h / 1d / 7d
  query?: string;     // 搜索表达式或管道语法：搜索语句 | SELECT ...
  limit?: number;
  /** 游标：上一页最后一条的 line_num。首页不传。 */
  lineNum?: string;
  /** 游标方向：forwards=往更晚读，backwards=往更早读。首页不传。 */
  searchType?: SearchType;
  reverse?: boolean;
}

/**
 * 一条日志。LTS 的 LogContents 只有 content / line_num / labels —— 没有时间戳。
 * line_num 同时是稳定排序键和翻页游标。
 */
export interface LogEntry {
  lineNum: string;
  content: string;
  labels: Record<string, string>;
}

export interface QueryResult {
  logs: LogEntry[];
  total: number;
  /**
   * LTS 在时间跨度过大时会返回不完整结果并置 false。
   * undefined 表示服务端未返回该字段（不要当成 false 处理）。
   */
  isQueryComplete?: boolean;
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

/** 单字段的索引配置。每一项都是「每条日志流各自一份」，不能当全局事实。 */
export interface FieldIndex {
  name: string;
  /** string | long | float | json */
  type: string;
  caseSensitive?: boolean;
  includeChinese?: boolean;
  tokenizer?: string;
  quickAnalysis?: boolean;
}

/** 全文索引配置（整条流级别） */
export interface FullTextIndex {
  enabled: boolean;
  caseSensitive?: boolean;
  includeChinese?: boolean;
  tokenizer?: string;
}

export interface StreamIndex {
  streamId: string;
  fullText: FullTextIndex;
  fields: FieldIndex[];
}

export type OutputFormat = 'json' | 'table' | 'pretty';
