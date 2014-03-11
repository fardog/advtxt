AdvTxt
======

A text adventure engine that uses MongoDB as its backing store.

Usage
-----

AdvTxt is not published to `npm` yet, and won't be until it's more complete. To use AdvTxt, clone it locally and:

```
var yourMongoConnectionUrl = 'mongodb://localhost/advtxt';
var advtxt = new (require('advtxt'))(yourMongoConnectionUrl);
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

