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
 *
 * 游标是排他的：从 line_num=L 续读只会返回严格在 L 之后的记录。但 line_num 在
 * 纳秒级并不唯一——同一纳秒的多条日志共用一个值，一组日志正好被页边界切开时，
 * 后半组会被整组跳过（实测：单页查得到 18 条，--all 只拿到 17 条）。所以续读
 * 游标取 L 的前一格（正序 L-1、降序 L+1），让下一页从这一组的组头开始读，再按
 * 「line_num + 内容 + labels」跳过本页已经收走的那几条。line_num 不唯一，不能
 * 只按它去重，否则会把同纳秒的真实日志一起丢掉。
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
  /** 是否因触达 max（或同纳秒日志多到无法推进）而提前停止，说明后面还有。 */
  truncated: boolean;
}

/** 游标取本页最后一条的 line_num；拿不到就返回 undefined（调用方据此停止）。 */
export function nextCursor(logs: LogEntry[]): string | undefined {
  if (logs.length === 0) return undefined;
  const last = logs[logs.length - 1].lineNum;
  return last ? last : undefined;
}

/** line_num 是纳秒整数；游标前后挪一格，才能把被页边界切开的同值组重新纳入。 */
export function shiftLineNum(lineNum: string, delta: 1n | -1n): string | undefined {
  if (!/^\d+$/.test(lineNum)) return undefined;
  return (BigInt(lineNum) + delta).toString();
}

/** line_num 不唯一，同纳秒同内容也可能是两条真实日志；回放判定要带上内容与 labels。 */
function entrySignature(entry: LogEntry): string {
  const labels = Object.keys(entry.labels)
    .sort()
    .map((key) => `${key}=${entry.labels[key]}`)
    .join('\u0001');
  return `${entry.content}\u0000${labels}`;
}

/** 统计某一 line_num 组内各签名的条数，下一页据此跳过回放。 */
function countSignatures(entries: LogEntry[], lineNum: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    if (entry.lineNum !== lineNum) continue;
    const signature = entrySignature(entry);
    counts.set(signature, (counts.get(signature) ?? 0) + 1);
  }
  return counts;
}

function mergeCounts(into: Map<string, number>, extra: Map<string, number>): Map<string, number> {
  for (const [signature, count] of extra) {
    into.set(signature, (into.get(signature) ?? 0) + count);
  }
  return into;
}

export async function fetchAllPages(
  fetchPage: PageFetcher,
  params: QueryParams,
  options: FetchAllOptions = {}
): Promise<FetchAllResult> {
  const max = options.max ?? 10000;
  // 每页条数不能超过服务端上限，否则整次 --all 直接报错
  const basePageSize = Math.min(options.pageSize ?? params.limit ?? 100, MAX_PAGE_SIZE);
  // forwards 沿当前排序方向推进：正序越来越晚（-1），降序越来越早（+1）
  const step: 1n | -1n = params.reverse === true ? 1n : -1n;

  const collected: LogEntry[] = [];
  let cursor: string | undefined;
  // 上一页末条所在的 line_num 组；下一页从该组组头重读，组内已收走的条目按签名跳过
  let boundaryLineNum: string | undefined;
  let boundaryCounts = new Map<string, number>();
  let isQueryComplete: boolean | undefined;
  let truncated = false;

  while (collected.length < max) {
    // 重读组头会带回已收走的同值组；多要这么多条，保证每页仍有 pageSize 条新数据
    const boundarySize = [...boundaryCounts.values()].reduce((sum, count) => sum + count, 0);
    let pageSize = Math.min(basePageSize + boundarySize, MAX_PAGE_SIZE);
    let pageLength = 0;
    let fresh: LogEntry[] = [];
    let reachedEnd = false;

    // 同纳秒的日志多到一页装不下时，重读组头永远只能拿到前 pageSize 条；
    // 放大一页才可能越过这一组。
    while (true) {
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

      pageLength = page.logs.length;
      if (pageLength === 0) {
        reachedEnd = true;
        break;
      }

      const pending = new Map(boundaryCounts);
      fresh = [];
      for (const entry of page.logs) {
        if (boundaryLineNum !== undefined && entry.lineNum === boundaryLineNum) {
          const signature = entrySignature(entry);
          const remaining = pending.get(signature) ?? 0;
          if (remaining > 0) {
            pending.set(signature, remaining - 1);
            continue;
          }
        }
        fresh.push(entry);
      }

      if (fresh.length > 0) break;
      // 不满一页且全是回放 = 同值组之后再无日志，已经到底
      if (pageLength < pageSize) {
        reachedEnd = true;
        break;
      }
      if (pageSize >= MAX_PAGE_SIZE) {
        truncated = true;
        reachedEnd = true;
        break;
      }
      pageSize = Math.min(pageSize * 2, MAX_PAGE_SIZE);
    }

    if (reachedEnd) break;

    collected.push(...fresh);

    const lastLineNum = fresh[fresh.length - 1]?.lineNum;
    // 不满一页 = 没有更多了；游标推不动则无法继续翻页
    const next = lastLineNum ? shiftLineNum(lastLineNum, step) : undefined;
    if (pageLength < pageSize || !next) break;

    cursor = next;
    // 同值组可能横跨多页：计数必须累计，否则重读组头时会把前几页收走的条目再收一遍
    boundaryCounts =
      lastLineNum === boundaryLineNum
        ? mergeCounts(boundaryCounts, countSignatures(fresh, lastLineNum))
        : countSignatures(fresh, lastLineNum);
    boundaryLineNum = lastLineNum;

    if (collected.length >= max) {
      truncated = true;
    }
  }

  const logs = collected.slice(0, max);
  return { logs, total: logs.length, isQueryComplete, truncated };
}
