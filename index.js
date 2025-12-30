const express = require('express');
const app = express();
const http = require('http');
const fs = require('fs');
const defaultNames = "anonymous pilot".split(':');
const reservedCharacters = new RegExp('^[\u0000-\u001F]*$', 'g');

app.use(express.static('./public'));

const server = http.createServer(app);
const io = require('socket.io')(server);

const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

const U_MISSILE = 0, TWIN = 1, GATLING = 2, SHOTGUN = 3, RAIL = 4, ASSAULT = 5;
const MISSILE = 0, BURST = 1;
const FFA = 0, TDM = 1;
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
      dmg: [48, 15, 7, 6, 44, 8],
      muV: [-2, 22, 24, 18, 42, 34],
      // muzzle velocity
      rec: [4, 4, 0.7, 8, 5, 1],
      // recoil
      kb: [14, 4, 1, 2, 4, 1],
      // knockback
      rof: [35, 12, 3, 65, 50, 24],
      cs: [2, 14, 42, 3, 3, 30],
      //clip size
      rlt: [90, 150, 240, 250, 160, 200],
      //reload time
      range: [600, 480, 550, 300, 1200, 550],
      pierce: [1, 1, 1, 1, 3, 1],
      hbs: [28, 24, 18, 16, 22, 24],
      pro: [[2, 10], null, null, null, null, null],
      // propulsion [ float strength , int duration , int homingDuration , int homingSpeed ]
      expl: [0.4, 0, 0, 0, 0.8, 0]
      // explosive
    },
    sw: {
      dmg: [48, 16],
      muV: [-12, 10],
      rec: [-8, 14],
      kb: [15, 2],
      rof: [250, 400],
      range: [230, 800],
      pierce: [1, 1],
      hbs: [24, 18],
      pro: [[0.4, 24, 200, 1], [0.8, 10, 100, 0.8]],
      expl: [1.2, 0.6]
    },
  }
};
let keySet = {};
for(let i = 0; i < keys.length; i ++){
  keySet[keys[i]] = false;
}

const TWO_PI = Math.PI*2;
const r2bk = 255/TWO_PI;
const r2bk16 = 65535/TWO_PI;
const constrain = (x, min, max) => Math.max(Math.min(x, max), min);
const cd = (x, y) => Math.min(Math.abs(x - y), TWO_PI - Math.abs(x - y)); // circular distance
const dir = (x, y) => cd(x, y+1) < cd(x, y-1) ? 1 : -1;
const activeRooms = [];
let roomCount = 32;

const IPs = {};

