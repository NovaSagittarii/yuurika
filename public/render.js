/*
pushMatrix() / popMatrix() -> push() / pop()
mouse {} -> touch {}
*/

var config = {};
var socket;
var aU = 0;
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
var plyrs = [];

var accel = 1;
var ts = Math.PI * 0.003;
var state;

var keys = [];

function updateUsers(active) {
  aU = active;
}
function update(data){
  x = data.self.x;
  y = data.self.y;
  a = data.self.a;
  xv = data.self.xv;
  yv = data.self.yv;
  av = data.self.av;
  ap = data.self.ap;
  sp = data.self.sp;
  state = data.self.state;
  plyrs = data.plyrs;
  console.log("updated! to " + state)
}
function updateConfig(newConfig){
  config = Object.assign(newConfig);
}

function setup() {
  createCanvas(600, 600);
  background(255, 255, 255);
  socket = io.connect('http://47.147.17.164:3000');
  socket.on('update', update);
  socket.on('nP', updateUsers);
  socket.on('setConfig', updateConfig);
  socket.emit('requestConfig', "");
  updateUsers();
  for(var i = 0; i < sendable.length; i ++) keys[sendable[i]] = false;
}
function draw() {
  background(0, 0, 0);
  strokeWeight(2);
  noStroke();
  fill(255, 255, 255);
  //rect(0, 0, 700, 50);
  //fill(0, 0, 0);
  text(plyrs.length+1 + " active users", 5, 25);

  translate(300, 300);
  rotate(3/2*Math.PI - a + av);
  translate(-x, -y);

  fill(255, 150);
  for(var i = 0; i < plyrs.length; i ++){
    push();
    translate(plyrs[i].x, plyrs[i].y);
    rotate(plyrs[i].a);
    triangle(10, 0, -10, -7, -10, 7);
    pop();
  }

  stroke(255, 255, 255);
  noFill();
  rect(0, 0, config.width, config.height);

  translate(x, y);
  rotate(a);

  fill(255, 255, 255);
  triangle(10, 0, -10, -7, -10, 7);
  resetMatrix();




  if(keys.w || keys.s){
    xv += Math.cos(a) * accel * (1-2*keys.s);
    yv += Math.sin(a) * accel * (1-2*keys.s);
  }
  if(keys.a || keys.d) av += ts * (1-2*keys.a);
  x += xv;
  y += yv;
  a += av;
  xv /= 1.1;
  yv /= 1.1;
  av /= 1.1;
}

var currKey = null;
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
