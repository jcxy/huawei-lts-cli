import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildQueryExpression, resolveFormat, resolveTimeParams } from '../src/cli/commands/common';

describe('buildQueryExpression', () => {
  test('没有筛选条件时不生成表达式', () => {
    assert.equal(buildQueryExpression({}), undefined);
  });

  test('-q 原样保留', () => {
    assert.equal(buildQueryExpression({ query: 'level:error' }), 'level:error');
  });

  test('每个便捷筛选都写成 field:"value"', () => {
    assert.equal(buildQueryExpression({ app: 'svc-a' }), 'appName:"svc-a"');
    assert.equal(buildQueryExpression({ content: 'timeout' }), 'content:"timeout"');
    assert.equal(buildQueryExpression({ requestId: 'abc-1' }), 'REQUEST_ID:"abc-1"');
  });

  test('值必须带引号，否则含连字符的值会被分词后匹配不到', () => {
    const expr = buildQueryExpression({ requestId: '8f14e45f-ceea-467f-a5d0' });
    assert.match(expr!, /^REQUEST_ID:"[^"]+"$/);
  });

  test('-q 与便捷筛选用 AND 合并，顺序固定', () => {
    const expr = buildQueryExpression({
      query: 'level:error',
      app: 'svc-a',
      content: 'timeout',
      requestId: 'abc',
    });
    assert.equal(
      expr,
      'level:error AND appName:"svc-a" AND content:"timeout" AND REQUEST_ID:"abc"'
    );
  });
});

describe('resolveTimeParams', () => {
  test('相对时长在解析时就算成绝对区间，而不是把 last 传下去', () => {
    // 传 last 下去会让每页重算 Date.now()，窗口向前滑，游标会滑出区间
    const { startTime, endTime } = resolveTimeParams({ last: '2h' });

    assert.match(startTime, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(new Date(endTime).getTime() - new Date(startTime).getTime(), 2 * 60 * 60 * 1000);
  });

  test('--st/--et 被当作开始/结束时间', () => {
    const { startTime, endTime } = resolveTimeParams({
      st: '2026-10-24T06:00:00Z',
      et: '2026-10-24T07:00:00Z',
    });

    assert.equal(startTime, '2026-10-24T06:00:00.000Z');
    assert.equal(endTime, '2026-10-24T07:00:00.000Z');
  });
});

describe('resolveFormat', () => {
  test('三个合法值原样返回', () => {
    assert.equal(resolveFormat('json'), 'json');
    assert.equal(resolveFormat('table'), 'table');
    assert.equal(resolveFormat('pretty'), 'pretty');
  });

  test('非法值回退 pretty，而不是把 undefined 传下去', () => {
    assert.equal(resolveFormat('yaml'), 'pretty');
  });
});
