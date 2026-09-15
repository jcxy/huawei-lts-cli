import { LtsClient } from '@huaweicloud/huaweicloud-sdk-lts/v2/LtsClient';
import { ClientBuilder } from '@huaweicloud/huaweicloud-sdk-core/ClientBuilder';
import { BasicCredentials } from '@huaweicloud/huaweicloud-sdk-core/auth/BasicCredentials';
import { Region } from '@huaweicloud/huaweicloud-sdk-core/region/region';
import { ListLogsRequest } from '@huaweicloud/huaweicloud-sdk-lts/v2/model/ListLogsRequest';
import { QueryLtsLogParams } from '@huaweicloud/huaweicloud-sdk-lts/v2/model/QueryLtsLogParams';
import { ListLogContextRequest } from '@huaweicloud/huaweicloud-sdk-lts/v2/model/ListLogContextRequest';
import { ListLogContextRequestBody } from '@huaweicloud/huaweicloud-sdk-lts/v2/model/ListLogContextRequestBody';
import { ListLogGroupsRequest } from '@huaweicloud/huaweicloud-sdk-lts/v2/model/ListLogGroupsRequest';
import { ListLogStreamsRequest } from '@huaweicloud/huaweicloud-sdk-lts/v2/model/ListLogStreamsRequest';
import { LTSConfig, QueryParams, QueryResult, LogEntry, ContextParams, GroupInfo, StreamInfo } from '../types';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const DURATION_REGEX = /^(\d+)([mhd])$/;
const DURATION_UNIT_MS: Record<string, number> = {
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

/** 解析相对时间范围（如 30m/2h/1d），返回 [startMs, endMs] */
export function resolveTimeRange(params: QueryParams): { startMs: number; endMs: number } {
  if (params.last) {
    const match = DURATION_REGEX.exec(params.last.trim());
    if (!match) {
      throw new Error(`Invalid --last duration: "${params.last}". Expected format like 30m, 2h, 1d, 7d.`);
    }
    const amount = parseInt(match[1], 10);
    const endMs = Date.now();
    return { startMs: endMs - amount * DURATION_UNIT_MS[match[2]], endMs };
  }
  if (!params.startTime || !params.endTime) {
    throw new Error('Time range required: provide --last (e.g. --last 2h) or both --start-time and --end-time.');
  }
  const startMs = new Date(params.startTime).getTime();
  const endMs = new Date(params.endTime).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    throw new Error(`Invalid time format. Use ISO 8601 (e.g. 2024-01-01T00:00:00Z).`);
  }
  return { startMs, endMs };
}

interface ParsedQueryExpression {
  keywords?: string;
  query?: string;
  isAnalysisQuery: boolean;
}

/**
 * 解析查询表达式（对齐控制台管道语法）：
 * - "搜索语句 | SELECT ..." → keywords=搜索语句, query=SQL, is_analysis_query=true
 * - 裸 "SELECT ..."         → query=SQL, is_analysis_query=true
 * - 其他（field:value 等）  → keywords=搜索语句
 */
function parseQueryExpression(expr: string): ParsedQueryExpression {
  const trimmed = expr.trim();

  if (trimmed.includes('|')) {
    const idx = trimmed.indexOf('|');
    const searchPart = trimmed.slice(0, idx).trim();
    const sqlPart = trimmed.slice(idx + 1).trim();
    return {
      keywords: searchPart && searchPart !== '*' ? searchPart : undefined,
      query: sqlPart || undefined,
      isAnalysisQuery: sqlPart.length > 0,
    };
  }

  if (/^select\s/i.test(trimmed)) {
    return { query: trimmed, isAnalysisQuery: true };
  }

  return { keywords: trimmed, isAnalysisQuery: false };
}

/** 服务端默认在命中词上包裹 <HighLightTag>，输出前剥离 */
function stripHighlightTags(value: string): string {
  return value.replace(/<\/?HighLightTag>/g, '');
}

export class LTSClient {
  private client: LtsClient;
  private config: LTSConfig;

  constructor(config: LTSConfig) {
    this.config = config;
    const credentials = new BasicCredentials()
      .withAk(config.ak)
      .withSk(config.sk)
      .withProjectId(config.projectId);

    const builder = new ClientBuilder<LtsClient>((hcClient) => new LtsClient(hcClient));
    if (config.endpoint) {
      builder.withEndpoint(config.endpoint);
    }
    if (config.region) {
      builder.withRegion(new Region(config.region, config.endpoint || ''));
    }
    builder.withCredential(credentials);

    this.client = builder.build();
  }

