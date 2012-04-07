(function() {
  var Compiler, Lexer, Parser, c, dom, l, model, p, template, tmpl;

  Lexer = require('./lexer') && require('./lexer').Lexer || window.Lexer;

  Parser = (function() {

    function Parser(lexer) {
      var _this = this;
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
      this.lexer.on('token', function(token) {
        console.log(token);
        return _this.receive(token);
      });
    }

    Parser.prototype.receive = function(token) {
      if (token.type === 'tagend') return this.currentNode = this.parent;
      if (!(this.currentNode.children != null)) this.currentNode.children = [];
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

    Compiler.renderFnCounter = 0;

    Compiler.functions = [];

    Compiler.prototype.selfClosing = {
      'input': true,
      'link': true,
      'img': true
    };

    Compiler.prototype.funcStart = 'var model = arguments[0], models=[], output=\'\';\n';

    Compiler.prototype.funcEnd = 'return output;\n';

    Compiler.prototype.startTagRenderer = function(bufferName, tagname, attributes) {
      var attr, buf, _i, _len, _ref;
      buf = "" + bufferName + "+='<" + tagname + "'";
      _ref = attributes || [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        attr = _ref[_i];
        buf += ("" + bufferName + "+='") + this.renderers.attribute.call(this, attr) + "'";
      }
      if (this.selfClosing[tagname]) {
        "" + bufferName + "+='/>'";
      } else {
        "" + bufferName + "+='>'";
      }
      return buf;
    };

    Compiler.prototype.renderers = {
      tag: function(element) {
        var buffer, child, children, el, fnName, selfClose, _i, _j, _len, _len2;
        selfClose = this.selfClosing[element.value];
        fnName = "" + element.value + (this.renderFnCounter++);
        buffer = '';
        buffer += "function " + fnName + "(model){\nvar output='';\n";
        buffer += this.startTagRenderer('output', element.value, element.attributes);
        children = (function() {
          var _i, _len, _ref, _results;
          _ref = element.children || [];
          _results = [];
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            el = _ref[_i];
            _results.push(this.createRenderer(el));
          }
          return _results;
        }).call(this);
        for (_i = 0, _len = children.length; _i < _len; _i++) {
          child = children[_i];
          buffer += child.name + '()';
        }
        console.log('about to push function ' + Object.keys(this).join(''));
        for (_j = 0, _len2 = children.length; _j < _len2; _j++) {
          child = children[_j];
          this.functions.push(child);
        }
        if (!selfClose) buffer += "output+='</" + element.value + ">';\n";
        /*
                    if element.each?
                        buffer+="}\n"
                        buffer+="model=models.shift();\n"
        */
        /*
                    if element.partial?
                        console.log '\n' + buffer + '\n'
                        @partials[element.partial] = @funcStart+buffer+@funcEnd
        */
        return {
          name: fnName,
          body: buffer
        };
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
        if (element.value === '') return '';
        return "output+='" + this.indentation + "  " + (element.value.replace('\n', '\\n')) + "';\n";
      },
      ref: function(element) {
        return "output+='" + this.indentation + "  ' + model." + element.value + ";\n";
      }
    };

    Compiler.prototype.compile = function() {
      var buffer, element, renderers, _i, _len, _ref;
      buffer = '';
      _ref = this.dom.template.children;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        element = _ref[_i];
        renderers = this.createRenderer(element);
      }
      console.log(JSON.stringify(renderers));
      buffer += '';
      return {
        render: function() {}
      };
    };

    Compiler.prototype.createRenderer = function(element) {
      return this.renderers[element.type].call(this, element);
    };

    Compiler.prototype.stringOrRef = function(value) {
      var _ref;
      if (typeof value === "string") return value;
      return (_ref = item.type === "content") != null ? _ref : item.value;
    };

    return Compiler;

  })();

  exports.Parser = Parser;

  /*
  exports.Compiler = Compiler
  
  exports.Parser = Parser
  exports.Compiler = Compiler
  */

  tmpl = '<div class="test"><span>${title}</span><div partial="magicpartial" each="product in products">${product.name}<span each="tag in product.tags">${tag}</span></div></div>';

  l = new Lexer(tmpl);

  p = new Parser(l);

  dom = p.parse();

  c = new Compiler(dom);

  template = c.compile();

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

  /*
  (typeof window != "undefined") && (window.Spark = {}) && (window.Spark.Parser = Parser) && (window.Spark.Compiler = Compiler)
  */

}).call(this);
