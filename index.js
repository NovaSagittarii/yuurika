const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
//const p5 = require('p5')

/*app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});*/

app.use(express.static(__dirname + '/public'));


io.on('connection', function(socket){
  console.log(' > new connection! cID: ' + socket.id);
  socket.on('keydown', function(msg){
    console.log('keydown ' + msg);
  });
  socket.on('mD', mouseMsg);
  function mouseMsg(data){
    socket.broadcast.emit('mD', data);
  }
  socket.on('disconnect', function(){
    console.log(' < disconnection! cID: ' + socket.id);
  });
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});
