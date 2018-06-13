var socket;
var aU = 0;

function updateUsers(active) {
  aU = active;
}
function update(data){
  if(data.senderID === socket.id) return;
  stroke(data.r*1.2, data.g*1.2, data.b*1.2);
  strokeWeight(4);
  line(data.x, data.y, data.px, data.py);
}

function draw() {

    noStroke();
    fill(255, 255, 255);
    rect(0, 0, 700, 50);
    fill(0, 0, 0);
    text(aU + " active users", 5, 25);
}

function setup() {
  createCanvas(1600, 1600);
  background(255, 255, 255);
  socket = io.connect('http://47.147.17.164:3000/');
  socket.on('mD', update);
  socket.on('nP', updateUsers);
  updateUsers();
}
function mouseDragged() {
  var data = {
    x: mouseX,
    y: mouseY,
    px: pmouseX,
    py: pmouseY,
    senderID: socket.id,
    r: socket.id.charCodeAt(0) + socket.id.charCodeAt(1),
    g: socket.id.charCodeAt(2) + socket.id.charCodeAt(3),
    b: socket.id.charCodeAt(4) + socket.id.charCodeAt(5)
  };
  socket.emit('mD', data);
  stroke(socket.id.charCodeAt(0) + socket.id.charCodeAt(1), socket.id.charCodeAt(3) + socket.id.charCodeAt(2), socket.id.charCodeAt(5) + socket.id.charCodeAt(4));
  strokeWeight(10);
  line(mouseX, mouseY, pmouseX, pmouseY)
}
