import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseLimitOption } from '../src/cli/commands/query';
import { MAX_PAGE_SIZE } from '../src/lts/pagination';

describe('parseLimitOption', () => {
  test('合法值原样返回', () => {
    assert.equal(parseLimitOption('100'), 100);
    assert.equal(parseLimitOption('1'), 1);
    assert.equal(parseLimitOption(String(MAX_PAGE_SIZE)), MAX_PAGE_SIZE);
  });

  test('超过服务端上限时报错，而不是把它发给服务端', () => {
    // 实测 limit=5001 → LTS.1903 limit must be between 1 and 5000
    assert.throws(() => parseLimitOption(String(MAX_PAGE_SIZE + 1)), /--limit must be between 1 and 5000/);
  });

  test('0、负数、非数字都报错', () => {
    assert.throws(() => parseLimitOption('0'), /--limit must be between/);
    assert.throws(() => parseLimitOption('-5'), /--limit must be between/);
    assert.throws(() => parseLimitOption('abc'), /--limit must be between/);
  });
});
