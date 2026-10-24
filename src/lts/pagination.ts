import { LogEntry, QueryParams, QueryResult, SearchType } from '../types';

/**
 * LTS 的翻页语义：服务端没有 offset，只有「从某个 line_num 往某个方向续读」。
 *
 * 第一页不带游标；之后每页把上一页最后一条的 line_num 作为游标，并带上方向。
 * 方向必须和排序方向一致：按时间倒序看就往更早读（backwards），正序就往更晚读
 * （forwards）。方向反了会把刚刚拿到的这一段再拿一遍。
 */

/** 一次取一页。抽成函数类型，便于测试时注入假响应。 */
export type PageFetcher = (params: QueryParams) => Promise<QueryResult>;

export interface FetchAllOptions {
  /** 最多收集多少条。达到上限即停止，并在结果里标记 truncated。默认 10000。 */
  max?: number;
  /** 每页条数。默认取 params.limit，再退到 100。 */
  pageSize?: number;
}

export interface FetchAllResult {
  logs: LogEntry[];
  total: number;
  /** 任何一页报告不完整即置 false。undefined 表示服务端从未报告过。 */
  isQueryComplete?: boolean;
  /** 是否因触达 max 而提前停止（说明后面还有）。 */
  truncated: boolean;
}

/** 倒序（新到旧）→ 往更早读；正序 → 往更晚读。 */
export function cursorDirection(reverse: boolean | undefined): SearchType {
  return reverse ? 'backwards' : 'forwards';
}

/** 游标取本页最后一条的 line_num；拿不到就返回 undefined（调用方据此停止）。 */
export function nextCursor(logs: LogEntry[]): string | undefined {
  if (logs.length === 0) return undefined;
  const last = logs[logs.length - 1].lineNum;
  return last ? last : undefined;
}

export async function fetchAllPages(
  fetchPage: PageFetcher,
  params: QueryParams,
  options: FetchAllOptions = {}
): Promise<FetchAllResult> {
  const max = options.max ?? 10000;
  const pageSize = options.pageSize ?? params.limit ?? 100;
  const direction = cursorDirection(params.reverse);

  const collected: LogEntry[] = [];
  let cursor: string | undefined;
  let isQueryComplete: boolean | undefined;
  let truncated = false;

  while (collected.length < max) {
    const page = await fetchPage({
      ...params,
      limit: pageSize,
      lineNum: cursor,
      searchType: cursor ? direction : undefined,
    });

    if (page.isQueryComplete === false) {
      isQueryComplete = false;
    } else if (isQueryComplete === undefined && page.isQueryComplete === true) {
      isQueryComplete = true;
    }

    if (page.logs.length === 0) break;

    const next = nextCursor(page.logs);
    // 服务端把同一段原样又给了一遍：整页丢弃并停止。
    // 先判游标再入账，否则重放的一页会被当成新数据拼进结果。
    if (cursor !== undefined && next === cursor) break;

    collected.push(...page.logs);

    // 不满一页 = 没有更多了；拿不到游标则无法继续翻页
    if (page.logs.length < pageSize || !next) break;

    cursor = next;
    if (collected.length >= max) {
      truncated = true;
    }
  }

  const logs = collected.slice(0, max);
  return { logs, total: logs.length, isQueryComplete, truncated };
}
