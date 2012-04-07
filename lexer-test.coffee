Lexer = require('./lexer').Lexer
assert = require 'assert'
tests = {
  'Can lex empty div': (assert, finish) ->
    l = new Lexer('<div></div>')
    console.dir l
    l.on('token', (t)->
      assert.equals(t.value, 'div')
      #finish()
    )
      
    l.next()

    assert.ok(!!l)
}

tests[test](assert) for test of tests

