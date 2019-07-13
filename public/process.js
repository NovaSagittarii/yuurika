var config = {};
var socket;
var font;
const sendable = "wasdjk".split('');

//Player vars
var x = 0;
var y = 0;
var a = 0;
var xv = 0;
var yv = 0;
var av = 0;
var ap = 100;
var sp = 100;
var pw, sw;
var pwr = 0;
var swr = 0;
var kills, score, score2 = 0;
var pwrof; //primary/secondary rate of fire
var swrof;
var name;
var plyrs = [];
var projectiles = [];

var clipsize;
var ammo = 0;
var reloadtime;
var reload;

var accel = 1;
var ts = Math.PI * 0.003;

var keys = [], showData, cx, cy, cy_c, cy_a;

// updates current data to sync client with server
function update(data){
  if(showData) console.log(data, data.length);
  data = data.split(':');
  const SELF = JSON.parse('[' + data[0] + ']');
  x = SELF[0];
  y = SELF[1];
  a = SELF[2];
  xv = SELF[3];
  yv = SELF[4];
  av = SELF[5];
  ap -= (ap - SELF[6]) / 7;
  sp -= (sp - SELF[7]) / 14;
  pwr = (SELF[8] & 1) ? pwr + 1 : 0;
  swr = (SELF[8] & 2) ? swr + 1 : 0;
  reload = (SELF[8] & 4) ? reload + 1 : 0;
  kills = SELF[9];
  score = SELF[10];
  ammo -= (ammo - SELF[11]) / 5;
  plyrs = data[1].split(';').map(e => {
    let a = e.split('&');
    let o = JSON.parse('[' + a[0] + ']');
    o.push(a[1]);
    return o;
  });
  if(!plyrs[0][0]) plyrs = [];
  projectiles = data[2].split(';').map(e => JSON.parse('[' + e + ']'));
}
function updateStatic(data){
  console.log(data, data.length);
  data = data.split(";");
  const SELF = JSON.parse('[' + data[0] + ']');
  pw = SELF[0];
  sw = SELF[1];
  pwrof = SELF[2];
  swrof = SELF[3];
  clipsize = SELF[4];
  reloadtime = SELF[5];
  name = data[1];
}
function updateConfig(newConfig){
  config = Object.assign(newConfig);
  frameRate(config.targetFrameRate);
}

//initialize
function preload() {
  font = loadFont('assets/Share-Regular.ttf');
}
function setup() {
  var canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent('display');
  noCursor();
  rectMode(CENTER);
  textAlign(CENTER, CENTER);
  textFont(font);
  strokeCap(PROJECT);
  /*socket = io.connect('http://47.147.17.164:3000');
  socket.on('update', update);
  socket.on('setConfig', updateConfig);
  socket.emit('requestConfig', name);*/
  for(var i = 0; i < sendable.length; i ++) keys[sendable[i]] = false;
  cx = width >> 1;
  cy = cy_c = height >> 1;
  cy_a = height * 2/3;
}
function joinGame(name) {
  socket = io();
  socket.on('update', update);
  socket.on('updateS', updateStatic);
  socket.on('setConfig', updateConfig);
  socket.emit('requestConfig', name);
}

//update current state by sending data to server to sync server with client
function keyPressed() {
  keys[key.toLowerCase()] = true;
  socket.emit('input', String.fromCharCode(keys.w << 0 | keys.s << 1 | keys.a << 2 | keys.d << 3 | keys.j << 4 | keys.k << 5));
}
function keyReleased() {
  keys[key.toLowerCase()] = false;
  socket.emit('input', String.fromCharCode(keys.w << 0 | keys.s << 1 | keys.a << 2 | keys.d << 3 | keys.j << 4 | keys.k << 5));
}
