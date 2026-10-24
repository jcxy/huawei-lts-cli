import { LogEntry, QueryParams, QueryResult, SearchType } from '../types';

/**
 * LTS 的翻页语义：服务端没有 offset，只有「从某个 line_num 继续读」。
 *
 * 第一页不带游标；之后每页把上一页最后一条的 line_num 作为续读起点。
 *
 * 续读方向只有一种：`forwards`，它表示「沿当前排序方向继续」，与 `is_desc` 无关。
 * 实测（2026-10，cn-south-1）降序查询配 `backwards` 时，第二页与第一页的 line_num
 * 重叠 38%~100%：正序配 backwards 更直接，返回的就是第一页那一段。而且全程不报
 * 错。所以这里不再按排序方向推方向——反了会静默产出重复数据，比报错难查得多。
 * 对照：无论升降序，`forwards` 连翻 10 页、每页 100 条，边界重叠为 0。
 */

/** 续读游标时唯一正确的 search_type。 */
export const CONTINUE_SEARCH_TYPE: SearchType = 'forwards';

/** 服务端单页上限：limit=5001 直接回 LTS.1903 "limit must be between 1 and 5000"。 */
export const MAX_PAGE_SIZE = 5000;

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
  // 每页条数不能超过服务端上限，否则整次 --all 直接报错
  const pageSize = Math.min(options.pageSize ?? params.limit ?? 100, MAX_PAGE_SIZE);

  const collected: LogEntry[] = [];
  let cursor: string | undefined;
  let isQueryComplete: boolean | undefined;
  let truncated = false;

  while (collected.length < max) {
    const page = await fetchPage({
      ...params,
      limit: pageSize,
      lineNum: cursor,
      searchType: cursor ? CONTINUE_SEARCH_TYPE : undefined,
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
