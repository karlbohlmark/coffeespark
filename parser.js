(function() {
  var Compiler, Lexer, Parser, c, dom, l, model, p, template;
  var __bind = function(func, context) {
    return function(){ return func.apply(context, arguments); };
  };
  Lexer = require('./lexer').Lexer;
  Parser = function(_arg) {
    this.lexer = _arg;
    this.dom = {
      template: {
        children: []
      },
      partials: {}
    };
    this.partials = this.dom.partials;
    this.deferredTokens = [];
    this.parent = this.dom;
    this.currentNode = this.dom.template;
    this.lexer.on('token', __bind(function(token) {
      console.log(token);
      return this.receive(token);
    }, this));
    return this;
  };
  Parser.prototype.receive = function(token) {
    var _ref;
    if (token.type === 'tagend') {
      return (this.currentNode = this.parent);
    }
    if (!(typeof (_ref = this.currentNode.children) !== "undefined" && _ref !== null)) {
      this.currentNode.children = [];
    }
    if (token.type === 'attribute') {
      if (!(typeof (_ref = this.currentNode.attributes) !== "undefined" && _ref !== null)) {
        this.currentNode.attributes = [];
      }
      switch (token.name) {
        case 'partial':
          this.currentNode.partial = token.value;
          break;
        case 'each':
          this.currentNode.each = token.value;
          break;
        default:
          this.currentNode.attributes.push(token);
      }
      return null;
    }
    this.currentNode.children.push(token);
    if (token.type === 'tag') {
      this.parent = this.currentNode;
      return (this.currentNode = token);
    }
  };
  Parser.prototype.parse = function() {
    while (this.lexer.pos < this.lexer.length) {
      this.lexer.next();
    }
    return this.dom;
  };
  Compiler = function(_arg) {
    this.dom = _arg;
    this.indentation = '';
    this.partials = {};
    this.eachSeqNo = 0;
    return this;
  };
  Compiler.prototype.selfClosing = {
    'input': true,
    'link': true,
    'img': true
  };
  Compiler.prototype.funcStart = 'var model = arguments[0], models=[], output=\'\';\n';
  Compiler.prototype.funcEnd = 'return output;\n';
  Compiler.prototype.renderers = {
    tag: function(element) {
      var _i, _len, _ref, _result, attr, buffer, child, children, collection, el, parts, selfClose, varname;
      buffer = "";
      selfClose = this.selfClosing[element.value];
      if (typeof (_ref = element.each) !== "undefined" && _ref !== null) {
        this.eachSeqNo++;
        parts = element.each.split(' ');
        varname = parts[0];
        collection = parts[2];
        buffer += ("models.unshift(model);\neachmodel" + (this.eachSeqNo) + "=model." + (collection) + ";\n");
        buffer += ("for(" + (varname) + " in eachmodel" + (this.eachSeqNo) + "){\n");
        buffer += ("model = {'" + (varname) + "':eachmodel" + (this.eachSeqNo) + "[" + (varname) + "]}\n");
      }
      buffer += ("output+='" + (this.indentation) + "<" + (element.value));
      if (typeof (_ref = element.attributes) !== "undefined" && _ref !== null) {
        _ref = element.attributes;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          attr = _ref[_i];
          buffer += this.renderers.attribute.call(this, attr);
        }
      }
      selfClose || (buffer += '>');
      buffer += '\'\n';
      children = (function() {
        _result = []; _ref = element.children;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          el = _ref[_i];
          _result.push(this.createRenderer(el));
        }
        return _result;
      }).call(this);
      _ref = children;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        child = _ref[_i];
        buffer += child;
      }
      if (selfClose) {
        buffer += ("output+='" + (this.indentation) + "/>'\n");
      } else {
        buffer += ("output+='" + (this.indentation) + "</" + (element.value) + ">'\n");
      }
      if (typeof (_ref = element.each) !== "undefined" && _ref !== null) {
        buffer += "}\n";
        buffer += "model=models.shift()\n";
      }
      if (typeof (_ref = element.partial) !== "undefined" && _ref !== null) {
        console.log('\n' + buffer + '\n');
        this.partials[element.partial] = this.funcStart + buffer + this.funcEnd;
      }
      return buffer;
    },
    attribute: function(element) {
      var _i, _len, _ref, buffer, item;
      buffer = (" " + (element.name) + "=");
      if (typeof element.value === "string") {
        buffer += "\"" + element.value + "\"";
      } else {
        buffer += "'";
        _ref = element.value;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          item = _ref[_i];
          buffer += " + " + ((item.type === "content") ? "'" + item.value + "'" : ("model." + (item.value)));
        }
        buffer += " + '";
      }
      return buffer;
    },
    content: function(element) {
      if (element.value === '') {
        return '';
      }
      return "output+='" + (this.indentation) + "  " + (element.value) + "'\n";
    },
    ref: function(element) {
      return "output+='" + (this.indentation) + "' + model." + (element.value) + "\n";
    }
  };
  Compiler.prototype.compile = function() {
    var _i, _len, _ref, _result, buffer, element, renderer, renderers;
    buffer = this.funcStart;
    renderers = (function() {
      _result = []; _ref = this.dom.template.children;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        element = _ref[_i];
        _result.push(this.createRenderer(element));
      }
      return _result;
    }).call(this);
    _ref = renderers;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      renderer = _ref[_i];
      (buffer += renderer);
    }
    buffer += this.funcEnd;
    return {
      render: new Function(buffer),
      partials: this.partials
    };
  };
  Compiler.prototype.createRenderer = function(element) {
    return this.renderers[element.type].call(this, element);
  };
  Compiler.prototype.stringOrRef = function(value) {
    if (typeof value === "string") {
      return value;
    }
    return item.type === (typeof "content" !== "undefined" && "content" !== null) ? "content" : item.value;
  };
  l = new Lexer('<div class="tes${testar}" id="myid"><input type="text"/></div>');
  p = new Parser(l);
  dom = p.parse();
  c = new Compiler(dom);
  template = c.compile();
  console.log(JSON.stringify(dom));
  model = {
    title: "test title"
  };
  console.log(template.render({
    products: [
      {
        name: "the first product",
        tags: ['good', 'cheap']
      }, {
        name: "bicycle",
        tags: ['expensive', 'red']
      }
    ],
    title: "some title"
  }));
  console.log(template.render.toString());
}).call(this);
