(function() {
  var Compiler, Lexer, Parser, render;
  Lexer = require('./lexer').Lexer;
  Parser = require('./Parser').Parser;
  Compiler = require('./Compiler').Compiler;
  render = function(template, model) {
    var compiler, parser, tmpl;
    parser = new Parser(new Lexer(template));
    console.dir(parser);
    compiler = new Compiler(parser);
    tmpl = compiler.compile();
    console.dir(tmpl);
    return tmpl.render(model);
  };
  exports.render = render;
}).call(this);
