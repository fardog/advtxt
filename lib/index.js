/**
* @overview AdvTxt is a text adventure engine, written in Javascript on Node.js 
*  and using MongoDB as its backing store.
*
* @author Nathan Wittstock <code@fardogllc.com>
* @license MIT License - See file 'LICENSE' in this project.
* @version 0.0.2
*/
'use strict';

/** 
 * TODO Items:
 *
 * [x] Win Condition
 * [x] Death Condition
 * [x] Separation into require'd library
 * [ ] Error checking and recovery
 */


var mongo = require('mongodb').MongoClient;
var natural = require('natural');
var i18n = new (require('i18n-2'))({ locales: ['en']});
var _ = require('underscore');
var Hoek = require('hoek');
var tokenizer = new natural.WordTokenizer();

var advtxt = {};


/**
 * Constructs a new AdvTxt Server.
 *
 * @since 0.0.1
 * @constructor
 * @param {string} connectionString - The MongoDB connection string that we'll 
 *  be connecting to.
 */
exports = module.exports = advtxt.Server = function(connectionString) {
	var self = this;
  self.mongodb = null;

	console.info('Connecting to MongoDB database…');
	// now connect to mongo
	mongo.connect(connectionString, function(err, db) {
		if (err) throw err;

		if (db) {
			console.info('Connected.');
			self.mongodb = db;

		}
		else {
			console.error('Connected, but failed to get a database…');
			process.exit(1);
		}
	});
}

/**
 * Moves the player's coordinates to another room, and then passes that off to 
 * the function that actually gets the room.
 *
 * @since 0.0.1
 * @param {command} command - The command object.
 * @param {string} direction - A string representation of the direction we're 
 *  moving in.
 */
advtxt.Server.prototype.movePlayer = function(command, direction) {
	var self = this;

	var move = [];
	// right now we only process cardinal directions
	if (direction === i18n.__('north') || direction === 'n') 
		move = [0, -1];
	else if (direction === i18n.__('south') || direction === 's') 
		move = [0, 1];
	else if (direction === i18n.__('east') || direction === 'e') 
		move = [1, 0];
	else if (direction === i18n.__('west') || direction === 'w')
		move = [-1, 0];
	else
		move = [0, 0];

	// now we apply those moves to the player object
	command.player.x += move[0];
	command.player.y += move[1];

	// now we need to update the player in the database
	self.updatePlayerPosition(command, self.getCurrentLocation.bind(self));
}

/** 
 * Resets the player within the map, optionally clearing all of their items and 
 * positioning them in the 0,0 spot.
 *
 * @since 0.0.2
 * @param {command} command - The command object.
 * @param {boolean} clearItems - Should we clear their items or not?
 */
advtxt.Server.prototype.resetPlayer = function(command, clearItems) {
	var self = this;

	// set player's position to 0,0
	command.player.x = 0;
	command.player.y = 0;

	command.player.status = "alive";

	// output a different message if we're just moving, or if fully resetting
	if (typeof clearItems !== 'undefined' && clearItems) {
		command.player.items = {}; // clear the player's items array
		command.reply(i18n.__("Giving you a blank slate…"));
	}
	else {
		command.reply(i18n.__("Moving you to the origin room…"));
	}

	// first we need to reset their position
	self.updatePlayerPosition(command, function(command) {
		var self = this;
		// the position has been reset. Clear their items if requested.
		if (clearItems) {
			self.updatePlayerItems(command, self.getCurrentLocation.bind(self));
		}
		// otherwise, call the current location function to let the player know
		// where they are
		else {
			self.getCurrentLocation(command, true);
		}
	}.bind(self));
}

/**
 * Updates something in the database, given the info to do so.
 *
 * @since 0.0.2
 * @param {string} name - The name of the collection we're updating
 * @param {object} selector - The MongoDB selector for what you want to update
 * @param {object} data - The data that you want to update, which gets mashed 
 *  into the $set variable of Mongo's update statement.
 * @callback {updateDatabaseCallback} next - The callback to be executed after
 *  the update.
 */
