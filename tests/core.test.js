import test from 'node:test'
import assert from 'node:assert/strict'
import { enc, dec, remap, tobin } from '../src/core.js'
import { encode, decode, validate, weights, bits, cleanWhitespace } from '../src/protocol.js'

test('固定 remap 协议向量，独立于往返断言', () => {
  assert.equal(enc('A'), '\u2800\u2882')
  assert.equal(enc('中'), '\u283A\u289C')
  assert.equal(enc('😀'), '\u284B\u28DC\u287B\u2800')
  assert.equal(enc('eoiles'), '\u2800\u2896\u2800\u28BE\u2800\u288E\u2800\u281E\u2800\u2896\u2800\u28E6')
})

test('所有 256 字节的正向排列、逆变换和独立点位掩码', () => {
  for (let n = 0; n < 256; n++) {
    const forward = remap(tobin(n, 8), '73654210')
    assert.equal(parseInt(remap(forward, '76514320'), 2), n)
    // 独立公式：输入最高位应在 Unicode 点1，依次点2、3、7、4、5、6、8。
    const expected = ((n & 128) >> 7) | ((n & 64) >> 5) | ((n & 32) >> 3) | ((n & 16) << 2) | (n & 8) | ((n & 4) << 2) | ((n & 2) << 4) | ((n & 1) << 7)
    assert.equal(parseInt(forward, 2), expected, `byte ${n}`)
    assert.equal(enc(String.fromCharCode(n)), '\u2800' + String.fromCharCode(10240 + expected))
    assert.equal(dec(String.fromCharCode(10240 + expected, 10240)), String.fromCharCode(n * 256))
  }
})

test('八个单一置位字节的真实左列/右列坐标', () => {
  const masks = [1, 2, 4, 64, 8, 16, 32, 128]
  assert.deepEqual(weights, masks)
  for (let index = 0; index < 8; index++) {
    const byte = 128 >> index, glyph = enc(String.fromCharCode(byte))[1]
    assert.equal(glyph.charCodeAt(0) - 10240, masks[index])
    assert.deepEqual(bits(glyph), Array.from({ length: 8 }, (_, k) => +(k === index)))
    assert.deepEqual([Math.floor(index / 4), index % 4], [[0,0],[0,1],[0,2],[0,3],[1,0],[1,1],[1,2],[1,3]][index])
  }
})

test('原生格式的独立历史向量与所有字节', () => {
  assert.equal(encode('A', 'native'), '\u2800\u2841')
  assert.equal(encode('中', 'native'), '\u284E\u282D')
  assert.equal(encode('😀', 'native'), '\u28D8\u283D\u28DE\u2800')
  for (let n = 0; n < 256; n++) {
    assert.equal(encode(String.fromCharCode(n), 'native'), String.fromCharCode(10240, 10240 + n))
    assert.equal(decode(String.fromCharCode(10240, 10240 + n), 'native'), String.fromCharCode(n))
  }
})

for (const format of ['remap', 'native']) {
  for (const input of ['', ' ', '  leading and trailing  ', '\tfoo\t', '\n', '\r\n', 'a\r\nb\nc\rd', '中英 A😀', 'e\u0301', 'é', '👩‍💻👨‍👩‍👧‍👦', '\u0000x\u0000', '\u2800A\u2800', '\uD800', '\uDC00', '\uFEFF\u200D\uFE0F']) {
    test(`${format} 完整保留序列 ${JSON.stringify(input)}`, () => {
      const code = encode(input, format)
      assert.equal(code.length, input.length * 2)
      assert.equal(validate(code), null)
      assert.equal(decode(code, format), input)
    })
  }
}

test('不规范化组合字符', () => assert.notEqual(enc('e\u0301'), enc('é')))
test('空白盲文与边界验证', () => {
  assert.equal(validate(''), null)
  assert.equal(validate('\u2800\u2800'), null)
  assert.equal(validate('\u28ff\u28ff'), null)
  assert.equal(validate('\u2800\u2882\u2800\u2800'), null)
  assert.equal(validate('\u2800').index, 0)
  assert.match(validate('\u2800').message, /缺少配对/)
  for (const bad of ['A', ' ', '\n', '\t', '\u27ff', '\u2900', '😀']) {
    assert.equal(validate('\u2800' + bad).index, 1)
    assert.match(validate('\u2800' + bad).message, /不属于盲文/)
  }
})
test('主动清理只删指定的排版空白，保留 U+2800', () => {
  assert.equal(cleanWhitespace(' \u2800\r\n\t\u2882 '), '\u2800\u2882')
  assert.equal(cleanWhitespace('\u00a0\u2003\u2800'), '\u00a0\u2003\u2800')
})
test('全 UTF-16 码元空间往返（包括孤立代理项）', () => {
  let raw = ''
  for (let i = 0; i <= 65535; i++) raw += String.fromCharCode(i)
  assert.equal(dec(enc(raw)), raw)
  assert.equal(decode(encode(raw, 'native'), 'native'), raw)
})