  async queryLogs(params: QueryParams): Promise<QueryResult> {
    const { startMs, endMs } = resolveTimeRange(params);

    const queryParams = new QueryLtsLogParams()
      .withStartTime(startMs.toString())
      .withEndTime(endMs.toString())
      .withLimit(Number.isFinite(params.limit) ? (params.limit as number) : 100);

    // 优先使用 query 参数（支持SQL和结构化查询）
    if (params.query) {
      const parsed = parseQueryExpression(params.query);
      if (parsed.keywords) {
        queryParams.withKeywords(parsed.keywords);
      }
      if (parsed.query) {
        queryParams.withQuery(parsed.query);
      }
      if (parsed.isAnalysisQuery) {
        queryParams.withIsAnalysisQuery(true);
      }
    } else if (params.keyword) {
      // 向后兼容：简单关键词搜索
      queryParams.withKeywords(params.keyword);
    }

    if (params.reverse !== undefined) {
      queryParams.withIsDesc(params.reverse);
    }

    const request = new ListLogsRequest(params.groupId, params.streamId, 'application/json')
      .withBody(queryParams);

    const response = await this.retryRequest(() => this.client.listLogs(request));
    const raw = response as any;

    // SQL 分析查询：结果在 analysisLogs 中（行为 JSON 对象）
    if (Array.isArray(raw.analysisLogs)) {
      const logs: LogEntry[] = raw.analysisLogs.map((row: any) => ({
        logTime: '',
        content: JSON.stringify(row),
        labels: {},
      }));
      return { logs, total: logs.length };
    }

    const logs: LogEntry[] = (response.logs || []).map((log) => ({
      logTime: (log as any).line_num ?? log.lineNum ?? '',
      content: stripHighlightTags(log.content ?? ''),
      labels: Object.fromEntries(
        Object.entries(log.labels ?? {}).map(([k, v]) => [k, stripHighlightTags(v)])
      ),
    }));

    return {
      logs,
      total: response.count ?? logs.length,
    };
  }

  /** 查询某条日志的上下文（前后各 N 行），对应控制台的“查看上下文” */
  async queryContext(params: ContextParams): Promise<QueryResult> {
    const body = new ListLogContextRequestBody()
      .withLineNum(params.lineNum)
      .withTime(params.time)
      .withBackwardsSize(params.before ?? 20)
      .withForwardsSize(params.after ?? 20);

    const request = new ListLogContextRequest(params.groupId, params.streamId, 'application/json')
      .withBody(body);

    const response = await this.retryRequest(() => this.client.listLogContext(request));

    const logs: LogEntry[] = (response.logs || []).map((log) => ({
      logTime: (log as any).line_num ?? log.lineNum ?? '',
      content: log.content ?? '',
      labels: log.labels ?? {},
    }));

    return {
      logs,
      // SDK 实际返回纯对象，字段为 snake_case
      total: (response as any).total_count ?? response.totalCount ?? logs.length,
    };
  }

  /** 列出全部日志组 */
  async listGroups(): Promise<GroupInfo[]> {
    const request = new ListLogGroupsRequest();
    const response = await this.retryRequest(() => this.client.listLogGroups(request));
    // SDK 实际返回纯对象，字段为 snake_case（log_groups）
    const groups = ((response as any).log_groups ?? []) as any[];
    return groups.map((g) => ({
      id: g.log_group_id ?? '',
      name: g.log_group_name ?? '',
    }));
  }

  /** 列出日志流，可按日志组名称过滤（API 使用组名而非组 ID） */
  async listStreams(groupName?: string): Promise<StreamInfo[]> {
    const request = new ListLogStreamsRequest('application/json');
    if (groupName) {
      request.withLogGroupName(groupName);
    }
    const response = await this.retryRequest(() => this.client.listLogStreams(request));
    // SDK 实际返回纯对象，字段为 snake_case（log_streams）
    const streams = ((response as any).log_streams ?? []) as any[];
    return streams.map((s) => ({
      id: s.log_stream_id ?? '',
      name: s.log_stream_name ?? '',
      groupId: s.log_group_id,
    }));
  }

  private async retryRequest<T>(
    fn: () => Promise<T>,
    maxRetries = 3
  ): Promise<T> {
    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error as Error;
        const statusCode = error.statusCode || error.httpStatusCode || 0;

        if (statusCode === 401 || statusCode === 403) {
          throw new Error(`Authentication failed (HTTP ${statusCode}). Please check your AK/SK credentials.`);
        }

        if (statusCode === 429) {
          if (attempt < maxRetries) {
            const delay = Math.pow(2, attempt) * 1000;
            await sleep(delay);
            continue;
          }
        }

        if (statusCode >= 500) {
          if (attempt < maxRetries) {
            const delay = Math.pow(2, attempt) * 1000;
            await sleep(delay);
            continue;
          }
        }

        throw error;
      }
    }

    throw lastError ?? new Error('Request failed after retries');
  }
}
