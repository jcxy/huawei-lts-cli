import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchAllPages,
  nextCursor,
  shiftLineNum,
  CONTINUE_SEARCH_TYPE,
  MAX_PAGE_SIZE,
} from '../src/lts/pagination';
import { LogEntry, QueryParams, QueryResult } from '../src/types';

function log(lineNum: string, content = `c${lineNum}`): LogEntry {
  return { lineNum, content, labels: {} };
}

function page(entries: LogEntry[], extra: Partial<QueryResult> = {}): QueryResult {
  return { logs: entries, total: entries.length, ...extra };
}

const baseParams: QueryParams = {
  groupId: 'g',
  streamId: 's',
  last: '2h',
  reverse: false,
};

/**
 * 模拟 LTS 的游标语义：游标排他，只返回严格越过游标方向的记录；
 * 同一 line_num 的多条日志按写入顺序排列。游标是 L±1 时，整组同值日志都会回来。
 */
function simulateServer(all: LogEntry[], reverse = false) {
  const ordered = [...all].sort((a, b) => {
    const left = BigInt(a.lineNum);
    const right = BigInt(b.lineNum);
    return left < right ? -1 : left > right ? 1 : 0;
  });
  const display = reverse ? ordered.slice().reverse() : ordered;
  const calls: QueryParams[] = [];

  const fetcher = async (params: QueryParams): Promise<QueryResult> => {
    calls.push(params);
    const cursor = params.lineNum;
    const filtered =
      cursor === undefined
        ? display
        : display.filter((entry) =>
            reverse ? BigInt(entry.lineNum) < BigInt(cursor) : BigInt(entry.lineNum) > BigInt(cursor)
          );
    const logs = filtered.slice(0, params.limit ?? 100);
    return page(logs);
  };

  return { fetcher, calls };
}

function lineNums(result: { logs: LogEntry[] }): string[] {
  return result.logs.map((entry) => entry.lineNum);
}

describe('CONTINUE_SEARCH_TYPE', () => {
  test('续读用 forwards，而不是按排序方向猜', () => {
    // 实测：降序配 backwards 会把上一页那一段再给一遍（第二页与第一页 line_num 重叠
    // 38%~100%），且不报错；forwards 连翻 10 页边界重叠为 0。
    assert.equal(CONTINUE_SEARCH_TYPE, 'forwards');
  });
});

describe('nextCursor', () => {
  test('取本页最后一条的 line_num', () => {
    assert.equal(nextCursor([log('1'), log('2'), log('3')]), '3');
  });

  test('空页没有游标', () => {
    assert.equal(nextCursor([]), undefined);
  });

  test('line_num 为空时不给游标，否则会在同一个位置上原地重放', () => {
    assert.equal(nextCursor([log('1'), log('')]), undefined);
  });
});

describe('shiftLineNum', () => {
  test('纳秒整数前后挪一格', () => {
    assert.equal(shiftLineNum('1793063126155000000', -1n), '1793063126154999999');
    assert.equal(shiftLineNum('1793063126155000000', 1n), '1793063126155000001');
    assert.equal(shiftLineNum('10', -1n), '9');
  });

  test('非纯数字无法挪动，返回 undefined 让翻页停下', () => {
    assert.equal(shiftLineNum('', -1n), undefined);
    assert.equal(shiftLineNum('abc', -1n), undefined);
    assert.equal(shiftLineNum('-3', 1n), undefined);
  });
});

