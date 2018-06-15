const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

app.use(express.static(__dirname + '/public'));

const config = {
  width:  400,
  height: 400,
  broadcastInterval: false, //ms
  targetFrameRate: 30, //fps
};
const PELLET = 0, TWIN = 1, GATLING = 2, SHOTGUN = 3;
const MISSILE = 0;
const keys = "wasdjk".split('');
const stats = {
  accel: 1,
  ts: Math.PI*0.003,
  wep: {
    pw: {
      dmg: [15, 15, 8, 10],
      muV: [8, 8, 12, 10],
      // muzzle velocity
      rec: [2, 3, 0.5, 5],
      // recoil
      kb: [2, 2, 1, 2],
      // knockback
      rof: [30, 14, 7, 55],
      range: [600, 600, 400, 400],
      pierce: [1, 1, 1, 2]
    },
    sw: {
      dmg: [40],
      muV: [10],
      rec: [10],
      rof: [400],
      range: [1400],
      pierce: [1]
    },
  }
};
let keySet = {};
for(let i = 0; i < keys.length; i ++){
  keySet[keys[i]] = false;
}

var active = 0;
var plyr = {};
var plyrID = [];
var projectiles = [];

function Projectile(uID, type, pID, angleOffset){
  this.x = plyr[uID].x;
  this.y = plyr[uID].y;
  this.a = plyr[uID].a + angleOffset;
  this.xv = Math.cos(this.a) * stats.wep[type].muV[pID] + plyr[uID].xv;
  this.yv = Math.sin(this.a) * stats.wep[type].muV[pID] + plyr[uID].yv;
  this.dmg = stats.wep[type].dmg[pID];
  this.pierce = stats.wep[type].pierce[pID];
  this.type = type;
  this.id = pID;
  this.d = stats.wep[type].range[pID];
  this.plyr = uID;
  plyr[uID][type+"r"] = 0;
}
Projectile.prototype.update = function(){
  this.x += this.xv;
  this.y += this.yv;
  this.d -= this.v;
  return this.d < 0 || !this.pierce;
};
Projectile.prototype.returnData = function(){
  return {
    x: this.x,
    y: this.y,
    a: this.a,
    type: this.type,
    id: this.id
  }
};

function fireBullets(uID, type, pID, angleOffset, repeat){
  while(repeat--){
    projectiles.push(new Projectile(uID, type, pID, Math.random()*angleOffset-angleOffset/2, repeat));
  }
  plyr[uID].xv -= Math.cos(plyr[uID].a) * stats.wep[type].rec[pID];
  plyr[uID].yv -= Math.sin(plyr[uID].a) * stats.wep[type].rec[pID];
  plyr[uID][type+"r"] = 0;
}

function Player(){
  this.x = plyrID.length*50;
  this.y = 0;
  this.a = 0;  // rotation alignment
  this.xv = 0;
  this.yv = 0;
  this.av = 0; // angular vel
  this.ap = 100; // armour
  this.sp = 100; // shield
  this.pw = GATLING;
  this.sw = MISSILE;
  this.pwr = 0;
  this.swr = 0;
  this.scd = 0;
  this.pwtr = stats.wep.pw.rof[this.pw];
  this.swtr = stats.wep.sw.rof[this.sw];
  this.state = Object.assign(keySet);
}
Player.prototype.update = function(socketid){
  if(this.state.w || this.state.s){
    this.xv += Math.cos(this.a) * stats.accel * (1-1.2*this.state.s);
    this.yv += Math.sin(this.a) * stats.accel * (1-1.2*this.state.s);
  }
  if(this.state.a || this.state.d) this.av += stats.ts * (1-2*this.state.a);
  if(this.state.pw && this.pwr > this.pwtr){
    switch(this.pw){
      case PELLET:
      case TWIN:
        projectiles.push(new Projectile(socketid, 'pw', this.pw, 0));
        break;
      case GATLING:
        fireBullets(socketid, 'pw', this.pw, 0.4, 1);
        break;
      case SHOTGUN:
        fireBullets(socketid, 'pw', this.pw, 0.3, 3);
      break;
    }
  }
  if(this.state.sw && this.swr > this.swtr) projectiles.push(new Projectile(socketid, 'sw', this.sw, 0));
  if(--this.scd < 0) this.sp = Math.min(this.sp + 0.1, 100);
  this.x += this.xv;
  this.y += this.yv;
  this.a += this.av;
  this.xv /= 1.1;
  this.yv /= 1.1;
  this.av /= 1.1;
  ++this.pwr;
  ++this.swr;
  if(this.x < 0) this.x = 0;
  if(this.y < 0) this.y = 0;
  if(this.x > config.width) this.x = config.width;
  if(this.y > config.height) this.y = config.height;
  return this.ap < 0;
};
Player.prototype.updateState = function(input){
  if(isNaN(this.x) || isNaN(this.y) || isNaN(this.a)) return true; // I N V A L I D    M O V E M E N T   :hyperAngery:
  //for(let i = 0; i < keys.length; i ++) this.state[keys[i]] = input[keys[i]];
  this.state = Object.assign(input);
};
Player.prototype.returnData = function(){
  return {
    x: this.x,
    y: this.y,
    a: this.a,
    xv: this.xv,
    yv: this.yv,
    av: this.av,
    ap: this.ap,
    sp: this.sp,
    accel: this.state.w || this.state.s
  }
};
Player.prototype.damage = function(dmg){
  if(this.sp >= 1){
    this.scd = 150;
    this.sp = Math.max(0, this.sp - dmg);
  }else{
    this.scd = 1000;
    this.ap -= dmg;
  }
};

