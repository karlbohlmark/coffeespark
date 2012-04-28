var fs = require('fs');
var path = require('path');
var files = fs.readdirSync(__dirname);
var assert = require('assert');
var mocha = require('mocha');
var suite = mocha.Suite;
var test = mocha.Test;
var Lexer = require('../lexer').Lexer;
var Compiler = require('../parser').Compiler;
var Parser = require('../parser').Parser;

var render = function(tmpl, model){
  var lexer = new Lexer(tmpl);
  var dom = new Parser(lexer).parse();
  var template = new Compiler(dom).compile();
  return template.render(model);
};

describe('Compiler', function(){
  files.forEach(function(file){
    if(file.indexOf('.cork')==-1) return;
    console.log('adding test ' + file);
    it('should render ' + file.replace('.cork', ''), function(){
      var tmpl = fs.readFileSync(file).toString();
      var renderedExpected = fs.readFileSync(file.replace('.cork', '.html')).toString();
      var modelFilePath = file.replace('.cork', '.json');
      var model = path.existsSync(modelFilePath) ? require('./' + modelFilePath) : {};
      var rendered = render(tmpl, model);
      assert.equal(renderedExpected, rendered);
    });
  });
});
