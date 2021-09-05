var raw = document.getElementById("u8_input");
var eo = document.getElementById("u11_input");
var rawpage = document.getElementById("u6_div");
var eopage = document.getElementById("u9_div");

var timer;
raw.onmousedown = function () {
  timer = setTimeout(function () {
    raw.select();
    document.execCommand("Copy");
  }, 1500);
}
eo.onmousedown = function () {
  timer = setTimeout(function () {
    eo.select();
    document.execCommand("Copy");
  }, 1500);
}

raw.onmouseup = function () {
  clearTimeout(timer);
}
eo.onmouseup = function () {
  clearTimeout(timer);
}

raw.onblur = function () {
  eo.value = enc(raw.value);
  if (raw.value.charCodeAt() >= 10240 && raw.value.charCodeAt() <= (10240 + 256)) {
    alert("encode again , continue?")
  };
};
eo.onblur = function () {
  raw.value = dec(eo.value);
  if (eo.value.charCodeAt() < 10240 || eo.value.charCodeAt() > (10240 + 256)) {
    alert("can't decode wrong code , continue?")
  };
};

window.onkeydown = function () {

  if (event.ctrlKey && 13 == event.keyCode && document.activeElement == raw) {
    rawpage.click();

  }
  else if (event.ctrlKey && 13 == event.keyCode && document.activeElement == eo) {
    eopage.click();
  }
}

function divlist(x, d) {
  res = []
  for (var i = 0; i < x.length; i += d) {
    res.push(x.slice(i, i + d))
  }
  return res
}


function remap(x, code) {
  res = ""
  Array.from(code).forEach(i => res += x[i])
  return res
}

tobin = ((x, l) => ("0".repeat(l) + x.toString(2)).substr(-l))

enc = (raw => Array.from(raw).map(x => divlist(tobin(x.charCodeAt(), 16), 8).map(y => String.fromCharCode(parseInt(remap(y, "73654210"), 2) + 10240)).join("")).join(""))

dec = (raw => divlist(raw, 2).map(x => String.fromCharCode((y => y[0] * 256 + y[1])(divlist(x, 1).map(z => parseInt(remap(tobin(z.charCodeAt() - 10240, 8), "76514320"), 2))))).join(""))

function cleardefalut() {
  raw.value = ""
  eo.value = ""
}
