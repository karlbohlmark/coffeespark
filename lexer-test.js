(function() {
  var Lexer, assert, test, tests;
  Lexer = require('./lexer').Lexer;
  assert = require('assert');
  tests = {
    'Can lex empty div': function(assert) {
      var l;
      l = new Lexer('<div></div>');
      console.dir(l);
      l.on('token', function(t) {
        console.dir('token');
        return console.dir(t);
      });
      l.next();
      return assert.ok(!!l);
    }
  };
  for (test in tests) {
    tests[test](assert);
  }
}).call(this);
