const U_MISSILE = 0, TWIN = 1, GATLING = 2, SHOTGUN = 3, RAIL = 4, ASSAULT = 5;
const MISSILE = 0, BURST = 1;
const EXHAUST = 0, M_EXHAUST = 1;
var pDecay = [10, 15];
var particles = [];

var alignRotation = false;
var lastRUpdate = 255;

function Particle(x, y, va, a, v, av, type){
  this.x = x;
  this.y = y;
  this.a = a;  // velocity direction
  this.o = va; // Orientation (visual angle)
  this.v = v;
  this.av = av;
  this.t = type;
  this.d = 255;
}
Particle.prototype.process = function(){
  this.x += Math.cos(this.a) * this.v;
  this.y += Math.sin(this.a) * this.v;
  this.a += this.av;
  push();
  translate(this.x, this.y);
  rotate(this.o);
  switch(this.t){
    case EXHAUST:
    case M_EXHAUST:
      this.v /= 1.02;
      fill(255, this.d, 0, this.d*1.4);
      //rect(0, 0, 100, 100);
      scale(this.t===EXHAUST ? 1 : 0.6);
      triangle(10, 0, -5, 8.6, -5, -8.6);
      break;
  }
  pop();
  this.d -= pDecay[this.t];
  return this.d < 0; // returns true if to be removed
}

