var config = {};
var socket;
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
var pwrof; //primary/secondary rate of fire
var swrof;
var name;
var plyrs = [];
var projectiles = [];

var accel = 1;
var ts = Math.PI * 0.003;
var state;

var keys = [];

// updates current data to sync client with server
function update(data){
  x = data.self.x;
  y = data.self.y;
  a = data.self.a;
  xv = data.self.xv;
  yv = data.self.yv;
  av = data.self.av;
  ap -= (ap - data.self.ap) / 7;
  sp -= (sp - data.self.sp) / 14;
  pw = data.self.pw;
  sw = data.self.sw;
  pwr = data.self.pwr;
  swr = data.self.swr;
  name = data.self.name;
  state = data.self.state;
  plyrs = data.plyrs;
  projectiles = data.prjctls;
  if(!pwrof){
    pwrof = data.self.pwtr;
    swrof = data.self.swtr;
  }
  console.log("updated! to " + state)
}
function updateConfig(newConfig){
  config = Object.assign(newConfig);
  frameRate(config.targetFrameRate);
}

//initialize
function setup() {
  createCanvas(windowWidth, windowHeight);
  noCursor();
  rectMode(CENTER);
  textAlign(CENTER, CENTER);
  strokeCap(PROJECT);
  //socket = io.connect('https://47.147.17.164:3000', {secure: true});
  //socket = io.connect('http://47.147.17.164:3000');
  socket.on('update', update);
  socket.on('setConfig', updateConfig);
  socket.emit('requestConfig', name);
  for(var i = 0; i < sendable.length; i ++) keys[sendable[i]] = false;
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
