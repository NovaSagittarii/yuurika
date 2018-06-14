const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

app.use(express.static(__dirname + '/public'));

const config = {
  width:  400,
  height: 400,
  broadcastInterval: false, //ms
  targetFrameRate: 60, //fps
};
const keys = "wasdjk".split('');
const stats = {
  accel: 1,
  ts: Math.PI*0.003
};
let keySet = {};
for(let i = 0; i < keys.length; i ++){
  keySet[keys[i]] = false;
}

var active = 0;
var plyr = {};
var plyrID = [];
function Player(){
  this.x = plyrID.length*50;
  this.y = 0;
  this.a = 0;  // rotation alignment
  this.xv = 0;
  this.yv = 0;
  this.av = 0; // angular vel
  this.ap = 100; // armour
  this.sp = 100; // shield
  this.state = Object.assign(keySet);
}
Player.prototype.update = function(){
  if(this.state.w || this.state.s){
    this.xv += Math.cos(this.a) * stats.accel * (1-2*this.state.s);
    this.yv += Math.sin(this.a) * stats.accel * (1-2*this.state.s);
  }
  if(this.state.a || this.state.d) this.av += stats.ts * (1-2*this.state.a);
  this.x += this.xv;
  this.y += this.yv;
  this.a += this.av;
  this.xv /= 1.1;
  this.yv /= 1.1;
  this.av /= 1.1;
  if(this.x < 0) this.x = 0;
  if(this.y < 0) this.y = 0;
  if(this.x > config.width) this.x = config.width;
  if(this.y > config.height) this.y = config.height;
}
Player.prototype.updateState = function(input){
  if(isNaN(this.x) || isNaN(this.y) || isNaN(this.a)) return true; // I N V A L I D    M O V E M E N T   :hyperAngery:
  //for(let i = 0; i < keys.length; i ++) this.state[keys[i]] = input[keys[i]];
  this.state = Object.assign(input);
}

var broadcast = true;
function update(){
  for(let i = 0; i < plyrID.length; i ++){
    let socketID = plyrID[i];
    let self = plyr[socketID];
    self.update();
    // Checking from index of all tokenids, call from object and update.
    if(broadcast || !config.broadcastInterval){
      let data = {self: Object.assign(self), plyrs: []};
      for(let j = 0; j < plyrID.length; j ++){
        if(i === j) continue;
        data.plyrs.push(Object.assign(plyr[plyrID[j]]));
      }
      io.to(socketID).emit('update', data);
    }
  }
  broadcast = false;
}
function broadcastData(){
  broadcast = true;
}

io.on('connection', function(socket){
  console.log(' > new connection! cID: ' + socket.id);
  setTimeout(function(){socket.broadcast.emit('nP', ++active);}, 2000);
  plyr[socket.id] = new Player();
  plyrID.push(socket.id);

  socket.on('input', function(data){
    if(plyr[socket.id].updateState(data)){
      console.log("DISCONNECTED!!!")
      socket.disconnect();
    }
  });
  socket.on('requestConfig', function(){
    io.to(socket.id).emit('setConfig', config);
  })
  socket.on('disconnect', function(){
    delete plyr[socket.id];
    plyrID.splice(plyrID.indexOf(socket.id), 1);
    console.log(' < disconnection!  cID: ' + socket.id);
    socket.broadcast.emit('nP', --active);
  });
});

http.listen(3000, '0.0.0.0', function(){
  console.log(`listening on *:3000\nRunning at ${(1e3/Math.round(1e3 / config.targetFrameRate)).toFixed(2)}FPS`);
});
setInterval(update, Math.round(1e3 / config.targetFrameRate));
if(config.broadcastInterval) setInterval(broadcastData, config.broadcastInterval);


//
