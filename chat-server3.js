// Require the packages we will use:
var http = require("http"),
socketio = require("socket.io"),
fs = require("fs");

var usernames = [];
var chatrooms = [];

// Listen for HTTP connections.  This is essentially a miniature static file server that only serves our one file, client.html:
var app = http.createServer(function(req, resp){
	// This callback runs when a new connection is made to our HTTP server.
	fs.readFile("mainPage1.html", function(err, data){
		// This callback runs when the client.html file has been read from the filesystem.
		if (req.url =='/chatroom.css'){
			fs.readFile("chatroom.css", function(err, data){
				if (err) console.log(err);
				resp.writeHead(200, {'Content-Type': 'text/css'});
				resp.write(data);
				resp.end();
			});
			
		}
		else{
			if(err) return resp.writeHead(500);
			resp.writeHead(200);
			resp.write(data);
			resp.end();
		}
	});
});
app.listen(3456);

// Do the Socket.IO magic:
var io = socketio.listen(app);
io.sockets.on("connection", function(socket){
	// This callback runs when a new Socket.IO connection is established.
	io.sockets.emit("updateRooms", chatrooms);
	socket.on('adduser', function(username){
		// store the username in the socket session for this client
		socket.username = username;
	});
	socket.on('message_to_server', function(data) {
		io.sockets.in(socket.room).emit("message_to_client", socket.username, {message:data["message"] }) // broadcast the message to other users
	});
	socket.on('addChatroom', function(chatName) {
		var match = false;
		chatrooms.forEach(function(room){
			if (room == chatName) {
				match = true;
			};
		});
		if (match) {
			io.sockets.emit("usageMessage", "chatroom already exists");
		}
		else if (chatName == "") {
			io.sockets.emit("usageMessage", "you cannot type in an empty value");
		}
		else {
				console.log(chatrooms);
				io.sockets.emit("confirmAddChatroom", chatName);
				chatrooms.push(chatName);
				io.sockets.emit("updateRooms", chatrooms);
			};
		});
	socket.on('switchRoom', function(chatName) {
		socket.leave(socket.room);
		socket.join(chatName);
		socket.room = chatName;
		console.log(socket.username + " is in " + socket.room);
	});

});
