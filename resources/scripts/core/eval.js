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

raw.onblur=function(){
  eo.value=enc(raw.value);
  if(raw.value.charCodeAt()>=10240 && raw.value.charCodeAt()<=(10240+256)){
    alert("encode again , continue?")
  };
};
eo.onblur=function(){
  raw.value=dec(eo.value);
  if(eo.value.charCodeAt()<10240 || eo.value.charCodeAt()>(10240+256)){
    alert("can't decode wrong code , continue?")
  };
};

window.onkeydown=function(){

  if(13 == event.keyCode && document.activeElement==raw){
    rawpage.click();

  }
  else if (13 == event.keyCode && document.activeElement==eo) {
    eopage.click();}}

function qr(unicode){

  return Array(parseInt(unicode/256)+10240,unicode%256+10240)
}

function qri(array){
  return (array[0]-10240)*256+(array[1]-10240)
}

function enc(rawstr){
  res=Array();

  for (var i = 0; i < rawstr.length; i++) {
    res.push(rawstr.charCodeAt(i));
  }

  res=res.map(qr).flat(Infinity);

  for (var i = 0; i < res.length; i++) {
    res[i]=String.fromCharCode(res[i]);
  }

  res=res.join("")

  return res
}

function dec(eostr){
  rawres=Array();
  for (var i = 0; i < eostr.length; i++) {
    rawres.push(eostr.charCodeAt(i));
  }

  res=Array();
  for (var i = 0; i < rawres.length; i += 2) {
    res.push(rawres.slice(i, i + 2));
  }

  res=res.map(qri)

  for (var i = 0; i < res.length; i++) {
    res[i]=String.fromCharCode(res[i]);
  }

  res=res.join("")

  return res
}

function cleardefalut(){
  raw.value=""
  eo.value=""
}
