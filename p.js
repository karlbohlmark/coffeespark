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
      this.renderFnCounter = 0;
      this.renderFnNames = {};
      this.functions = [];
    }

    Compiler.prototype.selfClosing = {
      'input': true,
      'link': true,
      'img': true
    };

    Compiler.prototype.funcStart = 'var model = arguments[0], models=[], output=\'\';\n';

    Compiler.prototype.funcEnd = 'return output;\n';

    Compiler.prototype.startTagRenderer = function(bufferName, tagname, attributes) {
      var attr, buf, _i, _len, _ref;
      buf = "" + bufferName + "+='<" + tagname + "';";
      _ref = attributes || [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        attr = _ref[_i];
        buf += ("" + bufferName + "+='") + this.renderers.attribute.call(this, attr) + "';";
      }
      buf += this.selfClosing[tagname] ? "" + bufferName + "+='/>';" : "" + bufferName + "+='>';";
      return buf;
    };

    Compiler.prototype.parseEachAttr = function(each) {
      var collection, collectionName, parts, varname;
      parts = each.split(' ');
      varname = parts[0];
      collection = parts[2];
      collectionName = collection.split('.').pop();
      return {
        varname: varname,
        collectionName: collectionName,
        collection: collection
      };
    };

    Compiler.prototype.getRenderFnName = function(element) {
      var name;
      if (element.each) {
        name = this.parseEachAttr(element.each).collectionName;
        if (this.renderFnNames.hasOwnProperty(name)) {
          name += this.renderFnCounter++;
        }
      } else {
        name = "" + element.value + (this.renderFnCounter++);
      }
      this.renderFnNames[name] = 1;
      return name;
    };

    Compiler.prototype.renderers = {
      tag: function(element) {
        var buffer, child, children, collection, collectionName, el, fnName, loopCollection, selfClose, varname, _i, _j, _len, _len2, _ref;
        selfClose = this.selfClosing[element.value];
        fnName = element.partial || this.getRenderFnName(element);
        buffer = '';
        buffer += "var output='';\n";
        if (element.each != null) {
          _ref = this.parseEachAttr(element.each), varname = _ref.varname, collectionName = _ref.collectionName, collection = _ref.collection;
          loopCollection = "" + collectionName + this.eachSeqNo;
          buffer += "model." + collection + ".forEach(function(" + varname + "){ var model= {" + varname + ":" + varname + "};\n";
        }
        buffer += this.startTagRenderer('output', element.value, element.attributes);
        children = (function() {
          var _i, _len, _ref2, _results;
          _ref2 = element.children || [];
          _results = [];
          for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
            el = _ref2[_i];
            _results.push(this.createRenderer(el));
          }
          return _results;
        }).call(this);
        for (_i = 0, _len = children.length; _i < _len; _i++) {
          child = children[_i];
          buffer += (child.name ? "output+=this." + child.name + ".call(this, model);" : child);
        }
        for (_j = 0, _len2 = children.length; _j < _len2; _j++) {
          child = children[_j];
          if (child.name != null) this.functions.push(child);
        }
        if (!selfClose) buffer += "output+='</" + element.value + ">';\n";
        if (element.each != null) buffer += '}.bind(this));';
        buffer += 'return output;';
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
      var buffer, element, entry, entryFn, parts, renderers, templ;
      buffer = '';
      renderers = (function() {
        var _i, _len, _ref, _results;
        _ref = this.dom.template.children;
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          element = _ref[_i];
          _results.push(this.createRenderer(element));
        }
        return _results;
      }).call(this);
      entry = renderers[0];
      templ = "template = {\nrender: function(model){" + entry.body + "}";
      this.functions.forEach(function(r) {
        return templ += ", " + r.name + ": function(model){" + r.body + "}";
      });
      templ += "};/*end template*/";
      parts = {};
      this.functions.forEach(function(r) {
        return parts[r.name] = new Function('model', 'console.log(JSON.stringify(model));' + r.body);
      });
      console.log(templ);
      entryFn = new Function('model', entry.body);
      buffer += '';
      return {
        render: function(model) {
          return entryFn.call(parts, model);
        }
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

  tmpl = '<div class="test"><span partial="title">${title}</span><div each="product in products" data-id="${product.id}">${product.name}<span each="tag in product.tags">${tag}</span></div></div>';

  l = new Lexer(tmpl);

  p = new Parser(l);

  dom = p.parse();

  console.log("----" + JSON.stringify(dom) + "----");

  c = new Compiler(dom);

  template = c.compile();

  model = {
    title: "test title"
  };

  console.log(template.render({
    products: [
      {
        id: 1,
        name: "the first product",
        tags: ['good', 'cheap']
      }, {
        id: 2,
        name: "bicycle",
        tags: ['expensive', 'red']
      }
    ],
    title: "some title"
  }));

  if (typeof window !== void 0) {
    window.Spark = {
      Compiler: Compiler,
      Parser: Parser,
      Lexer: Lexer
    };
  }

  /*
  (typeof window != "undefined") && (window.Spark = {}) && (window.Spark.Parser = Parser) && (window.Spark.Compiler = Compiler)
  */

}).call(this);
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
      this.renderFnCounter = 0;
      this.renderFnNames = {};
      this.functions = [];
    }

    Compiler.prototype.selfClosing = {
      'input': true,
      'link': true,
      'img': true
    };

    Compiler.prototype.funcStart = 'var model = arguments[0], models=[], output=\'\';\n';

    Compiler.prototype.funcEnd = 'return output;\n';

    Compiler.prototype.startTagRenderer = function(bufferName, tagname, attributes) {
      var attr, buf, _i, _len, _ref;
      buf = "" + bufferName + "+='<" + tagname + "';";
      _ref = attributes || [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        attr = _ref[_i];
        buf += ("" + bufferName + "+='") + this.renderers.attribute.call(this, attr) + "';";
      }
      buf += this.selfClosing[tagname] ? "" + bufferName + "+='/>';" : "" + bufferName + "+='>';";
      return buf;
    };

    Compiler.prototype.parseEachAttr = function(each) {
      var collection, collectionName, parts, varname;
      parts = each.split(' ');
      varname = parts[0];
      collection = parts[2];
      collectionName = collection.split('.').pop();
      return {
        varname: varname,
        collectionName: collectionName,
        collection: collection
      };
    };

    Compiler.prototype.getRenderFnName = function(element) {
      var name;
      if (element.each) {
        name = this.parseEachAttr(element.each).collectionName;
        if (this.renderFnNames.hasOwnProperty(name)) {
          name += this.renderFnCounter++;
        }
      } else {
        name = "" + element.value + (this.renderFnCounter++);
      }
      this.renderFnNames[name] = 1;
      return name;
    };

    Compiler.prototype.renderers = {
      tag: function(element) {
        var buffer, child, children, collection, collectionName, el, fnName, loopCollection, selfClose, varname, _i, _j, _len, _len2, _ref;
        selfClose = this.selfClosing[element.value];
        fnName = element.partial || this.getRenderFnName(element);
        buffer = '';
        buffer += "var output='';\n";
        if (element.each != null) {
          _ref = this.parseEachAttr(element.each), varname = _ref.varname, collectionName = _ref.collectionName, collection = _ref.collection;
          loopCollection = "" + collectionName + this.eachSeqNo;
          buffer += "model." + collection + ".forEach(function(" + varname + "){ var model= {" + varname + ":" + varname + "};\n";
        }
        buffer += this.startTagRenderer('output', element.value, element.attributes);
        children = (function() {
          var _i, _len, _ref2, _results;
          _ref2 = element.children || [];
          _results = [];
          for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
            el = _ref2[_i];
            _results.push(this.createRenderer(el));
          }
          return _results;
        }).call(this);
        for (_i = 0, _len = children.length; _i < _len; _i++) {
          child = children[_i];
          buffer += (child.name ? "output+=this." + child.name + ".call(this, model);" : child);
        }
        for (_j = 0, _len2 = children.length; _j < _len2; _j++) {
          child = children[_j];
          if (child.name != null) this.functions.push(child);
        }
        if (!selfClose) buffer += "output+='</" + element.value + ">';\n";
        if (element.each != null) buffer += '}.bind(this));';
        buffer += 'return output;';
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
      var buffer, element, entry, entryFn, parts, renderers, templ;
      buffer = '';
      renderers = (function() {
        var _i, _len, _ref, _results;
        _ref = this.dom.template.children;
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          element = _ref[_i];
          _results.push(this.createRenderer(element));
        }
        return _results;
      }).call(this);
      entry = renderers[0];
      templ = "template = {\nrender: function(model){" + entry.body + "}";
      this.functions.forEach(function(r) {
        return templ += ", " + r.name + ": function(model){" + r.body + "}";
      });
      templ += "};/*end template*/";
      parts = {};
      this.functions.forEach(function(r) {
        return parts[r.name] = new Function('model', 'console.log(JSON.stringify(model));' + r.body);
      });
      console.log(templ);
      entryFn = new Function('model', entry.body);
      buffer += '';
      return {
        render: function(model) {
          return entryFn.call(parts, model);
        }
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

  tmpl = '<div class="test"><span partial="title">${title}</span><div each="product in products" data-id="${product.id}">${product.name}<span each="tag in product.tags">${tag}</span></div></div>';

  l = new Lexer(tmpl);

  p = new Parser(l);

  dom = p.parse();

  console.log("----" + JSON.stringify(dom) + "----");

  c = new Compiler(dom);

  template = c.compile();

  model = {
    title: "test title"
  };

  console.log(template.render({
    products: [
      {
        id: 1,
        name: "the first product",
        tags: ['good', 'cheap']
      }, {
        id: 2,
        name: "bicycle",
        tags: ['expensive', 'red']
      }
    ],
    title: "some title"
  }));

  if (typeof window !== void 0) {
    window.Spark = {
      Compiler: Compiler,
      Parser: Parser,
      Lexer: Lexer
    };
  }

  /*
  (typeof window != "undefined") && (window.Spark = {}) && (window.Spark.Parser = Parser) && (window.Spark.Compiler = Compiler)
  */

}).call(this);