advtxt.Server.prototype.updateDatabase = function(name, selector, data, next) {
	var self = this;

	var collection = self.mongodb.collection(name);
	collection.update(selector, {$set: data}, {w:1}, function(err, success) {
		if (err) throw err;

		if (typeof next !== 'undefined' && next) {
			next(success);
		}
	});
}

/**
 * This callback is run after a database entry is updated.
 *
 * @since 0.0.2
 * @callback updateDatabaseCallback
 * @param {number} result - How many records we updated
 */


/**
 * Updates a player's position in the database.
 *
 * @since 0.0.2
 * @param {command} command - The representation of a command.
 * @param {updatePlayerCallback} next - The callback to be executed after the update. 
 */
advtxt.Server.prototype.updatePlayerPosition = function(command, next) {
	var self = this;

	var selector = {_id: command.player._id};
	var data = {x: command.player.x, y: command.player.y};
	
	self.updateDatabase('player', selector, data, function(success){
		// if we were successful, lets update their location and send a response
		if (success) {
			if(typeof next !== 'undefined' && next) next(command, true);
		}
		else {
			if(typeof next !== 'undefined' && next) next(false);
		}
	}.bind(self));
}

/**
 * Updates the player's item collection in the database
 *
 * @since 0.0.1
 * @param {command} command - The command object
 * @param {updatePlayerCallback} next - The optional callback to be executed 
 *  after the update.
 */
advtxt.Server.prototype.updatePlayerItems = function(command, next) {
	var self = this;

	var selector = {_id: command.player._id};
	var data = {items: command.player.items};

	self.updateDatabase('player', selector, data, function(success) {
		// the player is saved, do nothing unless there's an error
		if (!success) {
			console.error("Couldn't save player: " + command.player.username);
			console.error(command.player);
		}
		if (typeof next !== 'undefined' && next) next(command, true);
	}.bind(self));
}

/**
 * This callback runs after the player is updated.
 *
 * @since 0.0.1
 * @callback updatePlayerCallback
 * @param {command} The command object
 * @param {boolean} whether to send output
 */


/**
 * Updates the player's status in the database
 *
 * @since 0.0.2
 * @param {command} command - The command object
 * @param {updatePlayerCallback} next - The optional callback to be
 *  executed after the update.
 */
advtxt.Server.prototype.updatePlayerStatus = function(command, next) {
	var self = this;

	var selector = {_id: command.player._id};
	var data = {status: command.player.status};

	self.updateDatabase('player', selector, data, function(success) {
		if (!success) {
			console.error("Couldn't save player: " + command.player.username);
			console.error(command.player);
		}
		if (typeof next !== 'undefined' && next) next(command, true);
	}.bind(self));
}


/**
 * Process a command that was received from the player.
 *
 * @since 0.0.1
 * @param {command} command - The command object
 */
