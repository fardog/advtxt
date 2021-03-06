# AdvTxt [![Build Status](https://travis-ci.org/fardog/advtxt.png?branch=master)](https://travis-ci.org/fardog/advtxt)

A Node.js text adventure engine. You'll need [advtxt-editor](https://github.com/fardog/advtxt_editor) to make your rooms.

Installation
------------

Currently this project is unstable and shouldn't be relied upon by anyone.

```sh
npm install advtxt
```

Usage
-----

When you set up AdvTxt, you need to give it a backing store. What follows is an example using the [advtxt-db-mongo][advtxtmongo] module, and the [advtxt-readline](http://github.com/fardog/advtxt-readline) module for I/O.

```js
var config = {
  adapter: 'mongodb',
  mongodb: {
    uri: 'mongodb://localhost/advtxt_test'
  }
};

var advDbMongo = new (require('advtxt-db-mongo'))();
var advtxt = new (require('advtxt'))();

advDbMongo.initialize(config, function(err, dbAdapter) {
  if (err) {
    throw err;
  }

  advtxt.initialize(dbAdapter);

  var advtxtreadline = require('advtxt-readline');
  var advtxttelnet = require('advtxt-telnet');

  var AdvTxt = new advtxtreadline(advtxt);
});
```

There's only one public function you should use, `advtxt.processCommand(command)` where `command` is in the following format:

```js
var command = {
    command: "Your command text",
    player: "playerName",
    replies: [],
    done: function(command) {
        command.replies.forEach (function(reply) {
            console.log(reply);
        });
    }
};
```

AdvTxt doesn't do any authentication on it's own, that's for you to implement in your interface.

All output is pushed line-per-line into the `replies` array; the `done` function will be called once all processing is complete; it's up to you to implement interfaces!

AdvTxt extends Node's EventEmitter, so you can bind to a 'reply' event to get replies as they come in.


History
-------

- **v0.2.0**
	- Updates to a much more flexible database format, but is very buggy. No tests yet.
- **v0.1.1**
    - Adds tests, jshint. Fixes linting issues.
- **v0.1.0**
    - Moves application flow over to async library, more readable/testable.
- **v0.0.6**
    - AdvTxt now extends EventEmitter and emits 'reply' messages.
- **v0.0.5**
    - Now pushes replies into an array of messages; any reply handling modules will need to be updated.
- **v0.0.4**
    - Adds a new command parser with support for aliases.
- **v0.0.3**
    - Moves MongoDB interface to its own [lightweight adapter][advtxtmongo]


[advtxtmongo]: http://github.com/fardog/advtxt-db-mongo


The MIT License (MIT)
---------------------

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