function GameRoom(type){
  this.type = type;
  this.plyr = {};
  this.plyrID = [];
  this.projectiles = [];
  this.playerIdCounter = 0;
  this.playerNameList = [];
  this.socketRoom = String.fromCharCode(roomCount++);
  if(type === TDM) this.teams = [[], []];
  this.broadcast = true;
  this.id = roomCount-32;
  this.resume();
}
GameRoom.prototype.resume = function(){
  this.updateInterval = setInterval(this.update.bind(this), Math.round(1e3 / config.targetFrameRate));
  if(config.broadcastInterval) this.broadcastInterval = setInterval(this.broadcastData.bind(this), config.broadcastInterval);
};
GameRoom.prototype.pause = function(){
  clearInterval(this.updateInterval);
  clearInterval(this.broadcastInterval);
};
GameRoom.prototype.broadcastData = function(){
  this.broadcast = true;
};
GameRoom.prototype.update = function(){
  for(let i = this.plyrID.length-1; i >= 0; i--){
    let socketID = this.plyrID[i];
    let self = this.plyr[socketID];
    if(self.update()){
      this.projectiles.push({type: "expl", c: 0, a: 2, x: self.x, y: self.y, returnData: Projectile.prototype.returnData, update: function(){ return this.c++;}});
      self.respawn();
      continue;
    }
    // Checking from index of all tokenids, call from object and update.
    if(this.broadcast || !config.broadcastInterval){
      let playerList_local = this.plyrID.slice(0);
      playerList_local.splice(i, 1);
      //let data = `${self.returnData_p()}\u001D${playerList_local.join('\u001F')}` + data_const;
      const ab = new ArrayBuffer(4 + 20*this.plyrID.length + 8*this.projectiles.length);
      const p8i = new Uint8Array(ab, 0, 1);
      p8i[0] = this.plyrID.length;
      const p32 = new Uint32Array(ab, 4, 1);
      p32[0] = self.score;
      const p16 = new Uint16Array(ab, 8, 4);
      p16[0] = ~~self.x;
      p16[1] = ~~self.y;
      p16[2] = self.kills;
      p16[3] = ~~(self.a*r2bk16);
      const p8 = new Uint8Array(ab, 16, 5);
      //p8[0] = ~~(self.a*r2bk);
      p8[1] = self.ap;
      p8[2] = self.sp;
      p8[3] = (Math.min(self.pwr, 1) << 0 | Math.min(self.swr, 1) << 1 | Math.min(self.pwrltcd, 1) << 2);
      p8[4] = self.pwam;
      const ps8 = new Int8Array(ab, 21, 3);
      ps8[0] = ~~(self.xv*10);
      ps8[1] = ~~(self.yv*10);
      ps8[2] = ~~(self.av*1000);

      for(let i = 0; i < playerList_local.length; i ++){
        const d = this.plyr[playerList_local[i]].returnData();
        const a32 = new Uint32Array(ab, 24+i*20, 1);
        a32[0] = d[0];
        const a16 = new Uint16Array(ab, 28+i*20, 3);
        for(let x = 0; x < 3; x ++) a16[x] = d[1+x];
        const a8 = new Uint8Array(ab, 34+i*20, 5);
        for(let x = 0; x < 5; x ++) a8[x] = d[4+x];
        const as8 = new Int8Array(ab, 39+i*20, 3);
        for(let x = 0; x < 3; x ++) as8[x] = d[9+x];
      }
      const projectile_start = 4 + 20*this.plyrID.length;
      for(let i = 0; i < this.projectiles.length; i ++){
        const d = this.projectiles[i].returnData();
        const a16 = new Uint16Array(ab, projectile_start+i*8, 2);
        for(let x = 0; x < 2; x ++) a16[x] = d[x];
        const a8 = new Uint8Array(ab, projectile_start+4+i*8, 4);
        for(let x = 0; x < 4; x ++) a8[x] = d[x+2];
      }
      io.to(socketID).emit('update', ab);
    }
  }
  for(let i = this.projectiles.length-1; i >= 0; i--){ // reverse parse to ignore added this.projectiles (explosion indicators)
    let self = this.projectiles[i];
    if(self.update()){
      if(self.expl){
        //this.projectiles.push({type: "expl", c: 0, a: self.expl, x: self.x, y: self.y, returnData: Projectile.prototype.returnData, update: function(){ return this.c++;}});
        this.projectiles.push(new ExplosionMarker(self.expl, self.x, self.y));
      }
      this.projectiles.splice(i, 1);
      continue;
    }
    if(self.type == 'expl') continue;
    for(let j = 0; j < this.plyrID.length; j ++){
      if(self.plyr.socket.id === this.plyrID[j]) continue;
      let that = this.plyr[this.plyrID[j]];
      if(this.type === TDM && (self.plyr.id & 128) == (that.id & 128)) continue; // same affiliation value means no friendly fire
      //if(dist(self.x, self.y, that.x, that.y) < 9){
      if(Math.abs(self.x - that.x) < 24 && Math.abs(self.y - that.y) < 24){
        if(self.plyr){
          self.plyr.score += self.dmg;
          if(that.damage(self.dmg, self.plyr)) self.plyr.kills ++;
        }
        const s = Object.assign(self); // not sure if Object.assign is needed here
        if(s.kb){
          that.xv += s.kb * Math.cos(s.a);
          that.yv += s.kb * Math.sin(s.a);
        }
        if(!(--self.pierce)) break;
      }
    }
  }
  this.broadcast = false;
};
GameRoom.prototype.disconnect = function(socketid, reason){
  console.log(` < disconnection! [ ${reason} ] cID: ${socketid}`);
  if(this.plyr[socketid]){
    this.playerNameList[this.plyr[socketid].id] = "";
    if(this.type === TDM) this.teams[!!(this.plyr[socketid].id&128)|0].splice(this.plyrID.indexOf(socketid), 1);
  }
  delete this.plyr[socketid];
  this.plyrID.splice(this.plyrID.indexOf(socketid), 1);
};