function compare(a,b) {
  if (a.val < b.val) return -1;
  if (a.val > b.val) return 1;
  return 0;
}
function draw() {
  if(keys.p){
    keys.p = !keys.p;
    alignRotation = !alignRotation;
    lastRUpdate = 255;
  }

  background(0, 0, 0);
  strokeWeight(2);
  noStroke();
  fill(255, 255, 255);
  //rect(0, 0, 700, 50);
  //fill(0, 0, 0);
  textSize(24);
  text(`${~~frameRate()}FPS\n ${~~config.targetFrameRate}`, 60, 40);
  text(`${plyrs.length ? plyrs.length+1 + " active users" : "You are alone.\nPerhaps you should invite a friend?"}`, width/2, 150);

  if(lastRUpdate){
    lastRUpdate -= 5;
    fill(255, 255, 255, lastRUpdate);
    text((alignRotation ? "Lock-to-Player" : "Fixed") + " Rotation (P)", width/2, 250);
  }

  //transformations to center player to center of screen and lock viewing orientation to face upwards
  translate(~~(width/2), ~~(height/2));
  rotate(3/2*Math.PI - (a - av) * alignRotation);
  translate(-x, -y);

  for(let i = 0; i < particles.length; i ++){
    if(particles[i].process()) particles.splice(i, 1);
  }

  fill(255, 150, 150);

  // renders all players
  textSize(12);
  let toSort = []; // initialize leaderboard
  for(let i = 0; i < plyrs.length; i ++){
    let plyr = plyrs[i];
    push();
    translate(plyr.x, plyr.y);
    rotate(plyr.a);
    /*stroke(100, 255, 255, plyr.sp);
    strokeWeight(2+plyr.sp/25);*/
    triangle(10, 0, -10, -7, -10, 7);

    rotate(Math.PI/2 - plyr.a + a*alignRotation);
    text(plyr.name, 0, 20);
    fill(255, 0, 0, 100);
    rect(-25+25*plyr.ap/100, -20, 50*plyr.ap/100, 3);
    fill(100, 100, 255, 100);
    rect(-25+25*plyr.sp/100, -23, 50*plyr.sp/100, 3);

    pop();
    if(plyr.accel) particles.push(new Particle(plyr.x - Math.cos(plyr.a)*15, plyr.y - Math.sin(plyr.a)*15, Math.random()*Math.PI*2, plyr.a + Math.random()*0.5-0.25, -3, 0, EXHAUST));
    toSort.push({val: plyr.kills, name: plyr.name});
  }
  toSort.push({val: kills, name: name}); // add player to leaderboard
  toSort.sort(compare).reverse(); // sort leaderboard

  noStroke();

  //render projectiles
  for(let i = 0; i < projectiles.length; i ++){
    let obj = projectiles[i];
    push();
    translate(obj.x, obj.y);
    rotate(obj.a);
    fill(200, obj.d*2);
    switch(obj.type){
      case "pw":
        switch(obj.id){
          case U_MISSILE:
            quad(10, 0, -10, 7, -6, 0, -10, -7);
            particles.push(new Particle(obj.x - Math.cos(obj.a) * 10, obj.y - Math.sin(obj.a) * 10, Math.random()*Math.PI*2, obj.a + Math.random()*0.3-0.15, -1, 0, M_EXHAUST));
            break;
          case TWIN:
          case SHOTGUN:
            rect(0, 0, 9, 4);
            break;
          case ASSAULT:
            rect(0, 0, 7, 3);
            break;
          case GATLING:
            rect(0, 0, 6, 3);
            break;
          case RAIL:
            rect(0, 0, 40, 2, 2);
            particles.push(new Particle(obj.x - Math.cos(obj.a) * 10, obj.y - Math.sin(obj.a) * 10, Math.random()*Math.PI*2, obj.a + Math.random()*0.3-0.15, -1, 0, M_EXHAUST));
        }
        break;
      case "sw":
        switch(obj.id){
          case MISSILE:
          case BURST:
            obj.id ? quad(7, 0, -7, 5, -4, 0, -7, -5) : quad(10, 0, -10, 7, -6, 0, -10, -7);
            particles.push(new Particle(obj.x - Math.cos(obj.a) * 10, obj.y - Math.sin(obj.a) * 10, Math.random()*Math.PI*2, obj.a + Math.random()*0.3-0.15, -1, 0, M_EXHAUST));
            break;
        }
        break;
      case "expl":
        for(let j = 0; j < 24*obj.a; j ++){
          particles.push(new Particle(obj.x, obj.y, Math.random()*Math.PI*2, Math.random()*Math.PI*2, Math.random()*5, 0, M_EXHAUST));
        }
        projectiles.splice(i, 1);
        break;
    }
    pop();
  }

  stroke(255, 255, 255, 30);
  noFill(); // draw bounding box
  rect(config.width/2, config.height/2, config.width, config.height);
  stroke(255, 255, 255, 16);
  rect(config.width/2, config.height/2, config.width+10, config.height+10);
  stroke(255, 255, 255, 8);
  rect(config.width/2, config.height/2, config.width+20, config.height+20);
  // render player
  translate(x, y);
  rotate(a);

  fill(255, 255, 255);
  /*stroke(100, 255, 255, sp);
  strokeWeight(2+sp/25);*/
  triangle(10, 0, -10, -7, -10, 7);
  resetMatrix();
  if(keys.w || keys.s){
    xv += Math.cos(a) * accel * (1-1.2*keys.s);
    yv += Math.sin(a) * accel * (1-1.2*keys.s);
    particles.push(new Particle(x - Math.cos(a) * 15, y - Math.sin(a) * 15, Math.random()*Math.PI*2, a + Math.random()*0.5-0.25, -3, 0, EXHAUST));
  }
  if(keys.a || keys.d) av += ts * (1-2*keys.a);
  x += xv;
  y += yv;
  a += av;
  xv /= 1.1;
  yv /= 1.1;
  av /= 1.1;
  fill(255, 255, 255, 100);
  noStroke();
  quad(mouseX, mouseY, mouseX, mouseY + 15, mouseX + 5, mouseY + 10, mouseX + 10, mouseY + 10);

  //---- GUI ----
  strokeCap(PROJECT);
  textSize(14);
  fill(255);
  text(name, width/2, height/2+20);
  textSize(18);
  fill(255, 255, 255, 50);
  rect(185, height-50, 300, 30, 5);
  fill(255, 0, 0, 100);
  rect(40+145*ap/100, height-50, 290*ap/100, 15, 5);
  text(Math.round(ap) + "AP", 55, height-75);
  fill(100, 100, 255, 200);
  rect(40+145*sp/100, height-50, 290*sp/100, 20, 5);
  text(Math.round(sp) + "SP", 315, height-75);

  fill(255, 255, 255, 200);
  text(kills + " kills", 55, height-100);

  // render leaderboard
  textSize(18);
  for(let i = 0; i < Math.min(toSort.length, 5); i ++){
    text(`#${i+1} - ${toSort[i].name} - ${toSort[i].val} kills`, width-250, 100+i*20);
  }

  fill(255, 255, 255, 50);
  ellipse(width-120, height-50, 50, 50);
  ellipse(width-50, height-50, 50, 50);

  fill(255, 255, 255, 125);
  textSize(12);
  text("ROCKET TWIN GATLING SHOTGUN RAIL ASSAULT".split(' ')[pw] + `\n${Math.round(ammo)} / ${clipsize}`, width-120, height-50);
  text("GUIDED\nMISSILE BURST".split(' ')[sw], width-50, height-50);
  textSize(18);
  text("J", width-95, height-25);
  text("K", width-25, height-25);
  strokeWeight(4);
  noFill();
  stroke(255, 255, 220, 100);
  arc(width-120, height-50, 54, 54, 0, Math.PI*2*constrain(ammo/clipsize, 0, 1));
  stroke(255, 255, 255, 100)
  arc(width-120, height-50, 46, 46, 0, Math.PI*2*constrain(pwr/pwrof, 0, 1));
  arc(width-50, height-50, 50, 50, 0, Math.PI*2*constrain(swr/swrof, 0, 1));
  if(this.reload){
    arc(width/2, height/2, 150, 150, 0, Math.PI*2*constrain(reload/reloadtime, 0, 1));
    strokeWeight(6);
    stroke(255, 255, 255, 40)
    arc(width/2, height/2, 150, 150, 0, Math.PI*2);
    noStroke();
    fill(255, 255, 255, 150);
    text("Reloading primary weapon...", width/2, height/2 + 100);
  }
  strokeWeight(1);
}
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