describe('fetchAllPages', () => {
  test('首页不带游标，后续页从末条的前一格续读', async () => {
    const { fetcher, calls } = simulateServer([log('1'), log('2'), log('3'), log('4')]);

    const result = await fetchAllPages(fetcher, baseParams, { pageSize: 2 });

    assert.deepEqual(lineNums(result), ['1', '2', '3', '4']);
    assert.equal(calls[0].lineNum, undefined);
    assert.equal(calls[0].searchType, undefined);
    // 2 的前一格是 1：同纳秒组被切开时也不会漏
    assert.equal(calls[1].lineNum, '1');
    assert.equal(calls[1].searchType, 'forwards');
  });

  test('无论升序降序，续读都是 forwards', async () => {
    const asc = simulateServer([log('1'), log('2'), log('3'), log('4')], false);
    await fetchAllPages(asc.fetcher, { ...baseParams, reverse: false }, { pageSize: 2 });
    assert.equal(asc.calls[1].searchType, 'forwards');

    const desc = simulateServer([log('1'), log('2'), log('3'), log('4')], true);
    await fetchAllPages(desc.fetcher, { ...baseParams, reverse: true }, { pageSize: 2 });
    assert.equal(desc.calls[1].searchType, 'forwards');
    // 降序往更早读，游标取末条的后一格
    assert.equal(desc.calls[1].lineNum, '4');
  });

  test('收满最后一页即停，不重复、不多请求', async () => {
    const all = ['1', '2', '3', '4', '5', '6', '7'].map((n) => log(n));
    const { fetcher } = simulateServer(all);

    const result = await fetchAllPages(fetcher, baseParams, { pageSize: 2, max: 100 });

    assert.deepEqual(lineNums(result), ['1', '2', '3', '4', '5', '6', '7']);
    assert.equal(result.truncated, false);
  });

  test('同纳秒的一组日志正好被页边界切开时，后半组不会丢', async () => {
    // 实测缺陷：单页查得到 18 条，--all 只拿到 17 条，漏的正是同 line_num 的兄弟记录
    const all = [
      log('1'),
      log('2'),
      log('3'),
      log('4', 'first-at-4'),
      log('4', 'second-at-4'),
      log('5'),
    ];

    const { fetcher } = simulateServer(all);
    const result = await fetchAllPages(fetcher, baseParams, { pageSize: 2, max: 100 });

    assert.deepEqual(lineNums(result), ['1', '2', '3', '4', '4', '5']);
    assert.deepEqual(
      result.logs.map((entry) => entry.content),
      ['c1', 'c2', 'c3', 'first-at-4', 'second-at-4', 'c5']
    );
  });

  test('降序翻页同样补齐被切开的同纳秒组', async () => {
    const all = [
      log('1'),
      log('2'),
      log('3'),
      log('4', 'first-at-4'),
      log('4', 'second-at-4'),
      log('5'),
    ];

    const { fetcher } = simulateServer(all, true);
    const result = await fetchAllPages(fetcher, { ...baseParams, reverse: true }, { pageSize: 2, max: 100 });

    assert.deepEqual(lineNums(result), ['5', '4', '4', '3', '2', '1']);
    assert.deepEqual(
      result.logs.map((entry) => entry.content).sort(),
      ['c1', 'c2', 'c3', 'c5', 'first-at-4', 'second-at-4'].sort()
    );
  });

  test('同纳秒同内容的真实重复日志按条数保留，不会被当成回放丢掉', async () => {
    const all = [log('1'), log('2'), log('4', 'same'), log('4', 'same'), log('5')];

    const { fetcher } = simulateServer(all);
    const result = await fetchAllPages(fetcher, baseParams, { pageSize: 2, max: 100 });

    assert.deepEqual(lineNums(result), ['1', '2', '4', '4', '5']);
    assert.equal(result.logs.filter((entry) => entry.lineNum === '4').length, 2);
  });

  test('触达 max 时连服务端分页都不再请求', async () => {
    const all = ['1', '2', '3', '4', '5', '6'].map((n) => log(n));
    const { fetcher, calls } = simulateServer(all);

    const result = await fetchAllPages(fetcher, baseParams, { pageSize: 2, max: 4 });

    assert.deepEqual(lineNums(result), ['1', '2', '3', '4']);
    assert.equal(calls.length, 2);
    assert.equal(result.truncated, true);
  });

  test('服务端原地重放同一页时停下，不会无限翻页', async () => {
    const calls: QueryParams[] = [];
    const fetcher = async (params: QueryParams): Promise<QueryResult> => {
      calls.push(params);
      return page([log('5')]);
    };

    const result = await fetchAllPages(fetcher, baseParams, { pageSize: 2, max: 1000 });

    assert.deepEqual(lineNums(result), ['5']);
    assert.equal(result.truncated, false);
    assert.ok(calls.length < 20, `expected a bounded number of calls, got ${calls.length}`);
  });

  test('空页即终止', async () => {
    const { fetcher, calls } = simulateServer([]);

    const result = await fetchAllPages(fetcher, baseParams, { pageSize: 10 });

    assert.equal(result.logs.length, 0);
    assert.equal(calls.length, 1);
  });

  test('任何一页报告不完整，结果都标记为不完整', async () => {
    const fetcher = async (): Promise<QueryResult> => page([log('1'), log('2')], { isQueryComplete: false });

    const result = await fetchAllPages(fetcher, baseParams, { pageSize: 2 });

    assert.equal(result.isQueryComplete, false);
  });

  test('服务端从未报告时保持 undefined，不能被当成 false', async () => {
    const fetcher = async (): Promise<QueryResult> => page([log('1')]);

    const result = await fetchAllPages(fetcher, baseParams, { pageSize: 10 });

    assert.equal(result.isQueryComplete, undefined);
  });

  test('pageSize 默认取 params.limit', async () => {
    const { fetcher, calls } = simulateServer([log('1')]);

    await fetchAllPages(fetcher, { ...baseParams, limit: 37 });

    assert.equal(calls[0].limit, 37);
  });

  test('pageSize 被服务端上限封顶，否则整次翻页直接报错', async () => {
    const { fetcher, calls } = simulateServer([log('1')]);

    await fetchAllPages(fetcher, baseParams, { pageSize: 50000 });

    assert.equal(calls[0].limit, MAX_PAGE_SIZE);
    assert.equal(MAX_PAGE_SIZE, 5000);
  });
});
