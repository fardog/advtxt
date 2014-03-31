/**
* @overview AdvTxt is a text adventure engine, written in Javascript on Node.js.
*
* @author Nathan Wittstock <code@fardogllc.com>
* @license MIT License - See file 'LICENSE' in this project.
* @version 0.1.1
* @extends EventEmitter 
*/
'use strict';

var i18n = new (require('i18n-2'))({ locales: ['en']});
var _ = require('underscore');
var Hoek = require('hoek');
var Parser = require('./parser');
var events = require('events');
var util = require('util');
var async = require('async');
var debug = require('debug')('advtxt');

var advtxt = {};


/**
 * Constructs a new AdvTxt Server.
 *
 * @since 0.0.1
 * @constructor
 */
exports = module.exports = advtxt.Server = function() {
  var self = this;

  events.EventEmitter.call(self);

  self.db = null;
  self.initialized = false;
}

// Extend EventEmitter
util.inherits(advtxt.Server, events.EventEmitter);

/**
 * Initializes AdvTxt
 *
 * @since 0.0.3
 * @param {advtxtdb} db - AdvTxt DB adapter.
 */
advtxt.Server.prototype.initialize = function(db) {
  var self = this;

  self.db = db;
  self.initialized = true;
};


/**
 * Adds a reply to the replies array and emits an event
 *
 * @since 0.0.6
 * @param {command} command - The Command object.
 * @param {string} reply - The reply to be added.
 *
 */
advtxt.Server.prototype.reply = function(command, reply) {
  var self = this;

  command.replies.push(reply);
  self.emit('reply', reply);

  return;
};

/**
 * Moves the player's coordinates to another room, and then passes that off to 
 * the function that actually gets the room.
 *
 * @since 0.1.0
 * @param {string} direction - A string representation of the direction we're 
 *  moving in.
 */
advtxt.Server.prototype.calculateMove = function(direction) {
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
  return move;
}

/** 
 * Resets the player within the map, optionally clearing all of their items and 
 * positioning them in the 0,0 spot.
 *
 * @since 0.0.2
 * @param {command} command - The command object.
 * @param {boolean} clearItems - Should we clear their items or not?
 * @param {advTxtCallback} next - Function to call next
 */
advtxt.Server.prototype.resetPlayer = function(command, clearItems, next) {
  var self = this;

  // set player's position to 0,0
  command.player.x = 0;
  command.player.y = 0;

  command.player.status = "alive";
  command.move = true;

  // output a different message if we're just moving, or if fully resetting
  if (typeof clearItems !== 'undefined' && clearItems) {
    command.player.items = {}; // clear the player's items array
    command.items = true;
    self.reply(command, i18n.__("Giving you a blank slate…"));
  }
  else {
    self.reply(command, i18n.__("Moving you to the origin room…"));
  }

  debug('Now resetting player.');
  // first we need to reset their position
  self.updatePlayerPosition(command, function(err, command) {
    var self = this;
    debug('Position reset.');
    // the position has been reset. Clear their items if requested.
    self.updatePlayerItems(command, function(err, command) {
      debug('Items cleared.');
      next(null, command);
    });
  }.bind(self));
}

/**
 * Standard callback for AdvTxt
 *
 * @since 0.1.0
 * @callback advTxtCallback
 * @param {Error} err - Error object if there was one, else null.
 * @param {command} command - The command object.
 */

/**
 * Updates a player's position in the database.
 *
 * @since 0.0.2
 * @param {command} command - The representation of a command.
 * @param {advTxtCallback} next
 */
advtxt.Server.prototype.updatePlayerPosition = function(command, next) {
  var self = this;

  debug("Updating Position");
  var selector = {_id: command.player._id};
  var data = {x: command.player.x, y: command.player.y};


  self.db.update('player', selector, data, function(err, success){
    if (err) next(err, command);
    // if we were successful, lets update their location and send a response
    if (!success) {
      console.error("Couldn't update player position.");
      console.error(command.player);
    }

    debug("Successfully updated position.");
    next(null, command);
  }.bind(self));
}

