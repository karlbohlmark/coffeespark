(function() {
  var Lexer;

  Lexer = (function() {

    function Lexer(template) {
      this.template = template;
      this.tokens = [];
      this.listeners = {
        token: [],
        error: []
      };
      this.pos = 0;
      this.length = this.template.length;
      this.last = {};
      this.tags = [];
      this.insideTag = false;
    }

    Lexer.prototype.currentToken = [];

    Lexer.prototype.on = function(ev, listener) {
      if (ev !== 'error' && ev !== 'token') throw "Unsupported event:" + event;
      return this.listeners[ev].push(listener);
    };

    Lexer.prototype.emit = function(token) {
      var listener, _i, _len, _ref, _results;
      this.last = token;
      _ref = this.listeners['token'];
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        listener = _ref[_i];
        _results.push(listener(token));
      }
      return _results;
    };

    Lexer.prototype.isAlpha = function(chr) {
      var code;
      code = chr.charCodeAt(0);
      return (64 < code && code < 91) || (96 < code && code < 122);
    };

    Lexer.prototype.next = function() {
      var attrName, attrValue, contentToken, current, lastOpened, next, parts, quot, ref, refs, start, token, type, value;
      if (this.deferred) {
        (token = this.deferred) && (this.deferred = null);
        return this.emit(token);
      }
      current = this.template[this.pos];
      next = this.template[this.pos + 1];
      type = null;
      if (current === '<' && next !== '/') {
        this.pos++;
        start = this.pos;
        while (this.isAlpha(this.template[this.pos]) && this.pos < this.length) {
          this.pos++;
        }
        if (this.template[this.pos] !== '>') this.insideTag = true;
        value = this.template.substr(start, this.pos++ - start);
        this.tags.unshift(value);
        return this.emit({
          type: 'tag',
          value: value
        });
      }
      if (current === '<' && next === '/') {
        this.pos += 2;
        start = this.pos;
        while (this.isAlpha(this.template[this.pos]) && this.pos < this.length) {
          this.pos++;
        }
        value = this.template.substr(start, this.pos - start);
        lastOpened = this.tags.shift();
        if (value !== lastOpened) throw "expected " + lastOpened + " got " + value;
        this.pos++;
        this.insideTag = false;
        return this.emit({
          type: 'tagend',
          value: value
        });
      }
      if (this.pos >= this.length) return;
      if (this.insideTag) {
        if (this.template[this.pos] === '>') {
          this.insideTag = false;
          this.pos++;
          return true;
        }
        if (this.template[this.pos] === '/' && this.template[this.pos + 1] === '>') {
          this.insideTag = false;
          this.pos += 2;
          lastOpened = this.tags.shift();
          return this.emit({
            type: 'tagend',
            value: lastOpened
          });
        }
        while (this.template[this.pos] === ' ' || !this.isAlpha(this.template[this.pos]) && this.pos < this.length) {
          this.pos++;
        }
        start = this.pos;
        while (this.isAlpha(this.template[this.pos]) || this.template[this.pos] === '-') {
          this.pos++;
        }
        attrName = this.template.substr(start, this.pos - start);
        this.pos++;
        quot = this.template[this.pos];
        start = ++this.pos;
        while (this.template[this.pos] !== quot) {
          this.pos++;
        }
        attrValue = this.template.substr(start, this.pos++ - start);
        refs = attrValue.match(/\$\{[a-zA-Z_\-0-9\.]+\}/g);
        console.log(attrValue + refs);
        if (refs && refs.length > 0) {
          ref = refs[0];
          ref = ref.substr(2, ref.length - 3);
          parts = attrValue.split(refs[0]);
          attrValue = [];
          if (parts[0] !== "") {
            attrValue.push({
              type: "content",
              value: parts[0]
            });
          }
          attrValue.push({
            type: "ref",
            value: ref
          });
          if (parts[1] !== "") {
            attrValue.push({
              type: "content",
              value: parts[1]
            });
          }
        }
        return this.emit({
          type: 'attribute',
          name: attrName,
          value: attrValue
        });
      }
      start = this.pos;
      while (this.template[this.pos] !== '<' && (this.pos < this.length) && (this.template[this.pos] !== '$' || this.template[this.pos + 1] !== '{')) {
        this.pos++;
      }
      if (this.template[this.pos] === '$' && this.template[this.pos + 1] === '{') {
        contentToken = {
          type: 'content',
          value: this.template.substr(start, this.pos - start)
        };
        this.pos += 2;
        start = this.pos;
        while (this.template[this.pos] !== '}' && this.pos < this.length) {
          this.pos++;
        }
        this.deferred = {
          type: 'ref',
          value: this.template.substr(start, this.pos++ - start)
        };
        return this.emit(contentToken);
      }
      if ((this.pos - start) === 0) console.log('theend');
      return this.emit({
        type: 'content',
        value: this.template.substr(start, this.pos - start)
      });
    };

    return Lexer;

  })();

  exports.Lexer = Lexer;

  if (typeof window !== "undefined") window.Lexer = Lexer;

}).call(this);
