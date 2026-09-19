import { enc, dec } from './core.js'

// 原站无 remap 的历史格式。与默认格式范围相同，必须由用户选择。
export function encode(raw, format = 'remap') {
  if (format === 'remap') return enc(raw)
  return raw.split('').map(x => {
    var n = x.charCodeAt(0)
    return String.fromCharCode((n >> 8) + 10240, (n & 255) + 10240)
  }).join('')
}

export function decode(code, format = 'remap') {
  if (format === 'remap') return dec(code)
  var res = ''
  for (var i = 0; i < code.length; i += 2)
    res += String.fromCharCode((code.charCodeAt(i) - 10240) * 256 + code.charCodeAt(i + 1) - 10240)
  return res
}

export function validate(code) {
  for (var i = 0; i < code.length; i++) {
    var n = code.charCodeAt(i)
    if (n < 0x2800 || n > 0x28ff) return {
      index: i,
      message: `第 ${i + 1} 个 UTF-16 位置是 U+${n.toString(16).toUpperCase().padStart(4, '0')}，不属于盲文字符。只接受 U+2800–U+28FF。`
    }
  }
  return code.length % 2 ? { index: code.length - 1, message: `共 ${code.length} 个盲文字符，最后一个缺少配对字符。请补全原有编码，不会自动补零。` } : null
}

// 左列从上到下，然后右列从上到下；权值来自 Unicode 的真实点位。
export const weights = [1, 2, 4, 64, 8, 16, 32, 128]
export const pointNumbers = [1, 2, 3, 7, 4, 5, 6, 8]
export const bits = char => weights.map(w => ((char.charCodeAt(0) - 10240) & w) ? 1 : 0)
export const cleanWhitespace = code => code.replace(/[ \r\n\t]/g, '')
