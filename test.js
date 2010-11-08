(function() {
  var Compiler, Parser, alert, longtemplate, p, t, templ;
  if (!(typeof alert !== "undefined" && alert !== null)) {
    if ((typeof window !== "undefined" && window !== null)) {
      alert = window.alert;
    } else {
      alert = require('sys').puts;
    };
  };
  Parser = function(_a, _b) {
    this.pos = _b;
    this.buffer = _a;
    this.length = this.buffer.length;
    return this;
  };
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
    if ((cmp !== expected)) {
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
    var _a, _b, _c, _d, ref, references, text, type;
    text = this.read(this._text);
    if ((typeof (_d = (references = text.match(this._interpolation))) !== "undefined" && _d !== null)) {
      type = "interpolation";
      references = text.match(this._interpolation);
      _b = references;
      for (_a = 0, _c = _b.length; _a < _c; _a++) {
        ref = _b[_a];
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
    var _a, _b, _c, _d, _e, attr, attribs, children, name, next, partial, tag;
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
    _b = (function() {
      _c = [];
      while (this.peekNonWs().match(/\w/)) {
        _c.push(this.readAttribute());
      }
      return _c;
    }).call(this);
    for (_a = 0, _d = _b.length; _a < _d; _a++) {
      attr = _b[_a];
      (attribs[attr.name] = attr.value);
    }
    partial = attribs[partial];
    if (partial) {
      this.partials[partial] = tag;
    }
    this.skipWs();
    if ((typeof debug !== "undefined" && debug !== null)) {
      alert(this.tail());
    }
    this.expect('>');
    children = (function() {
      _e = [];
      while (((next = this.peek(2)) && next && '</' !== next)) {
        _e.push((next.charAt(0) === '<') ? this.readTag() : this.readText());
      }
      return _e;
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
    var _a, dom, next, partials;
    this.skipWs();
    dom = (function() {
      _a = [];
      while ((next = this.peek())) {
        _a.push((function() {
          if ((next === '<')) {
            return this.readTag();
          } else if (next.match(/^\s$/)) {
            return this.readWhitespace();
          } else {
            return this.readText();
          }
        }).call(this));
      }
      return _a;
    }).call(this);
    partials = this.partials;
    return {
      dom: dom,
      partials: partials
    };
  };
  Compiler = function(_a) {
    this.dom = _a;
    this.buffer = '';
    this.length = this.dom.length;
    this.pos = 0;
    return this;
  };
  Compiler.eat = function() {
    return this.dom[this.pos++];
  };
  Compiler.prototype.evalCondition = function(cond, model) {
    var _a, evil, key, value;
    evil = "(function(){ ";
    _a = model;
    for (key in _a) {
      value = _a[key];
      evil += "var " + key + " = " + JSON.stringify(value) + "\n";
    }
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
    var _a, _b, _c, _d, _e, _f, attribs, attrs, b, collection, cond, each, element, hasAttribs, i, inPos, item, key, value, varname;
    b = "(function(model){\nvar b=\"\"\n";
    if (((cond = elem.attribs["if"]) && !this.evalCondition(cond, model))) {
      return "";
    }
    attribs = Object.keys(elem.attribs);
    hasAttribs = attribs.length > 0;
    if ((each = elem.attribs['each']) && !inEachLoop) {
      inPos = each.search(/[ ]in /);
      varname = each.substr(0, inPos);
      collection = each.substr(inPos + 4, each.length - inPos - 4);
      _a = this.getPropVal(model, collection);
      for (i = 0, _b = _a.length; i < _b; i++) {
        item = _a[i];
        (b += this.renderElement(elem, this.createObject(varname, item), true, i));
      }
      return b;
    }
    b += ("b+=\"<" + (elem.name) + "\"\n");
    elem.attribs["data-refs"] = elem.refs;
    if ((each)) {
      elem.attribs["data-enumeration"] = each;
    };
    attrs = '';
    _c = elem.attribs;
    for (key in _c) {
      value = _c[key];
      if (key !== 'each' && key !== 'if') {
        attrs += ' ' + key + '="' + value + '"';
      };
    }
    if (attrs.length > 0) {
      b += "b+=\"" + attrs + "\"\n";
    }
    b += 'b+=">"';
    _e = elem.children;
    for (_d = 0, _f = _e.length; _d < _f; _d++) {
      element = _e[_d];
      b += this.renderElement(element, model);
    }
    b += ("b+=\"</" + (elem.name) + ">\"\nreturn b\n})(model)\n");
    return b;
  };
  Compiler.prototype.getPropVal = function(model, propname) {
    var prop, val;
    val = (prop = model[propname]);
    if (typeof prop === "function") {
      val = prop.call(model);
    }
    return "model[" + propname + "]";
  };
  Compiler.prototype.interpolate = function(elem, model) {
    var _a, _b, _c, prop, ref, text;
    text = elem.text;
    _b = elem.references;
    for (_a = 0, _c = _b.length; _a < _c; _a++) {
      ref = _b[_a];
      prop = ref.match(/\${([^}]*)}/)[1];
      (text = text.replace(new RegExp("\\" + ref), "\"+" + (this.getPropVal(model, prop)) + "+\""));
    }
    return "b+=\"" + text + "\"\n";
  };
  Compiler.prototype.renderElement = function(elem, model, inEachLoop) {
    var _a;
    if ((_a = elem.type) === "tag") {
      return this.renderTag(elem, model, inEachLoop);
    } else if (_a === "text") {
      return "b+=\"" + elem.text + "\"";
    } else if (_a === "interpolation") {
      return this.interpolate(elem, model);
    } else if (_a === "whitespace") {
      return "b+=\"" + elem.text + "\"";
    } else {
      return "unknown: " + elem.text;
    }
  };
  Compiler.prototype.renderTemplate = function(model) {
    var _a, _b, _c, b, element;
    b = "(function(model){\nvar b=''\n";
    _b = this.dom;
    for (_a = 0, _c = _b.length; _a < _c; _a++) {
      element = _b[_a];
      b += this.renderElement(element, model);
    }
    return b + "return b\n}(model)\n";
  };
  /*
  class Compiler
  constructor: (@dom) ->
      this.pos = 0


  compile:() ->
      b=""
      b+=@renderElement( element, model) for element in @dom
      b
  */
  longtemplate = ' \
<h1>${header}</h1> \
<div partial="hellopartial" test="value" src="/somepath">\nDet var en gång för länge sedan\n<p if="variable!=2">en konstigt ${header} placerad paragraf ${variable}</p><span each="product in products">${product}</span></div> asdf';
  if ((typeof window !== "undefined" && window !== null)) {
    window.Parser = Parser;
    window.Compiler = Compiler;
  }
  templ = "<div>${smth}</div>";
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
})();