/**
 * Updates the player's item collection in the database
 *
 * @since 0.0.1
 * @param {command} command - The command object
 * @param {advTxtCallback} next
 */
advtxt.Server.prototype.updatePlayerItems = function(command, next) {
  var self = this;

  var selector = {_id: command.player._id};
  var data = {items: command.player.items};

  self.db.update('player', selector, data, function(err, success) {
    if (err) next(err, command);

    // the player is saved, do nothing unless there's an error
    if (!success) {
      console.error("Couldn't save player: " + command.player.username);
      console.error(command.player);
    }

    next(null, command);
  }.bind(self));
}

/**
 * Updates the player's status in the database
 *
 * @since 0.0.2
 * @param {command} command - The command object
 * @param {advTxtCallback} next
 */
advtxt.Server.prototype.updatePlayerStatus = function(command, next) {
  var self = this;

  var selector = {_id: command.player._id};
  var data = {status: command.player.status};

  self.db.update('player', selector, data, function(err, success) {
    if (err) next(err, command);

    if (!success) {
      console.error("Couldn't save player: " + command.player.username);
      console.error(command.player);
    }

    if (typeof next === 'function' && next) next(null, command);
  }.bind(self));
}


/**
 * Process a command that was received from the player.
 *
 * @since 0.0.1
 * @param {command} command - The command object
 * @param {advTxtCallback} next
 */
advtxt.Server.prototype.doCommand = function(command, next) {
  var self = this;

  var parser = new Parser(command);
  if (!parser.fail) {
    command.command = parser.command;
  }
  else {
    next(new Error(__.i18n("I don't know what you mean.")), command);
  }

  // make things less verbose
  var verb = command.command.verb;
  var object = command.command.object;
  var player = command.player;
  var room = player.room;
  var commands = parser.commands;

  // if we've already performed the command
  if (command.performed) {
    next(null, command);
  }

  // set the command as performed
  command.performed = true;

  // we need to check for reset commands first, so we don't ignore them from a
  // dead player
  if (verb === commands.RESET && object === '') {
    self.resetPlayer(command, false, next);
    return;
  }
  else if (verb === commands.RESET && object === i18n.__('all')) {
    self.resetPlayer(command, true, next);
    return;
  }
  else if (verb === commands.GET) {
    // would try to get an item
    if (typeof room.items[object] !== 'undefined') {
      var available = room.items[object].available(player);
      if (available === true) {
        // that item was available. get the item
        player.items[object] = room.items[object].name;
        self.reply(command, room.items[object].get(player));
        // set the player's items as changed
        command.items = true;
      }
      // that item wasn't available
      else {
        self.reply(command, available);
      }
    }
    // there wasn't an item by that name
    else {
      self.reply(command, i18n.__('You can\'t find a "%s" in this room!', object));
    }
  }
  else if (verb === commands.GO) {
    // would try to move in a direction
    if (typeof room.exits[object] !== 'undefined') {
      var available = room.exits[object].available(player);
      if (available === true) {
        // that direction was available, play the "go" message, then move them
        self.reply(command, room.exits[object].go(player));

        // set the player to be moved
        var move = self.calculateMove(object);

        command.player.x += move[0];
        command.player.y += move[1];

        command.move = true;

        // set the room to be announced
        command.announceRoom = true;
      }
      // that direction wasn't available; give the reason
      else {
        self.reply(command, available);
      }
    }
    // there wasn't a direction by that name
    else {
      // TODO give customized replies for actual directions
      self.reply(command, i18n.__('You can\'t go "%s", it just doesn\'t work.', object));
    }
  }
  // otherwise, try to run the command from our possible ones
  else if (typeof room.commands[verb] !== 'undefined') {
    self.reply(command, room.commands[verb](player));
  }
  // if they asked for the exits, list them
  else if (verb === commands.EXITS) {
    var exits = [];
    for (var key in room.exits) {
      exits.push(room.exits[key].name);
    }

    var exitNames = i18n.__('Available exits: ');
    for (var i = 0; i < exits.length; i++) {
      exitNames += exits[i];
      if (i !== exits.length - 1) exitNames += i18n.__(", ");
    }
    self.reply(command, exitNames);
  }
  else {
    self.reply(command, i18n.__('Sorry, I don\'t know how to "%s" in this room.', verb));
  }

  next(null, command);
}

