var fs = require('fs');
var path = require('path');
var files = fs.readdirSync(__dirname);
var assert = require('assert');
var mocha = require('mocha');
var suite = mocha.Suite;
var test = mocha.Test;

var cork = require('../cork');

describe('Compiler', function(){
  files.forEach(function(file){
    if(file.indexOf('.cork')==-1) return;
    console.log('adding test ' + file);
    it('should render ' + file.replace('.cork', ''), function(){
      var tmpl = fs.readFileSync(file).toString();
      var renderedExpected = fs.readFileSync(file.replace('.cork', '.html')).toString();
      var modelFilePath = file.replace('.cork', '.json');
      var model = path.existsSync(modelFilePath) ? require('./' + modelFilePath) : {};
      
      var source = cork.compile(tmpl);

      var template = eval(source);

      var rendered = template.render(model);

      assert.equal(renderedExpected, rendered);
    });
  });
});
