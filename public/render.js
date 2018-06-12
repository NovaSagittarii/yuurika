var socket;

function setup() {
  createCanvas(400, 400);
  background(200);
  socket = io.connect('http://localhost:3000/');
  socket.on('mD', update);
}

function draw() {
  //background(220);
  stroke(0, 0, 0, 50);
  //line(mouseX, mouseY, pmouseX, pmouseY);
}

function update(data){
  if(data.senderID === socket.id) return;
  fill(240);
  noStroke();
  ellipse(data.x, data.y, 15, 15);
}
function mouseDragged() {
  var data = {
    x: mouseX,
    y: mouseY,
    senderID: socket.id
  };
  socket.emit('mD', data);
  fill(255);
  noStroke();
  ellipse(mouseX, mouseY, 20, 20);
}
