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
var ap = 100, apv = 1;
var sp = 100, spv = 1;
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

var k = [], cx, cy, cy_c, cy_a, m = [];
const mouseConfig = {
  xb: 15,  // x buffer
  yb: 15,  // y buffer
  ab: 0.15, // angle buffer
  ac: 0,   // angle calibration
};
const debug = {
  showData: false,
  showFPS: false,
};
const cd = (x, y) => Math.min(Math.abs(x - y), TWO_PI - Math.abs(x - y)); // circular distance
const dir = (x, y) => cd(x, y+1) < cd(x, y-1) ? 1 : -1;

// updates current data to sync client with server
function update(data){
  if(debug.showData) console.log(data.split('\u001D'), data.length);
  data = data.split('\u001D');
  const SELF = JSON.parse('[' + data[0] + ']');
  x = SELF[0];
  y = SELF[1];
  a = (SELF[2] + TWO_PI) % TWO_PI;
  xv = SELF[3];
  yv = SELF[4];
  av = SELF[5];
  ap = SELF[6];
  sp = SELF[7];
  pwr = (SELF[8] & 1) ? pwr + 1 : 0;
  swr = (SELF[8] & 2) ? swr + 1 : 0;
  reload = (SELF[8] & 4) ? reload + 1 : 0;
  kills = SELF[9];
  score = SELF[10];
  ammo -= (ammo - SELF[11]) / 5;
  plyrs = data[1].split('\u001F').map(e => {
    let a = e.split('\u0002');
    let o = JSON.parse('[' + a[0] + ']');
    o.push(a[1]);
    return o;
  });
  if(isNaN(plyrs[0][0])) plyrs = [];
  projectiles = data[2].split('\u001F').map(e => JSON.parse('[' + e + ']'));
}
function updateStatic(data){
  console.log(data, data.length);
  data = data.split("\u001F");
  const SELF = JSON.parse('[' + data[0] + ']');
  pw = SELF[0];
  sw = SELF[1];
  pwrof = SELF[2];
  swrof = SELF[3];
  clipsize = SELF[4];
  reloadtime = SELF[5];
  name = data[1];
  pwr = swr = reload = 0;
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
  for(var i = 0; i < sendable.length; i ++) k[sendable[i]] = false;
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
  k.o = true;
}

//update current state by sending data to server to sync server with client
function keyPressed() {
  k[key.toLowerCase()] = true;
  socket.emit('input', String.fromCharCode(k.w << 0 | k.s << 1 | k.a << 2 | k.d << 3 | k.j << 4 | k.k << 5));
}
function keyReleased() {
  k[key.toLowerCase()] = false;
  socket.emit('input', String.fromCharCode(k.w << 0 | k.s << 1 | k.a << 2 | k.d << 3 | k.j << 4 | k.k << 5));
}
function mouseMoved() {
  if(!mouseControls) return;
  if(alignRotation){ // FP+mouse is really difficult to use >///<
    m[6] = mouseY <= cy-mouseConfig.yb;
    m[7] = mouseY >= cy+mouseConfig.yb;
    m[8] = mouseX <= cx-mouseConfig.xb;
    m[9] = mouseX >= cx+mouseConfig.xb;
    fill(255, 80);
    if(m[6]) triangle(cx - 10, cy - 10, cx + 10, cy - 10, cx, cy - 18);
    if(m[7]) triangle(cx - 10, cy + 10, cx + 10, cy + 10, cx, cy + 18);
    if(m[8]) triangle(cx - 10, cy - 10, cx - 10, cy + 10, cx - 18, cy);
    if(m[9]) triangle(cx + 10, cy - 10, cx + 10, cy + 10, cx + 18, cy);
  }else{
    let px = cx - xv*2;
    let py = cy - yv*2;
    let ta = (Math.atan2(mouseY - py, mouseX - px) + av*1.9 + TWO_PI) % TWO_PI;
    m[6] = dist(mouseX, mouseY, px, py) > 100;
    m[8] = m[9] = 0;
    m[dir(ta, a+mouseConfig.ac) == 1 ? 9 : 8] = cd(ta, a+mouseConfig.ac) >= mouseConfig.ab;
  }
  m[11] = m[10];
  m[10] = String.fromCharCode(m[6] << 0 | m[7] << 1 | m[8] << 2 | m[9] << 3 | m[0] << 4 | m[2] << 5);
  if(m[10] != m[11]) socket.emit('input', m[10]);
}
function mouseDragged(){
  mouseMoved();
}
function mousePressed(event) {
  m[event.button] = true;
  mouseMoved();
}
function mouseReleased(event) {
  m[event.button] = false;
  mouseMoved();
}