function Projectile(source, type, pID, angleOffset){
  this.x = source.x;
  this.y = source.y;
  this.a = source.a + angleOffset;
  this.xv = Math.cos(this.a) * stats.wep[type].muV[pID] + source.xv;
  this.yv = Math.sin(this.a) * stats.wep[type].muV[pID] + source.yv;
  this.kb = stats.wep[type].kb[pID];
  this.dmg = stats.wep[type].dmg[pID];
  this.pierce = stats.wep[type].pierce[pID];
  this.type = type;
  this.id = pID;
  this.expl = stats.wep[type].expl[pID];
  if(stats.wep[type].pro[pID]){
    this.pro = stats.wep[type].pro[pID];
    let seekingList = source.room.type === TDM ? source.room.teams[!(source.id&128)|0] : source.room.plyrID;
    if(this.pro[2] && seekingList.length){
      let dists = [];
      for(let i = 0; i < seekingList.length; i ++){
        let p = source.room.plyr[seekingList[i]];
        if (p) { // maybe someone disconnects before lock-on can work
          dists.push({P: seekingList[i], d: Math.abs((p.x+p.xv*3) - this.x) + Math.abs((p.y+p.yv*3) - this.y)});
        }
      }
      if (dists.length) {
        this.target = source.room.plyr[dists.sort((a, b) => a.d - b.d)[source.room.type === TDM ? 0 : 1].P];
      }
    }
  }
  this.d = stats.wep[type].range[pID];
  this.f = 0;
  this.v = Math.max(stats.wep[type].muV[pID], 1);
  this.plyr = source;
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
  return (this.d < 0 || !this.pierce || this.x < 0 || this.y < 0);
};
Projectile.prototype.returnData = function(){
  return [~~this.x, ~~this.y, ~~(this.a*r2bk), PARTICLECODE[this.type], (this.id||0), Math.min(255, this.d||0)];
};
function ExplosionMarker(a, x, y){
  this.type = "expl";
  this.c = 0;
  this.a = a;
  this.x = x;
  this.y = y;
}
ExplosionMarker.prototype.update = function(){
  return this.c ++;
};
ExplosionMarker.prototype.returnData = Projectile.prototype.returnData;
function Player(gameroom, socket, name, score){
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
  this.id = (gameroom.playerIdCounter++)%128;
  if(gameroom.type === TDM){
    this.id = this.id | (Math.random()>0.5 ? 128 : 0); // 128 is team affiliation
    gameroom.teams[!!(this.id&128)|0].push(socket.id);
  }
  this.socket = socket;
  this.room = gameroom;
  gameroom.playerNameList[this.id] = this.name;
  io.to(gameroom.socketRoom).emit('updateNameList', (this.id) + '\u001D' + name);
  socket.join(gameroom.socketRoom);
  socket.emit('updateS', this.returnData_ps());
  socket.emit('name', this.name);
  socket.compress(true).emit('nameList', gameroom.playerNameList.join('\u001D'));
}
Player.prototype.fireBullets = function(type, pID, angleOffset, repeat){
  while(repeat--){
    this.room.projectiles.push(new Projectile(this, type, pID, Math.random()*angleOffset-angleOffset/2, repeat));
  }
  this.xv -= Math.cos(this.a) * stats.wep[type].rec[pID];
  this.yv -= Math.sin(this.a) * stats.wep[type].rec[pID];
};
Player.prototype.update = function(){
  if(this.state & 1 | this.state & 2){
    this.xv += Math.cos(this.a) * stats.accel * (1-0.6*(this.state & 2));
    this.yv += Math.sin(this.a) * stats.accel * (1-0.6*(this.state & 2));
  }
  if(this.state & 4 | this.state & 8) this.av += stats.ts * (1 - ((this.state & 4) >> 1));

  ++this.pwr;
  ++this.swr;
  if(this.state & 16 && this.pwr > this.pwtr && this.pwam > 0){
    this.pwam --;
    this.pwr = 0;
    switch(this.pw){
      case U_MISSILE:
        this.fireBullets('pw', this.pw, 0, 1);
        break;
      case TWIN:
        this.fireBullets('pw', this.pw, 0, 1);
        break;
      case GATLING:
        this.fireBullets('pw', this.pw, 0.4, 1);
        break;
      case SHOTGUN:
        this.fireBullets('pw', this.pw, 0.6, 12);
      break;
      case RAIL:
      case ASSAULT:
        this.fireBullets('pw', this.pw, 0, 1);
        break;
    }
  }
  if(this.pwam < 1){
    if(this.pwrltcd++ > this.pwrlt){
      this.pwam = this.pwcs;
      this.pwrltcd = 0;
    }
  }else{
    // delayed firing weapons
    if(this.state & 16 && this.pwam > 0){
      switch(this.pw){
        case ASSAULT:
          if(this.pwr & 2 && this.pwr < 9){
            this.pwam --;
            this.fireBullets('pw', this.pw, 0.1, 1);
          }
          break;
      }
    }
  }
  if(this.state & 32 && this.swr > this.swtr){
    this.swr = 0;
    switch(this.sw){
      case MISSILE:
      case BURST:
        this.fireBullets('sw', this.sw, 0.4 * this.sw, this.sw ? 7 : 1);
        break;
    }
  }
  if(--this.scd < 0) this.sp = Math.min(this.sp + 0.125, 100); // + 1/8
  if(this.scd < 0 && this.sp >= 100) this.ap = Math.min(this.ap + 0.0625, 100); // + 1/16
  this.x += this.xv;
  this.y += this.yv;
  this.a = (this.a + this.av + TWO_PI) % TWO_PI;
  this.xv /= 1.1;
  this.yv /= 1.1;
  this.av /= 1.1;
  if(this.x < 0) this.x = 0;
  if(this.y < 0) this.y = 0;
  if(this.x > config.width) this.x = config.width;
  if(this.y > config.height) this.y = config.height;
  if(this.ap < 1) this.ap = 0;
  return this.ap < 1;
};
Player.prototype.updateState = function(input){
  //if(isNaN(this.x) || isNaN(this.y) || isNaN(this.a)) return true; // I N V A L I D    M O V E M E N T   :hyperAngery:
  this.state = input.charCodeAt(0);
};
Player.prototype.returnData = function(){ // general form (Nonpersonal)
  return [this.score, ~~this.x, ~~this.y, this.kills, ~~(this.a*r2bk), this.ap, this.sp, (this.state & 1 | this.state & 2) ? 1 : 0, this.id, ~~(this.xv*10), ~~(this.yv*10), ~~(this.av*1000)];
};
Player.prototype.returnData_p = function(){ // personal
  return [this.score, ~~this.x, ~~this.y, this.kills, ~~(this.a*r2bk), this.ap, this.sp, (Math.min(this.pwr, 1) << 0 | Math.min(this.swr, 1) << 1 | Math.min(this.pwrltcd, 1) << 2), this.pwam, ~~(this.xv*10), ~~(this.yv*10), ~~(this.av*1000)];
};
Player.prototype.returnData_ps = function(){ // personal [static] (contains less dynamic player stats )
  const a8 = new Uint8Array(9);
  a8[4] = this.id;
  a8[5] = this.pw;
  a8[6] = this.sw;
  a8[7] = this.pwtr;
  a8[8] = this.pwcs;
  const a16 = new Uint16Array(a8.buffer, 0, 2);
  a16[0] = this.pwrlt;
  a16[1] = this.swtr;
  return a8.buffer;
}
Player.prototype.damage = function(dmg, src){
  if(!dmg) return;
  if(this.sp >= 1){
    this.scd = 150;
    this.sp = Math.max(0, this.sp - dmg);
  }else{
    this.scd = 600;
    this.ap -= dmg;
    if(this.dead === null) this.dead = true;
    if(this.ap < 1 && this.dead === false){
      this.dead = null;
      src.score += Math.round(this.score*.5 + this.kills*40);
    }
  }
  return this.ap < 1 && !this.dead;
};
Player.prototype.respawn = function(){
  this.x = Math.random()*config.width;
  this.y = Math.random()*config.height;
  this.a = 0;
  this.xv = 0;
  this.yv = 0;
  this.av = 0;
  this.ap = 100;
  this.sp = 100;
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
  this.score = Math.round(this.score*.5)
  this.dead = false;
  this.socket.emit('updateS', this.returnData_ps());
};

