/*
The MIT License (MIT)

Copyright (c) 2014 Nathan Wittstock

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

/** 
 * TODO Items:
 *
 * [ ] Win Condition
 * [ ] Death Condition
 * [ ] Separation into require'd library
 * [ ] Error checking and recovery
 */

var mongo = require('mongodb').MongoClient,
 readline = require('readline'),
  natural = require('natural'),
	   i18n = new (require('i18n-2'))({ locales: ['en']}),
        _ = require('underscore');

var tokenizer = new natural.WordTokenizer(),
 globalPlayer = null,
      mongodb = null;


/**
 * Moves the player's coordinates to another room, and then passes that off to 
 * the function that actually gets the room.
 *
 * @since 0.0.1
 * @param {command} command - The command object.
 * @param {string} direction - A string representation of the direction we're 
 *  moving in.
 */
function movePlayer(command, direction) {
	var move = [];
	// right now we only process cardinal directions
	if (direction === 'north' || direction === 'n') 
		move = [0, -1];
	else if (direction === 'south' || direction === 's') 
		move = [0, 1];
	else if (direction === 'east' || direction === 'e') 
		move = [1, 0];
	else if (direction === 'west' || direction === 'w')
		move = [-1, 0];
	else
		move = [0, 0];

	// now we apply those moves to the player object
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


/**
 * Updates the player's item collection in the database
 *
 * @since 0.0.1
 * @param {player} player - The player object to be updated.
 * @param {updatePlayerCallback} next - The optional callback to be executed 
 *  after the update.
 */
function updatePlayerItems(player, next) {
	var playerCollection = mongodb.collection('player');
	playerCollection.update({_id: player._id},
			{$set: {items: player.items}}, {w:1},
			function(err, success) {
		if (err) throw err;

		// the player is saved, do nothing unless there's an error
		if (!success) {
			console.error("Couldn't save player: " + player.username);
			console.error(player);
		}
		if (typeof next !== 'undefined' && next) next(success);
	});
}

/**
 * This callback runs after the player is updated.
 *
 * @callback updatePlayerCallback
 * @param {number} playerUpdated
 */


/**
 * Process a command that was received from the player.
 *
 * @since 0.0.1
 * @param {command} command - The command object
 */
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
			// that item wasn't available
			else {
				command.reply(available);
			}
		}
		// there wasn't an item by that name
		else {
			command.reply('You can\'t find a "' + obj + '" in this room!');
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
			// that direction wasn't available; give the reason
			else {
				command.reply(available);
			}
		}
		// there wasn't a direction by that name
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

/**
 * Gets the room a player is in, and inserts that room into the command object. 
 * Responds to the player if they just entered the room.
 *
 * @since 0.0.1
 * @param {command} command - The command object.
 * @param {boolean} enterRoom - If the player has just entered the room, we need
 *  to play them an entrance message.
 */
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

/**
 * Get the user that is addressed in the command, and inserts that information 
 * into the command.
 *
 * @since 0.0.1
 * @param {command} command - The command object.
 */
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

/**
 * Processes text that has come in via the REPL, for testing. Generates a 
 * {command} object.
 *
 * @since 0.0.1
 * @param {string} commandText - The raw text command that was received.
 */
function processReadline(commandText) {
	var command = {
		command: commandText,
		player: globalPlayer,
		reply: function(message) {
			var messageLength = message.length + 16;
			if (messageLength > 140) messageLength = "!!!" + messageLength + "!!!";
			console.log(message + ' (' + messageLength + ')');
		}
	};

	getUserInCommand(command);
}

/**
 * Listens for commands on the interface provided.
 *
 * @since 0.0.1
 * @param {interface} interface - The interface object that should be watched.
 */
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

// now connect to mongo
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

