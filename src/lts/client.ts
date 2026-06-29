import { LtsClient } from '@huaweicloud/huaweicloud-sdk-lts/v2/LtsClient';
import { ClientBuilder } from '@huaweicloud/huaweicloud-sdk-core/ClientBuilder';
import { BasicCredentials } from '@huaweicloud/huaweicloud-sdk-core/auth/BasicCredentials';
import { Region } from '@huaweicloud/huaweicloud-sdk-core/region/region';
import { ListLogsRequest } from '@huaweicloud/huaweicloud-sdk-lts/v2/model/ListLogsRequest';
import { QueryLtsLogParams } from '@huaweicloud/huaweicloud-sdk-lts/v2/model/QueryLtsLogParams';
import { LTSConfig, QueryParams, QueryResult, LogEntry } from '../types';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    const queryParams = new QueryLtsLogParams()
      .withStartTime(new Date(params.startTime).getTime().toString())
      .withEndTime(new Date(params.endTime).getTime().toString())
      .withLimit(params.limit ?? 100);

    // 优先使用 query 参数（支持SQL和结构化查询）
    if (params.query) {
      queryParams.withQuery(params.query);
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

    const logs: LogEntry[] = (response.logs || []).map((log) => ({
      logTime: log.lineNum ?? '',
      content: log.content ?? '',
      labels: log.labels ?? {},
    }));

    return {
      logs,
      total: response.count ?? logs.length,
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
