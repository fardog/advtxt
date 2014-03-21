AdvTxt
======

A text adventure engine.

Installation
------------

```
npm install advtxt
```

Usage
-----

When you set up AdvTxt, you need to give it a backing store. What follows is an example using the [advtxt-db-mongo][advtxtmongo] module, and the [advtxt-readline](http://github.com/fardog/advtxt-readline) module for I/O.

```
var config = {
	adapter: 'mongodb',
	mongodb: {
		uri: 'mongodb://localhost/advtxt-test'
	}
};

var advDbMongo = new (require('advtxt-db-mongo'))();
var advtxt = new (require('advtxt'))();
var advtxtreadline = require('advtxt-readline');

advDbMongo.initialize(config, function(err, dbAdapter) {
	if (err) throw err;

	advtxt.initialize(dbAdapter);
	var AdvTxt = new advtxtreadline(advtxt);
});
```

There's only one public function you should use, `advtxt.processCommand(command)` where `command` is in the following format:

```
var command = {
    command: "Your command text",
    player: "playerName",
    reply: function(message) {
        console.log(message);
    }
};
```

AdvTxt doesn't do any authentication on it's own, that's for you to implement in your interface. All output is sent through the `reply` function you provide.


History
-------

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