activeRooms.push(new GameRoom(TDM));

io.on('connection', function(socket){
  var address = socket.handshake.address;
  const room = activeRooms[~~(Math.random()*activeRooms.length)];
  console.log(' > new connection < ' + address + ' cID: ' + socket.id);
  if(!IPs[address]) IPs[address] = socket.id;

  socket.on('input', function(data){
    /*if(IPs[address] !== socket.id){
      io.sockets.connected[IPs[address]].disconnect();
      IPs[address] = socket.id;
      console.log(' < disconnected IP ' + address + ' cID: ' + socket.id);
      return;
    }*/
    if(room.plyr[socket.id]){
      if(room.plyr[socket.id].updateState(data)){
        /*console.log("DISCONNECTED!!!");
        socket.disconnect();*/
      }
    }/*else{ // remove the .'s, its just so it's easier to search for ".plyr"
      .plyr[socket.id] = new Player(socket.id);
      .plyrID.push(socket.id);
    }*/
  });
  socket.on('requestConfig', function(name){
    console.log(`=> Room${room.id} => player [ ${name} ] joined! - cID: ${socket.id}`);
    name.replace(reservedCharacters, "");
    if(!name || name === "") name = defaultNames[room.plyrID.length % defaultNames.length];
    room.plyrID.push(socket.id);
    room.plyr[socket.id] = new Player(room, socket, name.substr(0, 16), 0);
    socket.emit('setConfig', Object.assign({r: room.id, t: room.type}, config));
  });
  socket.on('disconnect', function(reason){
    delete IPs[address];
    room.disconnect(socket.id, reason);
  });
});

server.listen(process.env.PORT || 3000, '0.0.0.0', function(){
  console.log("Express server listening on port %d in %s mode", this.address().port, app.settings.env);
  console.log(`Running at ${(1e3/Math.round(1e3 / config.targetFrameRate)).toFixed(2)}FPS`);
});
