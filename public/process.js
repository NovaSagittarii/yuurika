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
var pwr;
var swr;
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
var state;

var keys = [];

// updates current data to sync client with server
function update(data){
  const SELF = data.self;
  x = SELF.x;
  y = SELF.y;
  a = SELF.a;
  xv = SELF.xv;
  yv = SELF.yv;
  av = SELF.av;
  ap -= (ap - SELF.ap) / 7;
  sp -= (sp - SELF.sp) / 14;
  pw = SELF.pw;
  sw = SELF.sw;
  pwr = SELF.pwr;
  swr = SELF.swr;
  name = SELF.name;
  kills = SELF.kills;
  score = SELF.score;
  state = SELF.state;
  plyrs = data.plyrs;
  projectiles = data.prjctls;
  pwrof = SELF.pwtr;
  swrof = SELF.swtr;
  clipsize = SELF.pwcs;
  ammo -= (ammo - SELF.pwam) / 5;
  reloadtime = SELF.pwrlt;
  reload = SELF.pwrltcd;
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
}
function joinGame(name) {
  socket = io();
  socket.on('update', update);
  socket.on('setConfig', updateConfig);
  socket.emit('requestConfig', name);
}

//update current state by sending data to server to sync server with client
function keyPressed() {
  keys[key.toLowerCase()] = true;
  let data = currKey = {
    w: keys.w,
    s: keys.s,
    a: keys.a,
    d: keys.d,
    pw: keys.j,
    sw: keys.k
  };
  socket.emit('input', data);
}
function keyReleased() {
  keys[key.toLowerCase()] = false;
  let data = currKey = {
    w: keys.w,
    s: keys.s,
    a: keys.a,
    d: keys.d,
    pw: keys.j,
    sw: keys.k
  };
  socket.emit('input', data);
}
