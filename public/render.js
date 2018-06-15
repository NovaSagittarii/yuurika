const PELLET = 0, TWIN = 1, GATLING = 2, SHOTGUN = 3;
const MISSILE = 0;
const EXHAUST = 0;
var pDecay = [10];
var particles = [];

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
      this.v /= 1.02;
      fill(255, this.d, 0, this.d*1.4);
      //rect(0, 0, 100, 100);
      triangle(10, 0, -5, 8.6, -5, -8.6);
      break;
  }
  pop();
  this.d -= pDecay[this.t];
  return this.d < 0;
}

function draw() {
  background(0, 0, 0);
  strokeWeight(2);
  noStroke();
  fill(255, 255, 255);
  //rect(0, 0, 700, 50);
  //fill(0, 0, 0);
  textSize(12);
  text(`${~~frameRate()}FPS\n ${~~config.targetFrameRate}`, 30, 20);
  text(plyrs.length+1 + " active users\n\nWASD - movement\nJ - primary weapon\nK - secondary weapon", width/2, 50);

  translate(~~(width/2), ~~(height/2));
  rotate(3/2*Math.PI - a + av);
  translate(-x, -y);

  for(let i = 0; i < particles.length; i ++){
    if(particles[i].process()){
      particles.splice(i, 1);
    }
  }

  fill(255, 150, 150);
  for(let i = 0; i < plyrs.length; i ++){
    let plyr = plyrs[i];
    push();
    translate(plyr.x, plyr.y);
    rotate(plyr.a);
    triangle(10, 0, -10, -7, -10, 7);
    rotate(-plyr.a + a + Math.PI/2);

    fill(255, 0, 0, 100);
    rect(-25+25*plyr.ap/100, -20, 50*plyr.ap/100, 3);
    fill(100, 100, 255, 100);
    rect(-25+25*plyr.sp/100, -23, 50*plyr.sp/100, 3);

    pop();
    if(plyr.accel) particles.push(new Particle(plyr.x, plyr.y, Math.random()*Math.PI*2, plyr.a + Math.random()*0.5-0.25, -3, 0, EXHAUST));
  }
  fill(200);
  for(let i = 0; i < projectiles.length; i ++){
    let obj = projectiles[i];
    push();
    translate(obj.x, obj.y);
    rotate(obj.a);
    switch(obj.type){
      case "pw":
        switch(obj.id){
          case PELLET:
          case TWIN:
          case SHOTGUN:
            rect(0, 0, 9, 4);
            break;
          case GATLING:
            rect(0, 0, 6, 3);
            break;
        }
        break;
      case "sw":
        switch(obj.id){
          case MISSILE:
            quad(14, 0, -14, 10, -8, 0, -14, -10);
            break;
        }
        break;
    }
    pop();
  }

  stroke(255, 255, 255, 20);
  noFill();
  rect(config.width/2, config.height/2, config.width, config.height);

  translate(x, y);
  rotate(a);

  fill(255, 255, 255);
  triangle(10, 0, -10, -7, -10, 7);
  resetMatrix();
  if(keys.w || keys.s){
    xv += Math.cos(a) * accel * (1-1.2*keys.s);
    yv += Math.sin(a) * accel * (1-1.2*keys.s);
    particles.push(new Particle(x, y, Math.random()*Math.PI*2, a + Math.random()*0.5-0.25, -3, 0, EXHAUST));
  }
  if(keys.a || keys.d) av += ts * (1-2*keys.a);
  x += xv;
  y += yv;
  a += av;
  xv /= 1.1;
  yv /= 1.1;
  av /= 1.1;
  quad(mouseX, mouseY, mouseX, mouseY + 15, mouseX + 5, mouseY + 10, mouseX + 10, mouseY + 10);

  //---- GUI ----
  noStroke();
  fill(255, 255, 255, 50);
  rect(185, height-50, 300, 30, 5);
  fill(255, 0, 0, 100);
  rect(40+145*ap/100, height-50, 290*ap/100, 20, 5);
  fill(100, 100, 255, 200);
  rect(40+145*sp/100, height-50, 290*sp/100, 20, 5);

  fill(255, 255, 255, 50);
  ellipse(width-120, height-50, 50, 50);
  ellipse(width-50, height-50, 50, 50);
  textSize(18);
  text("J", width-95, height-25);
  text("K", width-25, height-25);
  strokeWeight(4);
  noFill();
  stroke(255, 255, 255, 100)
  arc(width-120, height-50, 50, 50, 0, Math.PI*2*constrain(pwr/pwrof, 0, 1));
  arc(width-50, height-50, 50, 50, 0, Math.PI*2*constrain(swr/swrof, 0, 1));
  strokeWeight(1);
}
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
