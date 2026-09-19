// 历史 remap 核心，源自 287f510。按 UTF-16 码元处理，不按码点遍历。
export function divlist(x, d) {
  var res = []
  for (var i = 0; i < x.length; i += d) res.push(x.slice(i, i + d))
  return res
}

export function remap(x, code) {
  var res = ""
  Array.from(code).forEach(i => res += x[i])
  return res
}

export var tobin = ((x, l) => ("0".repeat(l) + x.toString(2)).substr(-l))

export var enc = (raw => raw.split("").map(x => divlist(tobin(x.charCodeAt(0), 16), 8).map(y => String.fromCharCode(parseInt(remap(y, "73654210"), 2) + 10240)).join("")).join(""))

export var dec = (raw => divlist(raw, 2).map(x => String.fromCharCode((y => y[0] * 256 + y[1])(divlist(x, 1).map(z => parseInt(remap(tobin(z.charCodeAt(0) - 10240, 8), "76514320"), 2))))).join(""))
