# 核心代码修改与必要原因

基线：历史提交 `287f510 remap` 的 `resources/scripts/core/eval.js`。`6ca79e0` 内的核心与之相同。升级前 HEAD `42e1c8e` 回退到了无 remap 的原生字节映射。

## 实际运行核心

新位置：`src/core.js`。页面「原理与源码」通过 Vite `?raw` 导入这个文件展示，避免维护一份容易漂移的示意代码。

```js
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
```

## 最小变化

| 修改 | 原因 |
| --- | --- |
| `Array.from(raw)` → `raw.split("")` | 原写法按码点遍历，emoji 合为一个元素后 `charCodeAt()` 只读高代理项。split 按 UTF-16 码元遍历，完整保留两个代理项和孤立代理项。 |
| `res` → `var res`；`tobin / enc / dec` 明确声明 | 去掉隐式全局变量，使短函数在 ES module 严格模式中正确运行。 |
| `charCodeAt()` → `charCodeAt(0)` | 明确读取当前码元的位置，行为与原始默认值相同。 |
| `export` | 允许测试、页面、Worker 共享同一实现，不引入 DOM 或框架。 |
| 一行准确注释；`divlist` 单行循环体 | 注明 UTF-16 前提并保持紧凑可读，算法未改变。 |

保留 `73654210`、`76514320`、`10240` 三个字面量；保留 `divlist`、`remap`、`tobin`、`enc`、`dec`、高低字节顺序、map/join 表达方式以及原来的二进制补齐表达。

没有用查表、通用编码框架或 DOM 回调替换核心。验证、非法输入提示、奇数长度、历史兼容、存储、渲染、复制、文件与异步调度都在外围。`dec` 的调用前提由外围保证：输入为偶数个 U+2800–U+28FF；空字符串合法。

## 独立验证

固定向量：

```js
enc("A")  === "\u2800\u2882"
enc("中") === "\u283A\u289C"
enc("😀") === "\u284B\u28DC\u287B\u2800"
```

所有 256 个字节都用独立位移公式计算期望掩码，检查正向结果与逆排列。单一置位字节 `128,64,32,16,8,4,2,1` 必须分别落在 `(左,1..4)`、`(右,1..4)`。渲染权值固定为 `[1,2,4,64,8,16,32,128]`，源自真实 Unicode 点位，不依靠字体显示或仅凭往返成功断言正确。
