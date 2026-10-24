import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { displayValue, maskSecret, parseAssignment } from '../src/cli/commands/config';

describe('maskSecret', () => {
  test('长密钥只露出首尾两位', () => {
    assert.equal(maskSecret('AKIAIOSFODNN7EXAMPLE'), `AK${'*'.repeat(16)}LE`);
  });

  test('短密钥全部隐去，不泄露长度也不泄露内容', () => {
    assert.equal(maskSecret('abc'), '****');
    assert.equal(maskSecret('abcd'), '****');
  });
});

describe('displayValue', () => {
  test('ak/sk 脱敏，其余原样', () => {
    assert.equal(displayValue('ak', 'AKIAIOSFODNN7EXAMPLE'), `AK${'*'.repeat(16)}LE`);
    assert.equal(displayValue('sk', 'secret-key-value-1234'), `se${'*'.repeat(17)}34`);
    assert.equal(displayValue('region', 'cn-south-1'), 'cn-south-1');
  });
});

describe('parseAssignment', () => {
  test('按第一个等号拆开，值里的等号原样保留', () => {
    assert.deepEqual(parseAssignment('ak=abc=def'), { key: 'ak', value: 'abc=def' });
  });

  test('没有等号或键为空都不合法', () => {
    assert.equal(parseAssignment('endpoint'), undefined);
    assert.equal(parseAssignment('=value'), undefined);
  });

  test('值可以为空（用于清空某项）', () => {
    assert.deepEqual(parseAssignment('streamId='), { key: 'streamId', value: '' });
  });
});
