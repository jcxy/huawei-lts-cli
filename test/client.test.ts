import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { anchorTimeFromLineNum, parseQueryExpression, resolveTimeRange } from '../src/lts/client';
import { QueryParams } from '../src/types';

describe('parseQueryExpression', () => {
  test('普通搜索语句进 keywords', () => {
    assert.deepEqual(parseQueryExpression('level:error'), {
      keywords: 'level:error',
      isAnalysisQuery: false,
    });
  });

  test('管道语法拆成 keywords + query，并打上分析标记', () => {
    const parsed = parseQueryExpression('level:error | SELECT count(*) AS c');
    assert.equal(parsed.keywords, 'level:error');
    assert.equal(parsed.query, 'SELECT count(*) AS c');
    assert.equal(parsed.isAnalysisQuery, true);
  });

  test('管道左侧是 * 时视为不设搜索条件', () => {
    const parsed = parseQueryExpression('* | SELECT count(*) AS c');
    assert.equal(parsed.keywords, undefined);
    assert.equal(parsed.isAnalysisQuery, true);
  });

  test('空管道左侧同样不设搜索条件', () => {
    const parsed = parseQueryExpression('| SELECT count(*) AS c');
    assert.equal(parsed.keywords, undefined);
  });

  test('裸 SELECT 直接作为分析查询', () => {
    const parsed = parseQueryExpression('SELECT count(*) FROM log');
    assert.equal(parsed.keywords, undefined);
    assert.equal(parsed.query, 'SELECT count(*) FROM log');
    assert.equal(parsed.isAnalysisQuery, true);
  });

  test('前后空白被裁掉', () => {
    assert.equal(parseQueryExpression('  level:error  ').keywords, 'level:error');
  });
});

describe('anchorTimeFromLineNum', () => {
  test('line_num 是纳秒时间戳，前 13 位就是毫秒', () => {
    // 实测：line_num 1792821600011000000 ↔ 2026-10-24T06:00:00.011Z
    assert.equal(anchorTimeFromLineNum('1792821600011000000'), '1792821600011');
  });

  test('不是 19 位数字就不猜，交给调用方报错', () => {
    assert.equal(anchorTimeFromLineNum(''), undefined);
    assert.equal(anchorTimeFromLineNum('12345'), undefined);
    assert.equal(anchorTimeFromLineNum('179282160001100000a'), undefined);
  });
});

describe('resolveTimeRange', () => {
  const base = { groupId: 'g', streamId: 's' };

  test('相对时间范围换算成毫秒区间', () => {
    const before = Date.now();
    const { startMs, endMs } = resolveTimeRange({ ...base, last: '2h' } as QueryParams);

    assert.equal(endMs - startMs, 2 * 60 * 60 * 1000);
    assert.ok(endMs >= before);
  });

  test('支持 m/h/d 三种单位', () => {
    for (const [last, unitMs] of [
      ['30m', 30 * 60 * 1000],
      ['3h', 3 * 60 * 60 * 1000],
      ['7d', 7 * 24 * 60 * 60 * 1000],
    ] as const) {
      const { startMs, endMs } = resolveTimeRange({ ...base, last });
      assert.equal(endMs - startMs, unitMs);
    }
  });

  test('非法 --last 明确报错，而不是静默换成默认值', () => {
    assert.throws(() => resolveTimeRange({ ...base, last: '2 hours' }), /Invalid --last duration/);
  });

  test('ISO 时间区间原样解析', () => {
    const { startMs, endMs } = resolveTimeRange({
      ...base,
      startTime: '2024-01-01T00:00:00Z',
      endTime: '2024-01-02T00:00:00Z',
    });
    assert.equal(endMs - startMs, 24 * 60 * 60 * 1000);
  });

  test('既没有 --last 也没有完整区间时报错', () => {
    assert.throws(() => resolveTimeRange(base as QueryParams), /Time range required/);
  });

  test('时间格式非法时报错', () => {
    assert.throws(
      () => resolveTimeRange({ ...base, startTime: 'not-a-date', endTime: 'also-bad' }),
      /Invalid time format/
    );
  });
});
