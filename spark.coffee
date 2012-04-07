Lexer = require('./lexer').Lexer
Parser = require('./Parser').Parser
Compiler = require('./Compiler').Compiler

render = (template, model) ->
  parser= new Parser(new Lexer(template))
  console.dir parser.parse()
  compiler = new Compiler()
  ###
  tmpl = compiler.compile()
  
  console.dir tmpl

  tmpl.render(model)
  ###
exports.render = render

