const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

app.use(express.static(__dirname + '/public'));

const config = {
  width:  500,
  height: 500,
  broadcastInterval: false, //ms
  targetFrameRate: 30, //fps
};
const PELLET = 0, TWIN = 1, GATLING = 2, SHOTGUN = 3, RAIL = 4;
const MISSILE = 0, BURST = 1;
const keys = "wasdjk".split('');
const stats = {
  accel: 1,
  ts: Math.PI*0.003,
  wep: {
    pw: {
      dmg: [9, 9, 7, 6, 16],
      muV: [18, 18, 24, 18, 40],
      // muzzle velocity
      rec: [2, 3, 0.5, 0.4, 4],
      // recoil
      kb: [2, 2, 1, 2, 4],
      // knockback
      rof: [25, 12, 4, 85, 40],
      range: [600, 600, 400, 300, 800],
      pierce: [2, 2, 1, 1, 3]
    },
    sw: {
      dmg: [64, 15],
      muV: [12, 9],
      rec: [10, 3],
      kb: [14, 2],
      rof: [200, 500],
      range: [1000, 400],
      pierce: [1, 1]
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
  this.kb = stats.wep[type].kb[pID];
  this.dmg = stats.wep[type].dmg[pID];
  this.pierce = stats.wep[type].pierce[pID];
  this.type = type;
  this.id = pID;
  this.d = stats.wep[type].range[pID];
  this.v = stats.wep[type].muV[pID];
  this.plyr = uID;
  plyr[uID][type+"r"] = 0;
}
Projectile.prototype.update = function(){
  this.x += this.xv;
  this.y += this.yv;
  this.d -= this.v;
  return (this.d < 0 || !this.pierce);
};
Projectile.prototype.returnData = function(){
  return {
    x: this.x,
    y: this.y,
    a: this.a,
    type: this.type,
    id: this.id,
    d: this.d
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
  this.pw = SHOTGUN;
  this.sw = MISSILE;
  this.pwr = 0;
  this.swr = 0;
  this.scd = 0;
  this.pwtr = stats.wep.pw.rof[this.pw];
  this.swtr = stats.wep.sw.rof[this.sw];
  this.state = Object.assign(keySet);
  this.name = "";
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
        fireBullets(socketid, 'pw', this.pw, 0.6, 12);
      break;
      case RAIL:
        projectiles.push(new Projectile(socketid, 'pw', this.pw, 0));
        break;
    }
  }
  if(this.state.sw && this.swr > this.swtr){
    switch(this.sw){
      case MISSILE:
      case BURST:
        projectiles.push(new Projectile(socketid, 'sw', this.sw, 0));
        if(this.sw){
          fireBullets(socketid, 'sw', this.sw, 0.4, 5);
        }
        break;
    }
  }
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
  return this.ap < 1 || this.pierce < 1;
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
    accel: this.state.w || this.state.s,
    name: this.name
  }
};
Player.prototype.damage = function(dmg){
  if(!dmg) return;
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
      projectiles.push({type: "expl", c: 0, a: 2, x: self.x, y: self.y, returnData: Projectile.prototype.returnData, update: function(){ return this.c++;}});
      respawnPlayer(socketID);
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
      if(Math.abs(self.x - that.x) < 24 && Math.abs(self.y - that.y) < 24){
        that.damage(self.dmg);
        let s = Object.assign(self);
        if(s.kb){
          that.xv += s.kb * Math.cos(s.a);
          that.yv += s.kb * Math.sin(s.a);
        }
        if(self.type === "sw" && self.id < 2){
          projectiles.push({type: "expl", c: 0, a: 1, x: s.x, y: s.y, returnData: Projectile.prototype.returnData, update: function(){ return this.c++;}});
        }
        if(!(--self.pierce)) break;
      }
    }
  }
  broadcast = false;
}
function broadcastData(){
  broadcast = true;
}
function respawnPlayer(socketid){
  let name = plyr[socketid].name;
  plyr[socketid] = new Player();
  plyr[socketid].name = name;
  console.log('->     respawned! cID: ' + socketid);
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
  socket.on('requestConfig', function(name){
    plyr[socket.id].name = name;
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
