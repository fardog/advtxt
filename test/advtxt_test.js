'use strict';

var grunt = require('grunt');
var mockdb = require('./fixtures/mockdb.js');
var advtxt = require('advtxt');
var Hoek = require('hoek');

var advDbMock = new mockdb();
var advtxt = new (require('advtxt'))();

var blank_command = {
  command: "",
  player: "test",
  replies: [],
  done: null
};

advDbMock.initialize({}, function(err, dbAdapter) {
  advtxt.initialize(dbAdapter);

  exports.advtxt = {
    // tests entering the room as a new player, and looking
    newPlayerEntersRoomAndLooks: function(test) {
      test.expect(2);
      
      var command = Hoek.clone(blank_command);
      command.command = "look";
      command.player = "test2";
      command.done = function(command) {
        test.equal(command.replies[0], "This room looks pretty plain as well.", 'should see room information');
        test.equal(command.replies[1], "Huh, there's a key in this room.", 'should see key information');
        test.done();
      };

      advtxt.processCommand(command);
    },
    // tests performing a look command as an existing player
    existingPlayerLooks: function(test) {
      test.expect(1);

      var command = Hoek.clone(blank_command);
      command.command = "look";
      command.done = function(command) {
        test.equal(command.replies[0], "Huh, there's a key in this room.", 'should see key information');
        test.done();
      };

      advtxt.processCommand(command);
    }
  };
});
