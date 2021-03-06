var express = require('express');
var app = express();
var dbus = require('dbus-native');
var fs = require("fs");
var server = require('http').Server(app);
var sio = require('socket.io')(server);
var util = require('util');
var Wireless = require("wireless");
var config = require("./config");

//	Setup dbus…

var name = "com.latencyzero.podtique.ui";

//	On OS X, launchd should've assigned us a socket path
//	to use in DBUS_LAUNCHD_SESSION_BUS_SOCKET. So, if that exists,
//	construct a dbus address from it.

var bus;
if (process.env.DBUS_LAUNCHD_SESSION_BUS_SOCKET)
{
	console.log("Connecting to sessionBus 'unix:path=" + process.env.DBUS_LAUNCHD_SESSION_BUS_SOCKET.toString() + "'");
	bus = dbus.sessionBus({ socket : process.env.DBUS_LAUNCHD_SESSION_BUS_SOCKET });
	//bus = dbus.sessionBus({ busAddress : "unix:path=" + process.env.DBUS_LAUNCHD_SESSION_BUS_SOCKET.toString() });
	//bus = dbus.createConnection({ busAddress : "launchd:env=DBUS_LAUNCHD_SESSION_BUS_SOCKET" });
}
else
{
	bus = dbus.sessionBus();
}

bus.connection.on('message', function(inMsg)
{
	//console.log("dbus msg: " + JSON.stringify(inMsg));
	
	if (inMsg.destination === name
		//&& inMsg["interface"] === "com.latencyzero.podtique"
		&& inMsg.member === "RadioStatus")
	{
		console.log("RadioStatus: " + inMsg.body);
		
		var radioOn = inMsg.body[0];
		if (radioOn)
		{
			sio.emit("radioOn", "true");
		}
		else
		{
			sio.emit("radioOff", "false");
		}
	}
});

//	Advertise our bus…

bus.requestName(name, 0);

function
setRadioStatus(inOn)
{
	bus.invoke({
		path: "/com/latencyzero/podtique",
		destination: "com.latencyzero.podtique",
		interface: "com.latencyzero.podtique",
		member: "RadioStatus",
		signature: "b",
		body: [inOn]
	});
}

//	Look for wireless networks…

var wifi = new Wireless({ iface : "en0" });
wifi.enable(function(inError)
{
	if (inError)
	{
		console.log("Error enabling wifi: " + inError);
		return;
	}
	
	wifi.start();
});

wifi.on("error", function(inMsg)
{
	//console.log("Wifi error " + inMsg);
});

wifi.on("appear", function(inNetwork)
{
	var ssid = inNetwork.ssid || "<HIDDEN>";
	console.log("New network: " + ssid);
});

//	Set up the server…

server.on("error", function(inErr)
{
	console.log("net.Server encountered an error: " + inErr);
});

//	Serve up static files…

app.use(express.static("public"));

//	Set up Socket.io…

sio.sockets.on('connection', function(inSocket)
{ 
	console.log('a user connected');
	
	//	Remember the socket (I think I have to remember all sockets)…
	
	app.locals.socket = inSocket;
	
	inSocket.on('disconnect', function()
	{
		console.log('user disconnected');
	});
	
	inSocket.on("radioOn", function()
	{
		console.log("radioOn");
		//console.log(util.inspect(this));
		app.locals.radioState = true;
		setRadioStatus(true);
	});
	
	inSocket.on("radioOff", function()
	{
		console.log("radioOff");
		app.locals.radioState = false;
		setRadioStatus(false);
	});
});

//	Our routes…

var home = require(__dirname + "/controllers/home");
app.get("/", home.index);
var stations = require(__dirname + "/controllers/stations");
app.get("/stations", stations.index);
var settings = require(__dirname + "/controllers/settings");
app.get("/settings", settings.index);

//	Our REST API…

app.get("/api/v1", function(inReq, inResp)
{
	inResp.send("Radio API is running");
});

app.get("/api/v1/spectrum", function(inReq, inResp)
{
	//	Read the current spectrum file…
	
	console.log("Serving spectrum file: " + config.spectrumPath);
	fs.readFile(config.spectrumPath, 'utf8', function(inErr, inData)
	{
		if (inErr) throw inErr;
		
		//	Iterate through the stations, and make an array
		//	of them (without the playlist information)…
		
		var stations = [];
		var spectrum = JSON.parse(inData);
		for (var i = 0; i < spectrum.length; ++i)
		{
			var station = spectrum[i];
			var retStation = { desc : station.desc, freq : station.freq };
			console.log("Station: " + retStation.desc);
			stations.push(retStation);
		}
		inResp.send(stations);
	});
});

var multer = require("multer");
var upload = multer({dest : "./content/" });
app.post("/file-upload", upload.array("file"), function(inReq, inResp)
{
	console.log(inReq.files);
});

//	Start the server…

server.listen(8080, function()
{
	var host = server.address().address;
	if (host === "::") host = "localhost";
	var port = server.address().port;
	console.log("PodtiqueUI listening on http://%s:%s", host, port);
});
