(function() {
  var Compiler, Parser, alert, longtemplate, p, t, templ;
  if (!(typeof alert != "undefined" && alert !== null)) {
    if (typeof window != "undefined" && window !== null) {
      alert = window.alert;
    } else {
      alert = require('sys').puts;
    }
  }
  Parser = (function() {
    function Parser(buffer, pos) {
      this.buffer = buffer;
      this.pos = pos;
      this.length = this.buffer.length;
    }
    Parser.prototype._identifier = /\w[\w\d]*/;
    Parser.prototype._text = /[^<]*/;
    Parser.prototype._interpolation = /\$\{(\w[\w\d]*)\}/g;
    Parser.prototype._tags = [];
    Parser.prototype.partials = {};
    Parser.prototype.atEnd = function() {
      return this.pos === this.length - 1;
    };
    Parser.prototype.skipWs = function() {
      var len;
      len = this.buffer.length;
      while (this.pos < len && this.buffer.charAt(this.pos) === ' ') {
        this.pos++;
      }
      return this;
    };
    Parser.prototype.expect = function(expected, extra) {
      var cmp, s;
      s = this.tail();
      cmp = s.substr(0, expected.length);
      if (cmp !== expected) {
        throw "Expected #expected but got #cmp";
      }
      this.pos += expected.length;
      return this;
    };
    Parser.prototype.tail = function() {
      return this.buffer.substr(this.pos, this.buffer.length - this.pos);
    };
    Parser.prototype.read = function(r) {
      var length, match, matches, pos, s;
      s = this.tail();
      pos = s.search(r);
      matches = s.match(r);
      if (match === null) {
        alert("failed to read #r from #s");
      }
      match = matches[0];
      length = match.length;
      this.pos += pos + length;
      return match;
    };
    Parser.prototype.readIdentifier = function() {
      return this.read(this._identifier);
    };
    Parser.prototype.peekNonWs = function() {
      var s;
      s = this.tail();
      return s.charAt(s.search(/[^\s]/));
    };
    Parser.prototype.peek = function(n) {
      var s;
      s = this.tail();
      return s.substr(0, n || 1);
    };
    Parser.prototype.readUntil = function(r) {
      var pos, s;
      s = this.tail();
      pos = s.search(r);
      this.pos += pos;
      return s.substr(0, pos);
    };
    Parser.prototype.readAttribute = function() {
      var name, value;
      this.skipWs();
      name = this.readIdentifier();
      this.expect('=');
      this.expect('"');
      value = this.readUntil(/"/);
      this.expect('"');
      return {
        name: name,
        value: value
      };
    };
    Parser.prototype.readText = function() {
      var ref, references, text, type, _i, _len;
      text = this.read(this._text);
      if ((references = text.match(this._interpolation)) != null) {
        type = "interpolation";
        references = text.match(this._interpolation);
        for (_i = 0, _len = references.length; _i < _len; _i++) {
          ref = references[_i];
          this._tags[0].refs.push(ref);
        }
        return {
          type: type,
          text: text,
          references: references
        };
      }
      return {
        type: "text",
        text: text
      };
    };
    Parser.prototype.readCodeBlock = function() {
      var ref;
      this.expect('${');
      ref = this.readIdentifier();
      this.expect('}');
      return {
        'type': 'ref',
        ref: ref
      };
    };
    Parser.prototype.readTag = function() {
      var attr, attribs, children, name, next, partial, tag, _i, _len, _ref;
      this.expect('<');
      name = this.readIdentifier();
      this.skipWs();
      attribs = {};
      tag = {
        name: name,
        attribs: attribs,
        type: 'tag',
        refs: []
      };
      this._tags.unshift(tag);
      _ref = ((function() {
        var _results;
        _results = [];
        while (this.peekNonWs().match(/\w/)) {
          _results.push(this.readAttribute());
        }
        return _results;
      }).call(this));
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        attr = _ref[_i];
        attribs[attr.name] = attr.value;
      }
      partial = attribs[partial];
      if (partial) {
        this.partials[partial] = tag;
      }
      this.skipWs();
      if (typeof debug != "undefined" && debug !== null) {
        alert(this.tail());
      }
      this.expect('>');
      children = (function() {
        var _results;
        _results = [];
        while ((next = this.peek(2)) && next && '</' !== next) {
          _results.push(next.charAt(0) === '<' ? this.readTag() : this.readText());
        }
        return _results;
      }).call(this);
      this._tags.shift();
      this.expect('</');
      this.expect(name, 'End of tag');
      this.expect('>');
      tag.children = children;
      return tag;
    };
    Parser.prototype.readWhitespace = function() {
      var text;
      text = this.read(/\s*/);
      return {
        type: "whitespace",
        text: text
      };
    };
    Parser.prototype.readTemplate = function() {
      var dom, next, partials;
      this.skipWs();
      dom = (function() {
        var _results;
        _results = [];
        while ((next = this.peek())) {
          _results.push(next === '<' ? this.readTag() : next.match(/^\s$/) ? this.readWhitespace() : this.readText());
        }
        return _results;
      }).call(this);
      partials = this.partials;
      return {
        dom: dom,
        partials: partials
      };
    };
    return Parser;
  })();
  Compiler = (function() {
    function Compiler(dom) {
      this.dom = dom;
      this.buffer = '';
      this.length = this.dom.length;
      this.partials = this.dom.filter(function(e) {
        return e.attribs && e.attribs.partial;
      });
      this.pos = 0;
    }
    Compiler.eat = function() {
      return this.dom[this.pos++];
    };
    Compiler.prototype.evalCondition = function(cond, model) {
      var evil;
      evil = "(function(){ ";
      evil += "return " + cond + "})()";
      return eval(evil);
    };
    Compiler.prototype.createObject = function(prop, val) {
      var obj;
      obj = {};
      obj[prop] = val;
      return obj;
    };
    Compiler.prototype.renderTag = function(elem, model, inEachLoop) {
      var attribs, attrs, b, collection, cond, each, element, hasAttribs, i, inPos, item, key, value, varname, _i, _len, _len2, _ref, _ref2, _ref3;
      b = "";
      if ((cond = elem.attribs["if"]) && !this.evalCondition(cond, model)) {
        return "";
      }
      attribs = Object.keys(elem.attribs);
      hasAttribs = attribs.length > 0;
      if ((each = elem.attribs['each']) && !inEachLoop) {
        inPos = each.search(/[ ]in /);
        varname = each.substr(0, inPos);
        collection = each.substr(inPos + 4, each.length - inPos - 4);
        _ref = this.getPropVal(model, collection);
        for (i = 0, _len = _ref.length; i < _len; i++) {
          item = _ref[i];
          b += this.renderElement(elem, this.createObject(varname, item), true, i);
        }
        return b;
      }
      b += "b+=\"<" + elem.name + "\"\n";
      elem.attribs["data-refs"] = elem.refs;
      if (each) {
        elem.attribs["data-enumeration"] = each;
      }
      attrs = '';
      _ref2 = elem.attribs;
      for (key in _ref2) {
        value = _ref2[key];
        if (key !== 'each' && key !== 'if') {
          attrs += ' ' + key + '="' + value + '"';
        }
      }
      if (attrs.length > 0) {
        b += "b+=\"" + attrs + "\"\n";
      }
      b += 'b+=">"';
      _ref3 = elem.children;
      for (_i = 0, _len2 = _ref3.length; _i < _len2; _i++) {
        element = _ref3[_i];
        b += this.renderElement(element, model);
      }
      b += "b+=\"</" + elem.name + ">\"\n";
      return b;
    };
    Compiler.prototype.getPropVal = function(model, propname) {
      var prop, val;
      val = prop = model[propname];
      if (typeof prop === "function") {
        val = prop.call(model);
      }
      return "model[" + propname + "]";
    };
    Compiler.prototype.interpolate = function(elem, model) {
      var prop, ref, text, _i, _len, _ref;
      text = elem.text;
      _ref = elem.references;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        ref = _ref[_i];
        prop = ref.match(/\${([^}]*)}/)[1];
        text = text.replace(new RegExp("\\" + ref), "\"+" + (this.getPropVal(model, prop))(+"+\""));
      }
      return "b+=\"" + text + "\"\n";
    };
    Compiler.prototype.compilePartial = function(element) {};
    Compiler.prototype.renderElement = function(elem, model, inEachLoop) {
      switch (elem.type) {
        case "tag":
          return this.renderTag(elem, model, inEachLoop);
        case "text":
          return "b+=\"" + elem.text + "\"";
        case "interpolation":
          return this.interpolate(elem, model);
        case "whitespace":
          return "b+=\"" + elem.text + "\"";
        default:
          return "unknown: " + elem.text;
      }
    };
    Compiler.prototype.renderTemplate = function(model) {
      var b, element, elements, _i, _j, _len, _len2, _ref, _ref2;
      b = "{\n";
      _ref = this.partials;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        element = _ref[_i];
        b += this.compilePartial(element);
      }
      elements = "";
      _ref2 = this.dom;
      for (_j = 0, _len2 = _ref2.length; _j < _len2; _j++) {
        element = _ref2[_j];
        elements += this.renderElement(element, model);
      }
      return b + ", render : function(model) { \n" + elements + "\n}\n";
    };
    return Compiler;
  })();
  /*
  class Compiler
      constructor: (@dom) ->
          this.pos = 0


      compile:() ->
          b=""
          b+=@renderElement( element, model) for element in @dom
          b
  */
  longtemplate = '\
<h1>${header}</h1>\
<div partial="hellopartial" test="value" src="/somepath">\nDet var en gång för länge sedan\n<p if="variable!=2">en konstigt ${header} placerad paragraf ${variable}</p><span each="product in products">${product}</span></div> asdf';
  if (typeof window != "undefined" && window !== null) {
    window.Parser = Parser;
    window.Compiler = Compiler;
  }
  templ = "<div>${smth}<ul partial=\"mypartial\"><li>t</li></ul></div>";
  p = new Parser(templ, 0);
  /*
  alert JSON.stringify(p.expect('<').readIdentifier())
  */
  t = p.readTemplate();
  alert(new Compiler(t.dom).renderTemplate({
    'variable': 'testar',
    header: "rubrik",
    products: ["spis", "afa"]
  }));
}).call(this);
