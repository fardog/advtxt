/**
* @overview A mock mongodb adapter for AdvTxt testing
*
* @author Nathan Wittstock <code@fardogllc.com>
* @license MIT License - See file 'LICENSE' in this project.
* @version 0.0.1
*/
'use strict';

var debug = require('debug')('mongo');

var advtxt = {};

var rooms = [
  {
    _id: 1,
    commands: "player.room.commands = {\n    look: function(player) {\n        if (player.items.key) return \"This room had a key in it, but it's empty now.\";\n        return \"Huh, there's a key in this room.\";\n    }\n};",
    description: "This room looks pretty plain as well.",
    exits: "player.room.exits = {\n    east: {\n        available: function(player) { return true;},\n        go: function(player) {\n            return \"You head east…\";\n        },\n        name: 'east',\n        short_name: 'e'\n    }\n};",
    items: "player.room.items = {\n    key: {\n        available: function(player) { \n            if (player.items.key) return false;\n            return true; \n        },\n        name: 'key',\n        short_name: 'key',\n        get: function(player) {\n            return \"You pick up the key…\";\n        }\n    }\n};",
    map: "default",
    name: "key_room",
    x: 0,
    y: 0
  },
  {
    _id: 2,
    commands: "player.room.commands = {\n    look: function(player) {\n        if (player.items.key) {\n            return \"It looks like your key might open the northern door…\";\n        }\n        return \"It looks like the northern door is locked.\";\n    }\n};",
    description: "You find yourself in another room. It's a lot like the first one.",
    exits: "player.room.exits = {\n    north: {\n        available: function(player) {\n            if (player.items.key) return true;\n            return \"You need a key to open this door.\";\n        },\n        go: function(player) {\n            return \"You use your key to open the lock, and continue onward.\";\n        },\n        name: 'north',\n        short_name: 'n'\n    },\n    south: {\n        available: function(player) { return true;},\n        go: function(player) {\n            return \"You head south…\";\n        },\n        name: 'south',\n        short_name: 's'\n    },\n    west: {\n        available: function(player) { return true;},\n        go: function(player) {\n            return \"You head west…\";\n        },\n        name: 'west',\n        short_name: 'w'\n    }\n};",
    items: "player.room.items = {}",
    map: "default",
    name: "cave_entrance",
    x: 0,
    y: -1
  }
];

var player = {
  username: "test",
  map: "default",
  x: 0,
  y: 0,
  room: {},
  items: {},
  _id: 1
}

exports = module.exports = advtxt.MockDB = function() {
	var self = this;
	debug('AdvTxt MockDB Instantiated');
};

advtxt.MockDB.prototype.initialize = function(config, next) {
	var self = this;

  debug("Connected to MockDB.");
  next(null, self);
};

advtxt.MockDB.prototype.update = function(name, selector, data, next) {
	var self = this;

  next(null, 1);
};

advtxt.MockDB.prototype.findOne = function(name, selector, next) {
	var self = this;

  var item = null;

  if (name === 'room') {
    if (selector.x === 0 && selector.y === 0) {
      item = rooms[0];
    }
    else if (selector.x === 0 && selector.y === -1) {
      item = rooms[1];
    }
  }
  else if (name === 'player' && selector.username === "test") {
    item = player;
  }

  next(null, item);
};

advtxt.MockDB.prototype.insertOne = function(name, item, next) {
	var self = this;

  next(null, item);
};
