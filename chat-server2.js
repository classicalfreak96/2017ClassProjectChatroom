// Require the packages we will use:
var http = require("http"),
socketio = require("socket.io"),
fs = require("fs");

var usernames = {};
var chatrooms = {};

// Listen for HTTP connections.  This is essentially a miniature static file server that only serves our one file, client.html:
var app = http.createServer(function(req, resp){
	// This callback runs when a new connection is made to our HTTP server.
	fs.readFile("mainPage.html", function(err, data){
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
		usernames[username] = socket.id;
	});


	//message handlers---------------------------------------------------------------------------------------
	socket.on('message_to_server', function(data) {
		io.sockets.in(socket.room).emit("message_to_client", socket.username, {message:data["message"] }) // broadcast the message to other users
	});
	socket.on('roomCreator', function(username) {
		console.log("user: " + socket.username + "|| room: " + socket.room + "|| creator: " + chatrooms[socket.room].creator)
		if (socket.username == chatrooms[socket.room].creator) {
			console.log("true emitted")
			socket.emit("roomCreatorRes", true, username);
		}
		else {
			console.log("false emitted")
			socket.emit("roomCreatorRes", false, username);
		}
	});
	socket.on('prv_message_to_server', function(data) {
		io.sockets.in(socket.room).emit("prv_message_to_client", socket.username, {message:data["message"] }) // broadcast the message to other users
	});

	//chatroom handlers---------------------------------------------------------------------------------------
	socket.on('addChatroom', function(chatName) {
		var match = false;
		for (var room in chatrooms) {
			if (room == chatName) {
				match = true;
			};
		};
		if (match) {
			socket.emit("usageMessage", "chatroom already exists");
		}
		else if (chatName == "") {
			socket.emit("usageMessage", "you cannot type in an empty value");
		}
		else {
			chatrooms[chatName] = {
				"creator" : socket.username,
				"banned" : [],
				"password" : false,
				"passwordValue" : "",
			};
			io.sockets.emit("updateRooms", chatrooms);
			console.log(chatrooms);
		};
	});
	socket.on('addProtectedChatroom', function(password, chatName) {
		var match = false;
		for (var room in chatrooms) {
			if (room == chatName) {
				match = true;
			};
		};
		if (match) {
			socket.emit("usageMessage", "chatroom already exists");
		}
		else if (chatName == "") {
			socket.emit("usageMessage", "you cannot type in an empty value");
		}
		else {
			chatrooms[chatName] = {
				"creator" : socket.username,
				"banned" : [],
				"password" : true,
				"passwordValue" : password,
			};
			io.sockets.emit("updateRooms", chatrooms);
			console.log(chatrooms);
		};
	});
	socket.on('prvMsg', function(username) {
		socket.join(String("prvMsg" + socket.username + username));
		io.sockets.connected[usernames[username]].emit("joinPrvChat", socket.username, username);
	});
	socket.on('prvMsgConfirm', function(otherUser) {
		socket.join(String("prvMsg" + otherUser + socket.username));
	});
	socket.on('switchRoom', function(chatName) {
		console.log(chatName + " clicked");
		var bannedList = chatrooms[chatName].banned;
		var inList = false;
		for (var i = 0; i < bannedList.length; i++) {
			if (socket.username == bannedList[i]) {
				inList = true;
			};
		};
		if (inList) {
			socket.emit("closeDialogue");
			socket.emit("usageMessage", "You have been banned from this chatroom. You may not join.");
		}
		else {
			if (chatrooms[chatName].password){
				socket.emit('passwordVerify', chatName);
			}
			else {
				socket.broadcast.to(socket.room).emit('serverMessage', socket.room, socket.username + " has left the room");
				socket.leave(socket.room);
				socket.join(chatName);
				socket.room = chatName;
				socket.broadcast.to(socket.room).emit('serverMessage', socket.room, socket.username + " has joined the room");
				console.log(socket.username + " is in " + socket.room);
			}
		}
	});


	//password handlers-------------------------------------------------------------------------------------------------
	socket.on('verifiedPassword', function(password, chatName) {
		if (password == chatrooms[chatName].passwordValue) {
			socket.broadcast.to(socket.room).emit('serverMessage', socket.room, socket.username + " has left the room");
			socket.leave(socket.room);
			socket.join(chatName);
			socket.room = chatName;
			socket.broadcast.to(socket.room).emit('serverMessage', socket.room, socket.username + " has joined the room");
			console.log(socket.username + " is in " + socket.room);
		}
		else {
			socket.emit("usageMessage", "Incorrect Password");
			socket.emit("closeDialogue");
		}
	});



	//user action handlers---------------------------------------------------------------------------------------------
	socket.on('kickUser', function(username) {
		if (io.sockets.connected[usernames[username]] != "undefined") {
			io.sockets.connected[usernames[username]].emit("confirmKickUser");
			io.sockets.connected[usernames[username]].emit("usageMessage", "You have been kicked from this chat room");
		}
		else {
			socket.emit("usageMessage", "User is not found or has already been kicked");
		}
	});
	socket.on('kickUserServer', function() {
		socket.leave(socket.room);
		socket.room = '';
	});
	socket.on('banUser', function(username) {
		var inList = false;
		var bannedList = chatrooms[socket.room].banned;
		for (var i = 0; i < bannedList.length; i++) {
			if (socket.username == bannedList[i]) {
				inList = true;
			};
		};
		if (io.sockets.connected[usernames[username]] != "undefined") {
			io.sockets.connected[usernames[username]].emit("confirmBanUser");
			io.sockets.connected[usernames[username]].emit("usageMessage", "You have been banned from this chat room");
		}
		else {
			socket.emit("usageMessage", "User is not found or has already been banned");
		}
	});
	socket.on('banUserServer', function() {
		chatrooms[socket.room].banned.push(socket.username);
		socket.leave(socket.room);
		socket.room = '';
		console.log(chatrooms);
	});
});