/**
 * Gets the room a player is in, and inserts that room into the command object. 
 * Responds to the player if they just entered the room.
 *
 * @since 0.0.1
 * @param {command} command - The command object.
 * @param {advTxtCallback} next
 */
advtxt.Server.prototype.getCurrentLocation = function(command, next) {
  var self = this;

  // save our player's status if we haven't seen it yet. this is so we can 
  // check for dead/win later
  if (typeof command.status === 'undefined') 
    command.status = Hoek.clone(command.player.status);

  self.db.findOne('room', {x: command.player.x, y: command.player.y, map: command.player.map}, function (err, room) {
    if (err) next(err, command);

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
      if (command.announceRoom) {
        command.announceRoom = false;
        self.reply(command, player.room.description);
      }
      // otherwise, process the command that was given
      next(null, command);
    }
  });
}

/**
 * Gets the player that is addressed in the command.
 *
 * @since 0.1.0
 * @param {command} command - The command object.
 * @param {advTxtCallback} next
 */
advtxt.Server.prototype.getPlayer = function(command, next) {
  var self = this;

  self.db.findOne('player', {username: command.player, map: "default"}, function(err, player) {
    if (err) next(err, command);

    if (player) {
      command.player = player;
      next(null, command);
    }
    else {
      self.db.insertOne('player', {
        username: command.player,
        map: "default",
        x: 0,
        y: 0,
        status: "alive",
        room: {},
        items: {}
      }, function(err, player) {
        if (err) throw err;

        command.player = player;
        command.announceRoom = true;

        next(null, command);
      });
    }
  });
};

/**
 * Takes a raw command and runs it through the AdvTxt engine.
 *
 * @since 0.0.1
 * @param {command} command - The command object.
 */
advtxt.Server.prototype.processCommand = function(command) {
  var self = this;

  // we haven't performed the command yet
  command.performed = false;

  async.waterfall([
    function(next) {
      // get the current player, we also need to pass the command object
      self.getPlayer(command, next);
    },
    // get the player's location
    self.getCurrentLocation.bind(self),
    // perform their command
    self.doCommand.bind(self),
    // update their items if necessary
    function(command, next) {
      if (command.items) {
        command.items = false;
        self.updatePlayerItems(command, next);
      }
      else {
        next(null, command);
      }
    },
    // update their position if necessary
    function(command, next) {
      if (command.move) {
        command.move = false;
        self.updatePlayerPosition(command, next);
      }
      else {
        next(null, command);
      }
    },
    // get their location again, if we need to announce it
    function(command, next) {
      if (command.announceRoom) {
        self.getCurrentLocation(command, next);
      }
      else {
        next(null, command);
      }
    }
  ], self.finalize.bind(self));

  
}

/**
 * Cleans up at the end of a player command or move. Handles death/win messages
 *
 * @param {Error} err - An error message, or null
 * @param {command} command - The command object.
 */
advtxt.Server.prototype.finalize = function(err, command) {
  var self = this;

  debug("Command Finalized");

  if (err) {
    console.error("An error occurred. What follows is the error, and the command");
    console.error(err);
    console.error(JSON.stringify(command));
  }
  else {
    // this was the first time we saw the status as different, we need to send 
    // the first time message and save the player.
    if (command.status !== command.player.status) {
      if (command.player.status === 'dead') {
        self.reply(command, i18n.__('You\'ve died! Send the command `reset all` to try again!'));
      }
      else if (command.player.status === 'win') {
        self.reply(command, i18n.__('You\'ve won the game! How impressive! Send the command `reset all` to play again!'));
      }
      self.updatePlayerStatus(command);
    }
    else if (command.player.status === 'dead') {
      self.reply(command, i18n.__('You\'re still dead! Send the command `reset all` to try again!'));
    }
    else if (command.player.status === 'win') {
      self.reply(command, i18n.__('Yes, your win was glorious, but send the command `reset all` to play again!'));
    }
  }

  // tell the original caller that we're done
  command.done(command);
}

