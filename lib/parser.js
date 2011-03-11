(function() {
  var Compiler, Lexer, Parser, c, dom, l, model, p, template;
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
  Lexer = require('./lexer') && require('./lexer').Lexer || window.Lexer;
  Parser = (function() {
    function Parser(lexer) {
      this.lexer = lexer;
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
    }
    Parser.prototype.receive = function(token) {
      if (token.type === 'tagend') {
        return this.currentNode = this.parent;
      }
      if (!(this.currentNode.children != null)) {
        this.currentNode.children = [];
      }
      if (token.type === 'attribute') {
        if (!(this.currentNode.attributes != null)) {
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
        return;
      }
      this.currentNode.children.push(token);
      if (token.type === 'tag') {
        this.parent = this.currentNode;
        return this.currentNode = token;
      }
    };
    Parser.prototype.parse = function() {
      while (this.lexer.pos < this.lexer.length) {
        this.lexer.next();
      }
      return this.dom;
    };
    return Parser;
  })();
  Compiler = (function() {
    function Compiler(dom) {
      this.dom = dom;
      this.indentation = '';
      this.partials = {};
      this.eachSeqNo = 0;
    }
    Compiler.prototype.selfClosing = {
      'input': true,
      'link': true,
      'img': true
    };
    Compiler.prototype.funcStart = 'var model = arguments[0], models=[], output=\'\';\n';
    Compiler.prototype.funcEnd = 'return output;\n';
    Compiler.prototype.renderers = {
      tag: function(element) {
        var attr, buffer, child, children, collection, el, parts, selfClose, varname, _i, _j, _k, _len, _len2, _len3, _ref, _ref2;
        buffer = "";
        selfClose = this.selfClosing[element.value];
        if (element.each != null) {
          this.eachSeqNo++;
          parts = element.each.split(' ');
          varname = parts[0];
          collection = parts[2];
          buffer += "models.unshift(model);\neachmodel" + this.eachSeqNo + "=model." + collection + ";\n";
          buffer += "for(" + varname + " in eachmodel" + this.eachSeqNo + "){\n";
          buffer += "model = {'" + varname + "':eachmodel" + this.eachSeqNo + "[" + varname + "]};\n";
        }
        buffer += "output+='" + this.indentation + "<" + element.value;
        if (element.attributes != null) {
          _ref = element.attributes;
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            attr = _ref[_i];
            buffer += this.renderers.attribute.call(this, attr);
          }
        }
        selfClose || (buffer += '>');
        buffer += '\';\n';
        _ref2 = element.children;
        for (_j = 0, _len2 = _ref2.length; _j < _len2; _j++) {
          el = _ref2[_j];
          children = this.createRenderer(el);
        }
        for (_k = 0, _len3 = children.length; _k < _len3; _k++) {
          child = children[_k];
          buffer += child;
        }
        if (selfClose) {
          buffer += "output+='" + this.indentation + "/>';\n";
        } else {
          buffer += "output+='" + this.indentation + "</" + element.value + ">';\n";
        }
        if (element.each != null) {
          buffer += "}\n";
          buffer += "model=models.shift();\n";
        }
        if (element.partial != null) {
          console.log('\n' + buffer + '\n');
          this.partials[element.partial] = this.funcStart + buffer + this.funcEnd;
        }
        return buffer;
      },
      attribute: function(element) {
        var buffer, item, _i, _len, _ref;
        buffer = " " + element.name + "=";
        if (typeof element.value === "string") {
          buffer += "\"" + element.value + "\"";
        } else {
          buffer += "'";
          _ref = element.value;
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            item = _ref[_i];
            buffer += " + " + (item.type === "content" ? "'" + item.value + "'" : "model." + item.value);
          }
          buffer += " + '";
        }
        return buffer;
      },
      content: function(element) {
        if (element.value === '') {
          return '';
        }
        return "output+='" + this.indentation + "  " + (element.value.replace('\n', '\\n')) + "';\n";
      },
      ref: function(element) {
        return "output+='" + this.indentation + "' + model." + element.value + ";\n";
      }
    };
    Compiler.prototype.compile = function() {
      var buffer, element, renderer, renderers, _i, _j, _len, _len2, _ref;
      buffer = this.funcStart;
      _ref = this.dom.template.children;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        element = _ref[_i];
        renderers = this.createRenderer(element);
      }
      for (_j = 0, _len2 = renderers.length; _j < _len2; _j++) {
        renderer = renderers[_j];
        buffer += renderer;
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
      var _ref;
      if (typeof value === "string") {
        return value;
      }
      return (_ref = item.type === "content") != null ? _ref : item.value;
    };
    return Compiler;
  })();
  l = new Lexer('<div class="test"><span>${title}</span><div partial="magicpartial" each="product in products">${product.name}<span each="tag in product.tags">${tag}</span></div></div>');
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
  (typeof window !== "undefined") && (window.Spark = {}) && (window.Spark.Parser = Parser) && (window.Spark.Compiler = Compiler);
}).call(this);
