// Require the packages we will use:
var http = require("http"),
	socketio = require("socket.io"),
	fs = require("fs");

// Listen for HTTP connections.  This is essentially a miniature static file server that only serves our one file, client.html:
var app = http.createServer(function(req, resp){
	// This callback runs when a new connection is made to our HTTP server.
	fs.readFile("mainPage.html", function(err, data){
		// This callback runs when the client.html file has been read from the filesystem.
		console.log("!!!!!!!");
			console.log(req.url);
		if (req.url =='/chatroom.css'){
			console.log("in CSS2");
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
	
	socket.on('message_to_server', function(data) {
		// This callback runs when the server receives a new message from the client.
		
		console.log("message: "+data["message"]); // log it to the Node.JS output
		io.sockets.emit("message_to_client",{message:data["message"] }) // broadcast the message to other users
	});
});


