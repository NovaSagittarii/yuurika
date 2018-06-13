const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

app.use(express.static(__dirname + '/public'));

var active = 0;

io.on('connection', function(socket){
  console.log(' > new connection! cID: ' + socket.id);
  setTimeout(function(){socket.broadcast.emit('nP', ++active);}, 1000);

  socket.on('keydown', function(msg){
    console.log('keydown ' + msg);
  });
  socket.on('mD', mouseMsg);
  function mouseMsg(data){
    socket.broadcast.emit('mD', data);
  }
  socket.on('disconnect', function(){
    console.log(' < disconnection!  cID: ' + socket.id);
    socket.broadcast.emit('nP', --active);
  });
});

http.listen(3000, '0.0.0.0', function(){
  console.log('listening on *:3000');
});
