var mongo = require('mongodb').MongoClient,
 readline = require('readline'),
  natural = require('natural'),
        _ = require('underscore');

var tokenizer = new natural.WordTokenizer(),
 globalPlayer = null,
      mongodb = null;


function movePlayer(command, direction) {
	var move = [];
	// right now we only process cardinal directions
	if (direction === 'north') 
		move = [0, -1];
	else if (direction === 'south') 
		move = [0, 1];
	else if (direction === 'east') 
		move = [1, 0];
	else if (direction === 'west')
		move = [-1, 0];
	else
		move = [0, 0];

	command.player.x += move[0];
	command.player.y += move[1];

	// now we need to update the player in the database
	var playerCollection = mongodb.collection('player');
	playerCollection.update({_id: command.player._id},
			{$set: {x: command.player.x, y: command.player.y}}, {w:1},
			function(err, success) {
		if (err) throw err;

		// if we were successful, lets update their location and send a response
		if (success) {
			getCurrentLocation(command, true);
		}
	});
}

function updatePlayerItems(player) {
	var playerCollection = mongodb.collection('player');
	playerCollection.update({_id: player._id},
			{$set: {items: player.items}}, {w:1},
			function(err, success) {
		if (err) throw err;

		// the player is saved, do nothing unless there's an error
		if (!success) {
			console.error("Couldn't save player: " + player.username);
			console.error(player);

	});
}

function processCommand(command) {
	command.command = tokenizer.tokenize(command.command.toLowerCase());

	// make things less verbose
	var verb = command.command[0];
	var obj = command.command[1];
	var player = command.player;
	var room = player.room;

	if (verb === 'get') {
		// would try to get an item
		if (typeof room.items[obj] !== 'undefined') {
			var available = room.items[obj].available(player);
			if (available === true) {
				// that item was available. get the item
				player.items[obj] = room.items[obj].name;
				command.reply(room.items[obj].get(player));
				// update the player
				updatePlayerItems(player);
			}
		}
	}
	else if (verb === 'go') {
		// would try to move in a direction
		if (typeof room.exits[obj] !== 'undefined') {
			var available = room.exits[obj].available(player);
			if (available === true) {
				// that direction was available, play the "go" message, then move them
				command.reply(room.exits[obj].go(player));
				// move the player
				movePlayer(command, obj);
			}
			else {
				// that direction wasn't available; give the reason
				command.reply(available);
			}
		}
		else {
			// TODO give customized replies for actual directions
			command.reply('You can\'t go "' + obj + '", it just doesn\'t work.');
		}
	}
	// otherwise, try to run the command from our possible ones
	else if (typeof room.commands[verb] !== 'undefined') {
		command.reply(room.commands[verb](player));
	}
	// if they asked for the exits, list them
	else if (verb === 'exits') {
		var exits = [];
		for (var key in room.exits) {
			exits.push(room.exits[key].name);
		}

		var exitNames = "Available exits: ";
		for (var i = 0; i < exits.length; i++) {
			exitNames += exits[i];
			if (i !== exits.length - 1) exitNames += ", ";
		}
		command.reply(exitNames);
	}
	else {
		command.reply('Sorry, I don\'t know how to "' + verb + '" in this room.');
	}
}

function getCurrentLocation(command, enterRoom) {
	var roomCollection = mongodb.collection('room');
	roomCollection.findOne({x: command.player.x, y: command.player.y, map: command.player.map}, function (err, room) {
		if (err) throw err;
		
		if (room) {
			// we assign the room into the command object, so we remember everything 
			// about it
			command.player.room = room;
			// then we get the player into a local var, all of the commands that we 
			// eval use "player.room.xxxxx" as their namespace, so this will ensure 
			// they're assigned properly
			var player = command.player;

			// now we need to eval what was in the db
			eval(player.room.commands);
			eval(player.room.items);
			eval(player.room.exits);

			// this is a special case for a new player, who wouldn't see the info 
			// about the first room as they were placed here programatically, not by 
			// their own command. So we send that response.
			if (enterRoom) {
				command.reply(player.room.description);
			}
			// otherwise, process the command that was given
			else {
				processCommand(command);
			}
		}
	});
}

function getUserInCommand(command) {
	var playerCollection = mongodb.collection('player');
	playerCollection.findOne({username: command.player, map: "default"}, function(err, player) {
		if (err) throw err;

		if (player) {
			command.player = player;
			getCurrentLocation(command);
		}
		else {
			playerCollection.insert({
				username: command.player,
				map: "default",
				x: 0,
				y: 0,
				room: {},
				items: {}
			}, function(err, player) {
				if (err) throw err;

				command.player = player[0];
				getCurrentLocation(command, true);
			});
		}
	});
}

function processReadline(commandText) {
	var command = {
		command: commandText,
		player: globalPlayer,
		reply: function(message) {
			console.log(message + ' (' + message.length + ')');
		}
	};

	getUserInCommand(command);
}

function listenForCommand(interface) {
	// if it's readline, we'll never see more than one player, so make the name 
	// of that user globally known
	if (interface.type === 'readline') {
		interface.question("What is your username? ", function(username) {
			globalPlayer = username;
			interface.on('line', processReadline);
		});
	}
}

mongo.connect('mongodb://advtxt-test:ImpossibleYellowUmbrage52751@troup.mongohq.com:10082/advtxt-test', function(err, db) {
	if (err) throw err;

	mongodb = db;

	var interface = readline.createInterface({
		input: process.stdin,
		output: process.stdout
	});
	interface.type = 'readline';
	listenForCommand(interface);
});

