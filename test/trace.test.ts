import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildTraceExpression, traceCandidateFields } from '../src/cli/commands/trace';
import { StreamIndex } from '../src/types';

function index(fields: string[], fullTextEnabled: boolean): StreamIndex {
  return {
    streamId: 's',
    fullText: { enabled: fullTextEnabled },
    fields: fields.map((name) => ({ name, type: 'string' })),
  };
}

describe('traceCandidateFields', () => {
  test('挑出形如 request/trace/span + id 的字段', () => {
    const fields = traceCandidateFields(
      index(['appName', 'REQUEST_ID', 'trace_id', 'span-id', 'X-TX-XID'], false)
    );
    // X-TX-XID 不以 id 结尾，不当成链路 ID 字段
    assert.deepEqual(fields, ['REQUEST_ID', 'trace_id']);
  });

  test('开了全文索引时用 content 兜底，否则会漏掉只打在正文里的 ID', () => {
    assert.deepEqual(traceCandidateFields(index(['REQUEST_ID'], true)), ['REQUEST_ID', 'content']);
  });

  test('没有 ID 字段时 content 是唯一手段', () => {
    assert.deepEqual(traceCandidateFields(index(['appName'], true)), ['content']);
    // 全文索引没开也退到 content：否则一条也不会有
    assert.deepEqual(traceCandidateFields(index(['appName'], false)), ['content']);
  });

  test('非法字段名不进查询语句', () => {
    // 连字符会被当成运算符，查询直接报错
    assert.deepEqual(traceCandidateFields(index(['request-id'], false)), ['content']);
  });
});

describe('buildTraceExpression', () => {
  test('每个字段都加引号，用 OR 连起来', () => {
    assert.equal(
      buildTraceExpression(['REQUEST_ID', 'trace_id'], '8f14e45f-ceea'),
      'REQUEST_ID:"8f14e45f-ceea" OR trace_id:"8f14e45f-ceea"'
    );
  });

  test('单个字段不加括号也不加多余的 OR', () => {
    assert.equal(buildTraceExpression(['content'], 'abc'), 'content:"abc"');
  });
});