var broadcast = true;
function update(){
  let activeProjectiles = [];
  for(let i = 0; i < projectiles.length; i ++) activeProjectiles.push(projectiles[i].returnData());
  for(let i = 0; i < plyrID.length; i ++){
    let socketID = plyrID[i];
    let self = plyr[socketID];
    if(self.update(socketID)){
      disconnect(socketID);
      continue;
    }
    // Checking from index of all tokenids, call from object and update.
    if(broadcast || !config.broadcastInterval){
      let data = {self: Object.assign(self), plyrs: [], prjctls: activeProjectiles};
      for(let j = 0; j < plyrID.length; j ++){
        if(i === j) continue;
        data.plyrs.push(plyr[plyrID[j]].returnData());
      }
      io.to(socketID).emit('update', data);
    }
  }
  for(let i = 0; i < projectiles.length; i ++){
    if(projectiles[i].update()){
      projectiles.splice(i, 1);
      continue;
    }
    let self = projectiles[i];
    for(let j = 0; j < plyrID.length; j ++){
      if(self.plyr === plyrID[j]) continue;
      let that = plyr[plyrID[j]];
      //if(dist(self.x, self.y, that.x, that.y) < 9){
      if(Math.abs(self.x - that.x) < 17 && Math.abs(self.y - that.y) < 17){
        that.damage(self.dmg);
        //plyr[self.plyr].ap += self.dmg/3;
        //plyr[self.plyr].sp += self.dmg/5;
        if(!(--self.pierce)) break;
      }
    }
  }
  broadcast = false;
}
function broadcastData(){
  broadcast = true;
}
function disconnect(socketid){
  delete plyr[socketid];
  plyrID.splice(plyrID.indexOf(socketid), 1);
  console.log(' < disconnection!  cID: ' + socketid);
}

io.on('connection', function(socket){
  console.log(' > new connection! cID: ' + socket.id);
  plyr[socket.id] = new Player();
  plyrID.push(socket.id);

  socket.on('input', function(data){
    if(plyr[socket.id]){
      if(plyr[socket.id].updateState(data)){
        console.log("DISCONNECTED!!!")
        socket.disconnect();
      }
    }else{
      plyr[socket.id] = new Player();
      plyrID.push(socket.id);
    }
  });
  socket.on('requestConfig', function(){
    io.to(socket.id).emit('setConfig', config);
  });
  socket.on('disconnect', function(){
    disconnect(socket.id);
  });
});

http.listen(3000, '0.0.0.0', function(){
  console.log(`listening on *:3000\nRunning at ${(1e3/Math.round(1e3 / config.targetFrameRate)).toFixed(2)}FPS`);
});
setInterval(update, Math.round(1e3 / config.targetFrameRate));
if(config.broadcastInterval) setInterval(broadcastData, config.broadcastInterval);
