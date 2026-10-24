import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { fetchAllPages, cursorDirection, nextCursor } from '../src/lts/pagination';
import { LogEntry, QueryParams, QueryResult } from '../src/types';

function log(lineNum: string): LogEntry {
  return { lineNum, content: `c${lineNum}`, labels: {} };
}

function page(lineNums: string[], extra: Partial<QueryResult> = {}): QueryResult {
  return { logs: lineNums.map(log), total: lineNums.length, ...extra };
}

const baseParams: QueryParams = {
  groupId: 'g',
  streamId: 's',
  last: '2h',
  reverse: false,
};

/**
 * 假客户端：每次请求按游标返回不同的页，并记录收到的参数。
 * 这样才测得到「游标有没有真的推进」，这正是原实现最致命的地方。
 */
function fakeFetcher(pages: string[][], extra: Partial<QueryResult> = {}) {
  const calls: QueryParams[] = [];
  let i = 0;
  const fetcher = async (params: QueryParams): Promise<QueryResult> => {
    calls.push(params);
    const p = pages[i] ?? [];
    i += 1;
    return page(p, extra);
  };
  return { fetcher, calls };
}

describe('cursorDirection', () => {
  test('倒序往更早读，正序往更晚读', () => {
    assert.equal(cursorDirection(true), 'backwards');
    assert.equal(cursorDirection(false), 'forwards');
    assert.equal(cursorDirection(undefined), 'forwards');
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

describe('fetchAllPages', () => {
  test('首页不带游标，后续页带上上一页末条的 line_num', async () => {
    const { fetcher, calls } = fakeFetcher([['1', '2'], ['3', '4']]);

    await fetchAllPages(fetcher, baseParams, { pageSize: 2 });

    // 第 3 次是末尾探测：游标模型下只能用空页确认到底了
    assert.equal(calls.length, 3);
    assert.equal(calls[0].lineNum, undefined);
    assert.equal(calls[0].searchType, undefined);
    assert.equal(calls[1].lineNum, '2');
    assert.equal(calls[2].lineNum, '4');
  });

  test('游标方向跟随排序方向，反了会重放同一段', async () => {
    const asc = fakeFetcher([['1', '2'], ['3', '4']]);
    await fetchAllPages(asc.fetcher, { ...baseParams, reverse: false }, { pageSize: 2 });
    assert.equal(asc.calls[1].searchType, 'forwards');

    const desc = fakeFetcher([['9', '8'], ['7', '6']]);
    await fetchAllPages(desc.fetcher, { ...baseParams, reverse: true }, { pageSize: 2 });
    assert.equal(desc.calls[1].searchType, 'backwards');
    assert.equal(desc.calls[1].lineNum, '8');
  });

  test('收满最后一页即停，不重复、不多请求', async () => {
    // 3 页整页 + 1 个不满页
    const { fetcher, calls } = fakeFetcher([['1', '2'], ['3', '4'], ['5', '6'], ['7']]);

    const result = await fetchAllPages(fetcher, baseParams, { pageSize: 2, max: 100 });

    assert.deepEqual(
      result.logs.map((l) => l.lineNum),
      ['1', '2', '3', '4', '5', '6', '7']
    );
    assert.equal(new Set(result.logs.map((l) => l.lineNum)).size, 7, '不应有重复行');
    assert.equal(calls.length, 4);
    assert.equal(result.truncated, false);
  });

  test('触达 max 时连服务端分页都不再请求', async () => {
    const { fetcher, calls } = fakeFetcher([['1', '2'], ['3', '4'], ['5', '6']]);

    const result = await fetchAllPages(fetcher, baseParams, { pageSize: 2, max: 4 });

    assert.deepEqual(result.logs.map((l) => l.lineNum), ['1', '2', '3', '4']);
    assert.equal(calls.length, 2);
    assert.equal(result.truncated, true);
  });

  test('游标不前进就停，重放的一页不会被拼进结果', async () => {
    // 服务端反复返回同样的 line_num
    const { fetcher, calls } = fakeFetcher([['1', '5'], ['1', '5'], ['1', '5']]);

    const result = await fetchAllPages(fetcher, baseParams, { pageSize: 2, max: 1000 });

    assert.equal(calls.length, 2);
    assert.deepEqual(result.logs.map((l) => l.lineNum), ['1', '5']);
  });

  test('空页即终止', async () => {
    const { fetcher, calls } = fakeFetcher([[]]);

    const result = await fetchAllPages(fetcher, baseParams, { pageSize: 10 });

    assert.equal(result.logs.length, 0);
    assert.equal(calls.length, 1);
  });

  test('任何一页报告不完整，结果都标记为不完整', async () => {
    const { fetcher } = fakeFetcher([['1', '2']], { isQueryComplete: false });

    const result = await fetchAllPages(fetcher, baseParams, { pageSize: 2 });

    assert.equal(result.isQueryComplete, false);
  });

  test('服务端从未报告时保持 undefined，不能被当成 false', async () => {
    const { fetcher } = fakeFetcher([['1']]);

    const result = await fetchAllPages(fetcher, baseParams, { pageSize: 10 });

    assert.equal(result.isQueryComplete, undefined);
  });

  test('pageSize 默认取 params.limit', async () => {
    const { fetcher, calls } = fakeFetcher([['1']]);

    await fetchAllPages(fetcher, { ...baseParams, limit: 37 });

    assert.equal(calls[0].limit, 37);
  });
});
