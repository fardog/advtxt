/**
* @overview AdvTxt is a text adventure engine, written in Javascript on Node.js.
*
* @author Nathan Wittstock <code@fardogllc.com>
* @license MIT License - See file 'LICENSE' in this project.
* @version 0.2.0
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
};

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
    command.player.items = []; // clear the player's items array
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
};

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
    if (err) {
      next(err, command);
    }
    // if we were successful, lets update their location and send a response
    if (!success) {
      console.error("Couldn't update player position.");
      console.error(command.player);
    }

    debug("Successfully updated position.");
    next(null, command);
  }.bind(self));
};

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

  debug('Updating player items.');

  self.db.update('player', selector, data, function(err, success) {
    if (err) {
      next(err, command);
    }

    debug('Player items updated.');

    // the player is saved, do nothing unless there's an error
    if (!success) {
      console.error("Couldn't save player: " + command.player.username);
      console.error(command.player);
    }

    next(null, command);
  }.bind(self));
};

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
    if (err) {
      next(err, command);
    }

    if (!success) {
      console.error("Couldn't save player: " + command.player.username);
      console.error(command.player);
    }

    if (typeof next === 'function' && next) {
      next(null, command);
    }
  }.bind(self));
};

/**
 * Checks a command against the availability tree, and returns the appropriate 
 *  response.
 * 
 * @since 0.2.0
 * @param {player} player - The player object
 * @param {array} availabilities - An array of availability objects
 * @param {callback} next - The next function to call
 *
 * @returns {availability} - The availability object that passed
 */
advtxt.Server.prototype.checkAvailability = function (player, availabilities, next) {
  var avail = null;
  var availabilityFound = availabilities.some(function(availability) {
    if (typeof availability.items !== 'undefined' && availability.items) {
      if (typeof availability.items !== 'object') availability.items = [availability.items];
      debug('Checking if items match requirements.');
      var intersection = _.intersection(player.items, availability.items)
      if (intersection.length > 0) {
        debug('There was intersection between the availability and player');
        if ((_.difference(intersection, availability.items)).length === 0) {
          debug('All availability conditions were met');
          avail = availability;
          return true;
        }
        else {
          debug('Not all availability conditions were met');
        }
      }
      else {
        debug('There was no intersection with the availability items.');
      }
    }
    else {
      avail = availability;
      debug('There were no availabilities to check, returning default.');
      return true;
    }
  });

  if (availabilityFound) {
    next(null, avail);
  }
};


advtxt.Server.prototype.processAvailability = function(command, attribute, availability, next) {
  var self = this;

  if (availability.available === 'true') {
    debug('Command was available.');
    if (typeof attribute.move !== 'undefined' && attribute.move) {
      debug('Command moves player.');
      command.player.x += parseInt(attribute.move[0]);
      command.player.y += parseInt(attribute.move[1]);

      // set our position as dirty
      command.move = true;
      command.announceRoom = true;
    }
    if (typeof attribute.items !== 'undefined' && attribute.items) {
      debug('Command had some items to give/take.');
      if (typeof attribute.items !== 'object') {
        attribute.items = [attribute.items];
      }
      attribute.items.forEach(function (item) {
        if (item.charAt(0) === '-') {
          item = item.slice(1);
          debug('Taking item ' + item);
          var index = command.player.items.indexOf(item);
          if (index !== -1) {
            delete command.player.items[index];
          }
        }
        else {
          if (item.charAt(0) === '+') item = item.slice(1);
          var index = command.player.items.indexOf(item);
          
          if (index === -1) {
            debug('Giving item ' + item);
            command.player.items.push(item);
          }
        }

      });
      // set our items as dirty
      command.items = true;
    }
  }
  else {
    debug("Command wasn't available.");
  }

  next(null, command);
};


/**
 * Process a command that was received from the player.
 *
 * @since 0.0.1
 * @param {command} command - The command object
 * @param {advTxtCallback} next
 */
advtxt.Server.prototype.doCommand = function(command, next) {
  var self = this;

  debug('Performing command.');

  var parser = new Parser(command);
  if (!parser.fail) {
    command.command = parser.command;
  }
  else {
    next(new Error(i18n.__("I don't know what you mean.")), command);
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
  // else, we iterate through commands and see what sticks
  else {
    debug('Processing command.');
    
    // find the attribute that matches our command
    var attribute = null;
    var attributeFound = room.attributes.some(function (attr) {
      if (verb === commands.GO && attr.type === 'exit' && attr.name === object) {
        debug('Attribute was GO and matched. Returning.');
        attribute = attr;
        return true;
      }
      else if (verb === commands.GET && attr.name === commands.GET && attr.items === object) {
        debug('Attribute was GET and matched. Returning.');
        attribute = attr;
        return true;
      }
      else if (attr.type === 'command' && attr.name !== commands.GET && verb === attr.name) {
        debug('Attribute was ' + verb + ' and matched. Returning.');
        attribute = attr;
        return true;
      }
      else {
        attribute = null;
      }
    });

    // if we found an attribute to work with, process it
    if (typeof attributeFound !== 'undefined' && attributeFound) {
      debug('Now processing the attribute that was returned');
      self.checkAvailability(command.player, attribute.availability, function(err, availability) {
        debug('Got back availability.');
        // play back our availability message
        self.reply(command, availability.message);

        // process the availability
        self.processAvailability(command, attribute, availability, next);
      });
    }
    else {
      debug('Nothing stuck.');
      self.reply(command, i18n.__("I couldn't understand you."));
      next(null, command);
    }
  }
};

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

  debug('Getting current location.');

  // save our player's status if we haven't seen it yet. this is so we can 
  // check for dead/win later
  if (typeof command.status === 'undefined') {
    command.status = Hoek.clone(command.player.status);
  }

  self.db.findOne('room', {x: command.player.x, y: command.player.y, map: command.player.map}, function (err, room) {
    if (err) {
      next(err, command);
    }

    debug('Got current location: ' + room.x + ',' + room.y);

    if (room) {
      // we assign the room into the command object, so we remember everything 
      // about it
      command.player.room = room;

      // if we just entered the room, we need to perform its enter command
      var attribute = null;
      var attributeFound = room.attributes.some(function (attr) {
        if (attr.type === 'command' && attr.name === 'enter') {
          debug('Found enter attribute');
          attribute = attr;
          return true;
        }
      });

      // if we found an attribute to work with, process it
      if (typeof attributeFound !== 'undefined' && attributeFound) {
        debug('Now processing the attribute that was returned');
        self.checkAvailability(command.player, attribute.availability, function(err, availability) {
          debug('Got back availability.');
          // play back our entrance message if we're supposed to
          if (command.announceRoom) {
            command.announceRoom = false;
            self.reply(command, availability.message);
          }

          // process the availability
          self.processAvailability(command, attribute, availability, next);
        });
      }
      else {
        debug('No entrance message found.');
        next(null, command);
      }
    }
  });
};

/**
 * Gets the player that is addressed in the command.
 *
 * @since 0.1.0
 * @param {command} command - The command object.
 * @param {advTxtCallback} next
 */
advtxt.Server.prototype.getPlayer = function(command, next) {
  var self = this;

  debug('Getting player.');

  self.db.findOne('player', {username: command.player, map: "default"}, function(err, player) {
    if (err) {
      next(err, command);
    }

    debug('Got player.');

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
        items: []
      }, function(err, player) {
        if (err) {
          next(err, command);
        }

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

  debug('Got command.');

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
};

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
};

