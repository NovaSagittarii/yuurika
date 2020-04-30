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
var nameList = [], id;
var transmissionData = [];
const mouseConfig = {
  xb: 15,  // x buffer
  yb: 15,  // y buffer
  ab: 0.15, // angle buffer
  ac: -Math.PI/2,   // angle calibration
};
const debug = {
  showData: false,
  showFPS: false,
  transmissionData: false,
  transmissionLogging: true,
};
const cd = (x, y) => Math.min(Math.abs(x - y), TWO_PI - Math.abs(x - y)); // circular distance
const dir = (x, y) => cd(x, y+1) < cd(x, y-1) ? 1 : -1;

const TWO_PI = Math.PI*2;
const b2rk =TWO_PI/255; // binary to radians constant
// updates current data to sync client with server
function update(data){
  if(debug.showData) console.log(data, data.byteLength);
  if(debug.transmissionLogging) transmissionData = [Date.now(), data.byteLength];
  const pc = new Uint8Array(data, 0, 1)[0]; // player count
  const ps = 4+20*pc; // particle start (byte location)
  const p32 = new Uint32Array(data, 4, 1);
  const p16 = new Uint16Array(data, 8, 3);
  const p8 = new Uint8Array(data, 14, 5);
  const ps8 = new Int8Array(data, 19, 5);

  score = p32[0];
  x = p16[0];
  y = p16[1];
  kills = p16[2];
  a = p8[0]*b2rk;
  ap = p8[1];
  sp = p8[2];
  pwr = (p8[3] & 1) ? pwr + 1 : 0;
  swr = (p8[3] & 2) ? swr + 1 : 0;
  reload = (p8[3] & 4) ? reload + 1 : 0;
  ammo -= (ammo - p8[4]) / 5;
  xv = ps8[0]/10;
  yv = ps8[1]/10;
  av = ps8[2]/1000;

  if(pc>1){
    plyrs = [];
    for(let i = 24; i < ps; i += 20){
      const u32 = new Uint32Array(data, i, 1);
      const u16 = new Uint16Array(data, i+4, 3);
      const u8 = new Uint8Array(data, i+10, 5);
      const s8 = new Int8Array(data, i+15, 5);
      plyrs.push([u16[0], u16[1], u8[0]*b2rk, s8[0]/10, s8[1]/10, s8[2]/1000, u8[1], u8[2], u8[3], u16[2], u32[0], u8[4]]);
    }
  }else{
    plyrs = [];
  }
  if(data.byteLength > ps){
    projectiles = [];
    for(let i = ps; i < data.byteLength; i += 8){
      const u16 = new Uint16Array(data, i, 2);
      const u8 = new Uint8Array(data, i+4, 4);
      projectiles.push([u16[0], u16[1], u8[0]*b2rk, u8[1], u8[2], u8[3]]);
    }
  }
}
function updateStatic(data){
  const u8 = new Uint8Array(data);
  const u16 = new Uint16Array(data, 0, 2);
  console.log("updateStatic", data.byteLength);
  id = u8[4];
  pw = u8[5];
  sw = u8[6];
  pwrof = u8[7];
  swrof = u16[1];
  clipsize = u8[8];
  reloadtime = u16[0];
  pwr = swr = reload = 0;
}
function setNameList(data){
  nameList = data.split('\u001D');
  console.log("setNameList", nameList.length, nameList);
}
function updateNameList(data){
  const d = data.split('\u001D');
  nameList[parseInt(d[0])] = d[1];
  console.log("updateNameList", d[0], d[1]);
}
function nameAcknowledgement(data){
  console.log("nameAcknowledgement", data);
  name = data;
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
  noLoop();
}
function joinGame(name) {
  socket = io();
  socket.on('update', update);
  socket.on('updateS', updateStatic);
  socket.on('name', nameAcknowledgement);
  socket.on('nameList', setNameList);
  socket.on('updateNameList', updateNameList);
  socket.on('setConfig', updateConfig);
  socket.emit('requestConfig', name);
  k.o = true;
  loop();
}

//update current state by sending data to server to sync server with client
function keyPressed() {
  k[key.toLowerCase()] = true;
  if(socket) socket.emit('input', String.fromCharCode(k.w << 0 | k.s << 1 | k.a << 2 | k.d << 3 | k.j << 4 | k.k << 5));
}
function keyReleased() {
  k[key.toLowerCase()] = false;
  if(socket) socket.emit('input', String.fromCharCode(k.w << 0 | k.s << 1 | k.a << 2 | k.d << 3 | k.j << 4 | k.k << 5));
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
    let px = cx - xv*5.86;
    let py = cy - yv*5.86;
    let ta = (Math.atan2(mouseY - py, mouseX - px) + av + TWO_PI) % TWO_PI;
    let pa = a+mouseConfig.ac+av*5.86;
    m[6] = dist(mouseX, mouseY, px, py) > 100;
    m[8] = m[9] = 0;
    m[dir(ta, pa) == 1 ? 9 : 8] = cd(ta, pa) >= av*5.86;
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
