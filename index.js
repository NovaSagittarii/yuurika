const express = require('express');
const app = express();
const http = require('http');
const fs = require('fs');
const defaultNames = "git push origin master disconnect app socket req res https while(true) jeff jason fs express coffee bin socket.io 48fps".split(' ');

app.use(express.static('./public'));

const server = http.createServer(app);
const io = require('socket.io')(server);

const config = {
  width:  1200,
  height: 1200,
  broadcastInterval: false, //ms
  targetFrameRate: 30, //fps
};
const U_MISSILE = 0, TWIN = 1, GATLING = 2, SHOTGUN = 3, RAIL = 4, ASSAULT = 5;
const MISSILE = 0, BURST = 1;
const keys = "wasdjk".split('');
const PARTICLECODE = {
  pw: 0,
  sw: 1,
  expl: 2
}
const stats = {
  accel: 1,
  ts: Math.PI*0.003,
  wep: {
    pw: {
      dmg: [30, 15, 8, 6, 88, 11],
      muV: [-2, 22, 24, 18, 42, 34],
      // muzzle velocity
      rec: [4, 4, 0.7, 8, 5, 1],
      // recoil
      kb: [14, 4, 1, 2, 4, 1],
      // knockback
      rof: [70, 12, 3, 65, 40, 5],
      cs: [2, 14, 42, 3, 5, 25],
      //clip size
      rlt: [120, 150, 200, 250, 160, 250],
      //reload time
      range: [600, 480, 550, 300, 1200, 550],
      pierce: [1, 1, 1, 1, 5, 1],
      hbs: [28, 24, 18, 16, 22, 24],
      pro: [[2, 10], null, null, null, null, null],
      // propulsion [ float strength , int duration , int homingDuration , int homingSpeed ]
      expl: [0.4, 0, 0, 0, 0, 0]
      // explosive
    },
    sw: {
      dmg: [64, 16],
      muV: [-12, 10],
      rec: [-8, 14],
      kb: [14, 2],
      rof: [200, 400],
      range: [700, 400],
      pierce: [1, 1],
      hbs: [24, 18],
      pro: [[0.4, 24, 1000, 0.8], null],
      expl: [1.2, 0.6]
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
var IPs = {};

const TWO_PI = Math.PI*2;
const constrain = (x, min, max) => Math.max(Math.min(x, max), min);
const cd = (x, y) => Math.min(Math.abs(x - y), TWO_PI - Math.abs(x - y)); // circular distance
const dir = (x, y) => cd(x, y+1) < cd(x, y-1) ? 1 : -1;

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
  this.expl = stats.wep[type].expl[pID];
  if(stats.wep[type].pro[pID]){
    this.pro = stats.wep[type].pro[pID];
    if(this.pro[2] && plyrID.length > 1){
      let dists = [];
      for(let i = 0; i < plyrID.length; i ++){
        let p = plyr[plyrID[i]];
        dists.push({P: plyrID[i], d: Math.abs((p.x+p.xv*3) - this.x) + Math.abs((p.y+p.yv*3) - this.y)});
      }
      this.target = plyr[dists.sort((a, b) => a.d - b.d)[1].P];
    }
  }
  this.d = stats.wep[type].range[pID];
  this.f = 0;
  this.v = stats.wep[type].muV[pID];
  this.plyr = uID;
  plyr[uID][type+"r"] = 0;
  //this.hbs = stats.wep[type].hbs[pID];
}
Projectile.prototype.update = function(){
  this.x += this.xv;
  this.y += this.yv;
  this.d -= this.v;
  ++ this.f;
  if(this.pro && this.f < this.pro[1]){
    this.xv += Math.cos(this.a) * this.pro[0];
    this.yv += Math.sin(this.a) * this.pro[0];
  }else if(this.target && this.f < this.pro[2]){
    let tA = (TWO_PI+Math.atan2(this.target.y - (this.y+this.yv*3), this.target.x - (this.x+this.xv*3)))%TWO_PI;
    this.a = (TWO_PI+this.a)%TWO_PI;
    this.a += dir(tA, this.a) * Math.min(Math.abs(tA - this.a), .2);
    this.xv = (this.xv + Math.cos(this.a) * this.pro[3]) / 1.08;
    this.yv = (this.yv + Math.sin(this.a) * this.pro[3]) / 1.08;
  }
  return (this.d < 0 || !this.pierce);
};
Projectile.prototype.returnData = function(){
  return ((~~this.x)) + ',' + ((~~this.y)) + ',' + this.a.toFixed(2) + ',' + PARTICLECODE[this.type] + ',' + (this.id||0) + ',' + (this.d||0);
};

function fireBullets(uID, type, pID, angleOffset, repeat){
  while(repeat--){
    projectiles.push(new Projectile(uID, type, pID, Math.random()*angleOffset-angleOffset/2, repeat));
  }
  plyr[uID].xv -= Math.cos(plyr[uID].a) * stats.wep[type].rec[pID];
  plyr[uID].yv -= Math.sin(plyr[uID].a) * stats.wep[type].rec[pID];
  plyr[uID][type+"r"] = 0;
}

function Player(socketid, name, score){
  this.x = Math.random()*config.width;
  this.y = Math.random()*config.height;
  this.a = 0;  // rotation alignment
  this.xv = 0;
  this.yv = 0;
  this.av = 0; // angular vel
  this.ap = 100; // armour
  this.sp = 100; // shield
  this.pw = ~~(Math.random() * 6);
  this.sw = ~~(Math.random() * 2);
  this.pwr = 0;
  this.swr = 0;
  this.scd = 0;
  this.pwtr = stats.wep.pw.rof[this.pw];
  this.swtr = stats.wep.sw.rof[this.sw];
  this.pwcs = stats.wep.pw.cs[this.pw];
  this.pwam = this.pwcs; // full clip
  this.pwrlt = stats.wep.pw.rlt[this.pw];
  this.pwrltcd = 0;
  this.state = Object.assign(keySet);
  this.kills = 0;
  this.score = score || 0;
  this.dead = false;
  this.name = name || "";
  io.to(socketid).emit('updateS', this.returnData_ps());
}
Player.prototype.update = function(socketid){
  if(this.state & 1 | this.state & 2){
    this.xv += Math.cos(this.a) * stats.accel * (1-0.6*(this.state & 2));
    this.yv += Math.sin(this.a) * stats.accel * (1-0.6*(this.state & 2));
  }
  if(this.state & 4 | this.state & 8) this.av += stats.ts * (1 - ((this.state & 4) >> 1));

  ++this.pwr;
  ++this.swr;
  if(this.state & 16 && this.pwr > this.pwtr && this.pwam > 0){
    this.pwam --;
    switch(this.pw){
      case U_MISSILE:
        fireBullets(socketid, 'pw', this.pw, 0, 1);
        break;
      case TWIN:
        fireBullets(socketid, 'pw', this.pw, 0, 1);
        break;
      case GATLING:
        fireBullets(socketid, 'pw', this.pw, 0.4, 1);
        break;
      case SHOTGUN:
        fireBullets(socketid, 'pw', this.pw, 0.6, 12);
      break;
      case RAIL:
      case ASSAULT:
        fireBullets(socketid, 'pw', this.pw, 0, 1);
        break;
    }
  }
  if(this.pwam < 1){
    if(this.pwrltcd++ > this.pwrlt){
      this.pwam = this.pwcs;
      this.pwrltcd = 0;
    }
  }
  if(this.state & 32 && this.swr > this.swtr){
    this.swr = 0;
    switch(this.sw){
      case MISSILE:
      case BURST:
        fireBullets(socketid, 'sw', this.sw, 0.4 * this.sw, this.sw ? 7 : 1);
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
  if(this.x < 0) this.x = 0;
  if(this.y < 0) this.y = 0;
  if(this.x > config.width) this.x = config.width;
  if(this.y > config.height) this.y = config.height;
  return this.ap < 1 || this.pierce < 1;
};
Player.prototype.updateState = function(input){
  //if(isNaN(this.x) || isNaN(this.y) || isNaN(this.a)) return true; // I N V A L I D    M O V E M E N T   :hyperAngery:
  this.state = input.charCodeAt(0);
};
Player.prototype.returnData = function(){
  return (~~this.x) + ',' + (~~this.y) + ',' + this.a.toFixed(2) + ',' + this.xv.toFixed(2) + ',' + this.yv.toFixed(2) + ',' + this.av.toFixed(2) + ',' + this.ap + ',' + this.sp + ',' + ((this.state & 1 | this.state & 2) ? 1 : 0) + ',' + this.kills + ',' + this.score + '&' + this.name;
};
Player.prototype.returnData_p = function(){ // personal
  return (~~this.x) + ',' + (~~this.y) + ',' + this.a.toFixed(3) + ',' + this.xv.toFixed(2) + ',' + this.yv.toFixed(2) + ',' + this.av.toFixed(2) + ',' + this.ap + ',' + this.sp + ',' + (Math.min(this.pwr, 1) << 0 | Math.min(this.swr, 1) << 1 | Math.min(this.pwrltcd, 1) << 2) + ',' + this.kills + ',' + this.score + ',' + this.pwam;
};
Player.prototype.returnData_ps = function(){ // personal [static] (contains less dynamic player stats )
  return this.pw + ',' + this.sw + ',' + this.pwtr + ',' + this.swtr + ',' + this.pwcs + ',' + this.pwrlt + ';' + this.name;
}
Player.prototype.damage = function(dmg, src){
  if(!dmg) return;
  if(this.sp >= 1){
    this.scd = 150;
    this.sp = Math.max(0, this.sp - dmg);
  }else{
    this.scd = 1000;
    this.ap -= dmg;
    if(this.dead === null) this.dead = true;
    if(this.ap < 1 && this.dead === false){
      this.dead = null;
      src.score += Math.round(this.score*.75 + this.kills*40);
    }
  }
  return this.ap < 1 && !this.dead;
};

var broadcast = true;
function update(){
  let activeProjectiles = [], playerList = [];
  for(let i = 0; i < projectiles.length; i ++) activeProjectiles.push(projectiles[i].returnData());
  for(let i = 0; i < plyrID.length; i ++) playerList.push(plyr[plyrID[i]].returnData());
  const data_const = `:${activeProjectiles.join(';')}`;
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
      let playerList_local = playerList.slice(0);
      playerList_local.splice(i, 1);
      let data = `${self.returnData_p()}:${playerList_local.join(';')}` + data_const;
      io.to(socketID).emit('update', data);
    }
  }
  for(let i = projectiles.length-1; i >= 0; i--){ // reverse parse to ignore added projectiles (explosion indicators)
    if(projectiles[i].update()){
      projectiles.splice(i, 1);
      continue;
    }
    let self = projectiles[i];
    if(self.type == 'expl') continue;
    for(let j = 0; j < plyrID.length; j ++){
      if(self.plyr === plyrID[j]) continue;
      let that = plyr[plyrID[j]];
      //if(dist(self.x, self.y, that.x, that.y) < 9){
      if(Math.abs(self.x - that.x) < 24 && Math.abs(self.y - that.y) < 24){
        plyr[self.plyr].score += self.dmg;
        if(that.damage(self.dmg, plyr[self.plyr])) plyr[self.plyr].kills ++;
        let s = Object.assign(self);
        if(s.kb){
          that.xv += s.kb * Math.cos(s.a);
          that.yv += s.kb * Math.sin(s.a);
        }
        if(self.expl){
          projectiles.push({type: "expl", c: 0, a: self.expl, x: s.x, y: s.y, returnData: Projectile.prototype.returnData, update: function(){ return this.c++;}});
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
  plyr[socketid] = new Player(socketid, plyr[socketid].name, Math.round(plyr[socketid].score/4));
  console.log('->     respawned! cID: ' + socketid);
}
function disconnect(socketid, reason){
  console.log(' < disconnection! [', reason, '] cID:', socketid);
  setTimeout(function(){
    delete plyr[socketid];
    plyrID.splice(plyrID.indexOf(socketid), 1);
    console.log(' << disconnected! [', reason, '] cID:', socketid);
  }, 10000);
}

io.on('connection', function(socket){
  var address = socket.handshake.address;
  console.log(' > new connection < ' + address + ' cID: ' + socket.id);
  if(!IPs[address]) IPs[address] = socket.id;

  socket.on('input', function(data){
    /*if(IPs[address] !== socket.id){
      io.sockets.connected[IPs[address]].disconnect();
      IPs[address] = socket.id;
      console.log(' < disconnected IP ' + address + ' cID: ' + socket.id);
      return;
    }*/
    if(plyr[socket.id]){
      if(plyr[socket.id].updateState(data)){
        /*console.log("DISCONNECTED!!!");
        socket.disconnect();*/
      }
    }/*else{
      plyr[socket.id] = new Player(socket.id);
      plyrID.push(socket.id);
    }*/
  });
  socket.on('requestConfig', function(name){
    console.log(`=> player [ ${name} ] joined! - cID: ${socket.id}`);
    name.replace(/\n/g, "");
    if(!name || name === "") name = defaultNames[plyrID.length % defaultNames.length];
    plyrID.push(socket.id);
    plyr[socket.id] = new Player(socket.id, name.substr(0, 16), 0);
    io.to(socket.id).emit('setConfig', config);
  });
  socket.on('disconnect', function(reason){
    delete IPs[socket.request.connection.remoteAddress];
    disconnect(socket.id, reason);
  });
});

server.listen(process.env.PORT || 3000, '0.0.0.0', function(){
  console.log("Express server listening on port %d in %s mode", this.address().port, app.settings.env);
  console.log(`Running at ${(1e3/Math.round(1e3 / config.targetFrameRate)).toFixed(2)}FPS`);
});

setInterval(update, Math.round(1e3 / config.targetFrameRate));
if(config.broadcastInterval) setInterval(broadcastData, config.broadcastInterval);
