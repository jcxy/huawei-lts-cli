import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildQueryExpression, resolveFormat } from '../src/cli/commands/common';

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
