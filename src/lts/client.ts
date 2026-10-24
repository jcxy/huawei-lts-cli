import * as path from 'path';
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
import { ListLogStreamIndexRequest } from '@huaweicloud/huaweicloud-sdk-lts/v2/model/ListLogStreamIndexRequest';
import {
  LTSConfig,
  QueryParams,
  QueryResult,
  LogEntry,
  ContextParams,
  GroupInfo,
  StreamInfo,
  StreamIndex,
} from '../types';
import { CONTINUE_SEARCH_TYPE } from './pagination';

/**
 * 华为云 SDK 把 log4js 的 console appender 指向 stdout，任何 API 错误都会把整个
 * axios 错误对象（含 Authorization 头）倒进 stdout——`-f json` 的输出因此变成
 * 不可解析的混合体。这里把 SDK 日志改道 stderr 并默认关闭：CLI 自己会打印
 * 一行可读的错误，6KB 的 axios dump 只会淹没它。要排查 SDK 层问题时设
 * LTS_CLI_DEBUG=1。
 *
 * 解析到的必须是 SDK 自己那个 log4js 实例，否则 configure 改的是另一份模块状态。
 * 拿不到就保持原状：日志难看，但不影响结果本身。
 */
function configureSdkLogger(): void {
  try {
    const corePkg = require.resolve('@huaweicloud/huaweicloud-sdk-core/package.json');
    const log4js = require(require.resolve('log4js', { paths: [path.dirname(corePkg)] }));
    log4js.configure({
      appenders: { sdkStderr: { type: 'stderr' } },
      categories: {
        default: { appenders: ['sdkStderr'], level: process.env.LTS_CLI_DEBUG ? 'all' : 'off' },
      },
    });
  } catch {
    /* 无法改道时不做任何事 */
  }
}

configureSdkLogger();

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
export function resolveTimeRange(
  params: Pick<QueryParams, 'startTime' | 'endTime' | 'last'>
): { startMs: number; endMs: number } {
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
 *
 * 导出仅为测试：这一段决定了用户写的字符串怎么落到 keywords/query 两个字段上，
 * 拆错了就会静默返回全量日志。
 */
export function parseQueryExpression(expr: string): ParsedQueryExpression {
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

/**
 * line_num 是 19 位纳秒时间戳，前 13 位就是毫秒（实测与日志时间严格对齐）。
 * `context` 接口要求传毫秒时间戳，而 LTS 的日志记录本身不带时间字段，只能从
 * line_num 推。格式不符时返回 undefined，让调用方要求显式 --time。
 */
export function anchorTimeFromLineNum(lineNum: string): string | undefined {
  return /^\d{19}$/.test(lineNum) ? lineNum.slice(0, 13) : undefined;
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
    }

    if (params.reverse !== undefined) {
      queryParams.withIsDesc(params.reverse);
    }

    // 游标翻页：首屏不带游标，后续页把上一页末条的 line_num 当作续读起点
    if (params.lineNum) {
      queryParams.withLineNum(params.lineNum);
      queryParams.withSearchType(params.searchType ?? CONTINUE_SEARCH_TYPE);
    }

    const request = new ListLogsRequest(params.groupId, params.streamId, 'application/json')
      .withBody(queryParams);

    const response = await this.retryRequest(() => this.client.listLogs(request));
    const raw = response as any;

    // SQL 分析查询：结果在 analysisLogs 中（行为 JSON 对象，没有 line_num，无法游标翻页）
    if (Array.isArray(raw.analysisLogs)) {
      const logs: LogEntry[] = raw.analysisLogs.map((row: any) => ({
        lineNum: '',
        content: JSON.stringify(row),
        labels: {},
      }));
      return { logs, total: logs.length, isQueryComplete: raw.isQueryComplete };
    }

    const logs: LogEntry[] = (response.logs || []).map((log) => ({
      lineNum: (log as any).line_num ?? log.lineNum ?? '',
      content: stripHighlightTags(log.content ?? ''),
      labels: Object.fromEntries(
        Object.entries(log.labels ?? {}).map(([k, v]) => [k, stripHighlightTags(v)])
      ),
    }));

    return {
      logs,
      total: response.count ?? logs.length,
      // 服务端报告结果被截断时必须传出去，否则 AI 会拿着残缺数据下结论
      isQueryComplete: raw.isQueryComplete,
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
      lineNum: (log as any).line_num ?? log.lineNum ?? '',
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

  /** 读取日志流的索引配置（全文索引 + 字段索引），供 `fields` 命令与 AI 运行时发现 */
  async getStreamIndex(groupId: string, streamId: string): Promise<StreamIndex> {
    const request = new ListLogStreamIndexRequest(groupId, streamId, 'application/json');
    const response = await this.retryRequest(() => this.client.listLogStreamIndex(request));
    const raw = response as any;

    // SDK 在不同版本下可能给出 class 实例（camelCase）或纯对象（snake_case），两者都认
    const fullText = raw.fullTextIndex ?? raw.full_text_index ?? {};
    const fields = (raw.fields ?? []) as any[];

    return {
      streamId: raw.logStreamId ?? raw.log_stream_id ?? streamId,
      fullText: {
        enabled: fullText.enable === true,
        caseSensitive: fullText.caseSensitive ?? fullText.case_sensitive,
        includeChinese: fullText.includeChinese ?? fullText.include_chinese,
        tokenizer: fullText.tokenizer,
      },
      fields: fields.map((f) => ({
        name: f.fieldName ?? f.field_name ?? '',
        type: f.fieldType ?? f.field_type ?? '',
        caseSensitive: f.caseSensitive ?? f.case_sensitive,
        includeChinese: f.includeChinese ?? f.include_chinese,
        tokenizer: f.tokenizer,
        quickAnalysis: f.quickAnalysis ?? f.quick_analysis,
      })),
    };
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
