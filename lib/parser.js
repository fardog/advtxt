/**
 * @overview The simple command parser used by AdvTxt
 * 
 * @since 0.0.4
 * @author Nathan Wittstock <code@fardogllc.com>
 * @license MIT License - See file 'LICENSE' in this project.
 */

var natural = require('natural');
var tokenizer = new natural.WordTokenizer();
var _ = require('underscore');
var Hoek = require('hoek');
var debug = require('debug')('parser');

var COMMANDS = {
  en: {
    GO: 'go',
    GET: 'get',
    RESET: 'reset',
    LOOK: 'look',
    EXITS: 'exits',
  }
};
var ALIASES = {
  en: {
    'walk': COMMANDS.en.GO,
    'move': COMMANDS.en.GO,
    'head': COMMANDS.en.GO,
    'grab': COMMANDS.en.GET,
    'take': COMMANDS.en.GET,
    'pick': COMMANDS.en.GET,
    'see': COMMANDS.en.LOOK,
    'peep': COMMANDS.en.LOOK
  }
};
var OPERATORS = {
  en: ['in', 'on', 'up', 'if']
};
var LINKERS = {
  en: ['and', 'or', 'then']
};
var FLUFF = {
  en: ['the']
};

var advtxt = {};

/**
 * Constructs a new AdvTxt Parser. This is a single-use class that should be 
 *  reinstantiated each time it parses a new command.
 *
 * @since 0.0.4
 * @constructor
 *
 * @param {command} command - The command object.
 * @param {string} lang - The language to be used, defaults to 'en'.
 *
 * @returns {boolean} If the parse was successful or not.
 */
exports = module.exports = advtxt.Parser = function(command, lang) {
  var self = this;


  if (typeof lang === 'undefined' || !lang) {
    debug("Setting lang to 'en'.");
    lang = 'en';
  }

  // parse the command, if we have a parser for that language defined
  if (typeof self.parse[lang] !== 'undefined') {
    return self.parse[lang](command.command);
  }
  else {
    throw "advtxt.Parser: language " + lang + " does not have an appropriate parser defined.";
  }
};

advtxt.Parser.prototype.parse = {};

/**
 * The English command parser. Parses the command at self.command, and alters 
 *  it for consumption outside this class.
 *
 * @returns {boolean} If the parse passed or not.
 */
advtxt.Parser.prototype.parse["en"] = function(cmd) {
  var self = this;

  debug("Starting to parse English.");

  var tokenized = tokenizer.tokenize(cmd.toLowerCase());
  var original_verb = null;
  var verb = null;
  var object = null;
  var operator = null;

  // Get rid of fluff words like "the"
  tokenized = _.difference(tokenized, FLUFF);

  // We don't handle compound statements, so fail if we see one.
  if (_.intersection(tokenized, LINKERS).length > 0) {
    debug("Got a linker word.");
    self.fail = true;
    return self;
  }

  // If we see a operator word after the verb, we can throw it out.
  if (tokenized.length > 2 && _.contains(OPERATORS["en"], tokenized[1])) {
    debug("Command contains operator in position 1");
    verb = tokenized[0];
    operator = tokenized[1];
    object = tokenized.slice(2).join("_");
  }
  // otherwise, we can just split it up
  else {
    verb = tokenized[0];
    object = tokenized.slice(1).join("_");
  }
  
  // now see if we have an alias
  if (typeof ALIASES.en[verb] !== 'undefined' && ALIASES.en[verb]) {
    debug("Parser saw an alias.");
    original_verb = Hoek.clone(verb);
    verb = ALIASES.en[verb];
    debug(verb);
  }
  else {
    debug("Setting verb");
    verb = COMMANDS.en[verb.toUpperCase()];
    if (typeof verb === 'undefined' || !verb) {
      verb = tokenized[0];
    }
    debug(verb);
  }

  cmd = {
    original: cmd,
    original_verb: original_verb,
    lang: self.lang,
    verb: verb,
    object: object
  };

  self.fail = false;
  self.command = cmd;
  self.commands = COMMANDS.en;
  debug(JSON.stringify(cmd));

  return self;
};