advtxt.Server.prototype.doCommand = function(command) {
	var self = this;
	command.command = tokenizer.tokenize(command.command.toLowerCase());

	// make things less verbose
	var verb = command.command[0];
	var obj = command.command[1];
	var player = command.player;
	var room = player.room;

	// we need to check for reset commands first, so we don't ignore them from a
	// dead player
	if (verb === i18n.__('reset') && typeof obj === 'undefined') {
		self.resetPlayer(command, false);
	}
	else if (verb === i18n.__('reset') && obj === i18n.__('all')) {
		self.resetPlayer(command, true);
	}
	else if (player.status === 'dead' || player.status === 'win') {
		self.finalize(command);
	}
	else if (verb === i18n.__('get')) {
		// would try to get an item
		if (typeof room.items[obj] !== 'undefined') {
			var available = room.items[obj].available(player);
			if (available === true) {
				// that item was available. get the item
				player.items[obj] = room.items[obj].name;
				command.reply(room.items[obj].get(player));
				// update the player
				self.updatePlayerItems(command, self.finalize.bind(self));
			}
			// that item wasn't available
			else {
				command.reply(available);
			}
		}
		// there wasn't an item by that name
		else {
			command.reply(i18n.__('You can\'t find a "%s" in this room!', obj));
		}
	}
	else if (verb === i18n.__('go')) {
		// would try to move in a direction
		if (typeof room.exits[obj] !== 'undefined') {
			var available = room.exits[obj].available(player);
			if (available === true) {
				// that direction was available, play the "go" message, then move them
				command.reply(room.exits[obj].go(player));
				// move the player
				self.movePlayer(command, obj);
			}
			// that direction wasn't available; give the reason
			else {
				command.reply(available);
			}
		}
		// there wasn't a direction by that name
		else {
			// TODO give customized replies for actual directions
			command.reply(i18n.__('You can\'t go "%s", it just doesn\'t work.', obj));
		}
	}
	// otherwise, try to run the command from our possible ones
	else if (typeof room.commands[verb] !== 'undefined') {
		command.reply(room.commands[verb](player));
	}
	// if they asked for the exits, list them
	else if (verb === i18n.__('exits')) {
		var exits = [];
		for (var key in room.exits) {
			exits.push(room.exits[key].name);
		}

		var exitNames = i18n.__('Available exits: ');
		for (var i = 0; i < exits.length; i++) {
			exitNames += exits[i];
			if (i !== exits.length - 1) exitNames += i18n.__(", ");
		}
		command.reply(exitNames);
	}
	else {
		command.reply(i18n.__('Sorry, I don\'t know how to "%s" in this room.', verb));
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
advtxt.Server.prototype.getCurrentLocation = function(command, enterRoom) {
	var self = this;

	// save our player's status if we haven't seen it yet. this is so we can 
	// check for dead/win later
	if (typeof command.status === 'undefined') 
		command.status = Hoek.clone(command.player.status);

	var roomCollection = self.mongodb.collection('room');
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

			// if we just entered the room, we need to reply with its description and 
			// just exit afterward.
			if (enterRoom) {
				command.reply(player.room.description);
				self.finalize(command);
			}
			// otherwise, process the command that was given
			else {
				self.doCommand(command);
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
advtxt.Server.prototype.processCommand = function(command) {
	var self = this;

	var playerCollection = self.mongodb.collection('player');
	playerCollection.findOne({username: command.player, map: "default"}, function(err, player) {
		if (err) throw err;

		if (player) {
			command.player = player;
			self.getCurrentLocation(command);
		}
		else {
			playerCollection.insert({
				username: command.player,
				map: "default",
				x: 0,
				y: 0,
				status: "alive",
				room: {},
				items: {}
			}, function(err, player) {
				if (err) throw err;

				command.player = player[0];
				self.getCurrentLocation(command, true);
			});
		}
	});
}

/**
 * Cleans up at the end of a player command or move. Handles death/win messages
 *
 * @param {command} command - The command object.
 */
advtxt.Server.prototype.finalize = function(command) {
	var self = this;

	// this was the first time we saw the status as different, we need to send 
	// the first time message and save the player.
	if (command.status !== command.player.status) {
		if (command.player.status === 'dead') {
			command.reply(i18n.__('You\'ve died! Send the command `reset all` to try again!'));
		}
		else if (command.player.status === 'win') {
			command.reply(i18n.__('You\'ve won the game! How impressive! Send the command `reset all` to play again!'));
		}
		self.updatePlayerStatus(command);
	}
	else if (command.player.status === 'dead') {
		command.reply(i18n.__('You\'re still dead! Send the command `reset all` to try again!'));
	}
	else if (command.player.status === 'win') {
		command.reply(i18n.__('Yes, your win was glorious, but send the command `reset all` to play again!'));
	}
}

