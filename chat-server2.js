var http = require("http"),
socketio = require("socket.io"),
fs = require("fs");

var usernames = {};				//map to hold username object. holds username and socket ID
var chatrooms = {};				//map to hold chatroom object. holds {name of room, creator of room, password of room if applicable, messages of room {user who sent message, color of message, message text}}

var app = http.createServer(function(req, resp){						//callback function that reads the files to be included in the JS 
	fs.readFile("mainPage.html", function(err, data){					//main html page
		if (req.url =='/chatroom.css'){									//css of chatroom file
			fs.readFile("chatroom.css", function(err, data){
				if (err) console.log(err);
				resp.writeHead(200, {'Content-Type': 'text/css'});
				resp.write(data);
				resp.end();
			});
			
		}
		else if (req.url =='/spectrum.css'){							//css of color picker
			fs.readFile("spectrum.css", function(err, data){
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
app.listen(3456);														//establish port

var io = socketio.listen(app);
io.sockets.on("connection", function(socket){
	io.sockets.emit("updateRooms", chatrooms);							//on connection, emit update rooms to client. sends over chatrooms object
	socket.on('adduser', function(username){							//on addUser message from client 
		if (username == "") {											//if username is null, send error message
			socket.emit("reprompt", "Username cannot be empty");
		}
		else if (username in usernames) {								//if username already exists, send error message
			socket.emit("reprompt", "Username already exists");
		}
		else {
			socket.username = username;									//else set socket username to username, and add username and id of socket into object
			usernames[username] = socket.id;
		}
	});


	//message handlers---------------------------------------------------------------------------------------
	socket.on('message_to_server', function(data) {						//when client sends message and server recieves the message
		chatrooms[socket.room].messageLog.push({						//write the message into the messageLog for the room. stores all messages passed in.
			"username" : socket.username, 
			"color" : data["color"], 
			"message" : data["message"]
		});
		io.sockets.in(socket.room).emit("message_to_client", socket.username, {message:data["message"], color:data["color"]}) 	// broadcast the message to other users in the same room
	});

	socket.on('roomCreator', function(username) {						//when server gets request to find who created the room
		if (socket.username == chatrooms[socket.room].creator) {		//if username of the socket is the creator of the room, then emit true
			socket.emit("roomCreatorRes", true, username);
		}
		else {															//else emit false
			socket.emit("roomCreatorRes", false, username);
		}
	});

	socket.on('prv_message_to_server', function(data) {					//when private message is passed to server
		io.sockets.in(socket.room).emit("prv_message_to_client", socket.username, {message:data["message"] }) 					// broadcast the message to other user
	});

	//chatroom handlers---------------------------------------------------------------------------------------
	socket.on('addChatroom', function(chatName) {						//on add chatroom 
		var match = false;
		for (var room in chatrooms) { 									//if room already exists
			if (room == chatName) {
				match = true;
			};
		};
		if (match) {													//emit error message
			socket.emit("usageMessage", "chatroom already exists");
		}
		else if ((chatName == "") || (chatName == null)) {						//if room name is empty, emit error message
			socket.emit("usageMessage", "you cannot type in an empty value");
		}
		else {
			chatrooms[chatName] = { 						//enter name of room into map with following elements
				"creator" : socket.username,				//creator as the username of the socket
				"banned" : [],								//banned array, initially empty
				"password" : false,							//not a protected chat, so no password
				"passwordValue" : "",
				"messageLog" : []							//empty message log
			};
			io.sockets.emit("updateRooms", chatrooms);		//update rooms on client side
		};
	});

	socket.on('addProtectedChatroom', function(password, chatName) {			//same procedure as above, except with a password
		var match = false;
		for (var room in chatrooms) {
			if (room == chatName) {
				match = true;
			};
		};
		if (match) {
			socket.emit("usageMessage", "chatroom already exists");
		}
		else if ((chatName == "") || (chatName == null)) {
			socket.emit("usageMessage", "you cannot type in an empty value");
		}
		else if ((password == "") || (password == null)) {						//if password is empty, emit error message, password cannot be empty
			socket.emit("usageMessage", "password cannot be empty");
		}
		else {
			chatrooms[chatName] = {								//else add room into chatroom object
				"creator" : socket.username,
				"banned" : [],
				"password" : true,								//room requires password, so password bool is true
				"passwordValue" : password,						//password value is password
				"messageLog" : []
			};
			io.sockets.emit("updateRooms", chatrooms);
		};
	});

	socket.on('prvMsg', function(username) {														//on initiating a private message
		socket.join(String("prvMsg" + socket.username + username));									//socket joins room named after the concatenation of the two usernames
		io.sockets.connected[usernames[username]].emit("joinPrvChat", socket.username, username);	//emit to other client to join private chat
	});

	socket.on('prvMsgConfirm', function(otherUser) {						//when recieving this message, another client requested a private chat with you. 
		socket.join(String("prvMsg" + otherUser + socket.username));		//places you into room that is concatenation of the two usernames
	});

	socket.on('switchRoom', function(chatName) {				//when switching rooms
		var bannedList = chatrooms[chatName].banned;			//pull banned list of usernames from that chatroom
		var inList = false;
		for (var i = 0; i < bannedList.length; i++) {			//check to see if username is in banned list
			if (socket.username == bannedList[i]) {
				inList = true;
			};
		};
		if (inList) {											//if user is in banned list, close dialogue and emit error message
			socket.emit("closeDialogue");
			socket.emit("usageMessage", "You have been banned from this chatroom. You may not join.");
		}
		else {
			if (chatrooms[chatName].password){					//else, if the chatroom is password protected, ask user to verify password
				socket.emit('passwordVerify', chatName);
			}
			else {
				socket.broadcast.to(socket.room).emit('serverMessage', socket.room, "SERVER: " + socket.username + " has left the room");	//else, broadcast to old room that user has left the old room
				// chatrooms[socket.room].messageLog.push({
				// 	"username" : "SERVER", 
				// 	"color" : "#000000", 
				// 	"message" : socket.username + " has left the room"
				// });
				socket.leave(socket.room);			//leave old room
				socket.join(chatName);				//join new room
				socket.room = chatName;				//room of socket is new room
				socket.broadcast.to(socket.room).emit('serverMessage', socket.room, "SERVER: " + socket.username + " has joined the room");	//broadcast to new room that user has joined new room
				// chatrooms[socket.room].messageLog.push({
				// 	"username" : "SERVER", 
				// 	"color" : "#000000", 
				// 	"message" : socket.username + " has joined the room"
				// });
			}
		}
	});
	socket.on('pullRecentData', function(room) {			//on request to pull recent data from server
		socket.emit('repopulateChat', chatrooms, room);		//send the chatrooms object
	});


	//password handlers-------------------------------------------------------------------------------------------------
	socket.on('verifiedPassword', function(password, chatName) {		//same as above, except with password
		if (password == chatrooms[chatName].passwordValue) {			//if password is verified, do the following (same as above)
			socket.broadcast.to(socket.room).emit('serverMessage', socket.room, "SERVER: " + socket.username + " has left the room");
			// chatrooms[socket.room].messageLog.push({
			// 		"username" : "SERVER", 
			// 		"color" : "#000000", 
			// 		"message" : socket.username + " has left the room"
			// 	});
			socket.leave(socket.room);
			socket.join(chatName);
			socket.room = chatName;
			socket.broadcast.to(socket.room).emit('serverMessage', socket.room, "SERVER: " + socket.username + " has joined the room");
			// chatrooms[socket.room].messageLog.push({
			// 		"username" : "SERVER", 
			// 		"color" : "#000000", 
			// 		"message" : socket.username + " has joined the room"
			// 	});
			console.log(socket.username + " is in " + socket.room);
		}
		else {
			socket.emit("usageMessage", "Incorrect Password");			//if password is incorrect, emit error
			socket.emit("closeDialogue");
		}
	});



	//user action handlers---------------------------------------------------------------------------------------------
	socket.on('kickUser', function(username) {									//if client emits kick username from room,
		if (io.sockets.connected[usernames[username]] != "undefined") {
			io.sockets.connected[usernames[username]].emit("confirmKickUser");	//emit message to kicked client to kick client from chat and produce message saying that have been kicked
			io.sockets.connected[usernames[username]].emit("usageMessage", "You have been kicked from this chat room");
		}
		else {
			socket.emit("usageMessage", "User is not found or has already been kicked");
		}
	});
	socket.on('kickUserServer', function() {										//on return of kick client from server
		socket.broadcast.to(socket.room).emit('serverMessage', socket.room, socket.username + " has been kicked from the room");	//broadcast to rooms that client has been kicked
		chatrooms[socket.room].messageLog.push({							//push message into chatlog from server that client has been kicked 
			"username" : "SERVER", 
			"color" : "#000000", 
			"message" : socket.username + " was kicked from the chatroom"
		});
		socket.leave(socket.room);					//force socket to leave room
		socket.room = '';
	});
	socket.on('banUser', function(username) {			
		if (io.sockets.connected[usernames[username]] != "undefined") {								
			io.sockets.connected[usernames[username]].emit("confirmBanUser");
			io.sockets.connected[usernames[username]].emit("usageMessage", "You have been banned from this chat room");
		}
		else {											
			socket.emit("usageMessage", "User is not found or has already been banned");
		}
	});
	socket.on('banUserServer', function() {				//same as above "kickUserServer"
		socket.broadcast.to(socket.room).emit('serverMessage', socket.room, socket.username + " has been banned from the room");
		chatrooms[socket.room].messageLog.push({
			"username" : "SERVER", 
			"color" : "#000000", 
			"message" : socket.username + " was banned from this chatroom"
		});
		chatrooms[socket.room].banned.push(socket.username); //push user into banned array of chatroom
		socket.leave(socket.room);
		socket.room = '';
		console.log(chatrooms);
	});
	socket.on('logOut', function(){						//on user logout
		socket.broadcast.to(socket.room).emit('serverMessage', socket.room, socket.username + " has logged out");	//broadcast message to rooms client was in that they have logged out
		socket.leave(socket.room);
		delete usernames[socket.username];				//delete username from usernames object
		socket.room = '';
	})
});
