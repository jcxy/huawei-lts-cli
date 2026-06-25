/**
 * 华为云LTS API 请求和响应类型定义
 */

export interface LtsQueryRequest {
  start_time: string;
  end_time: string;
  keyword?: string;
  line_num?: string;
  offset?: number;
  reverse?: boolean;
}

export interface LtsQueryResponse {
  count?: number;
  logs?: Array<{
    content?: string;
    line_num?: string;
    labels?: Record<string, string>;
  }>;
  isQueryComplete?: boolean;
}
