sys = require 'sys'
alert = sys.puts
class Parser
    constructor : (@buffer, @pos) ->
        this.length = @buffer.length

    _identifier: /\w[\w\d]*/
    _text : /[^<]*/
    _interpolation: /\$\{(\w[\w\d]*)\}/g

    atEnd :->
        @pos == this.length-1

    skipWs : () ->
        len = @buffer.length
        @pos++ while @pos < len && @buffer.charAt(@pos) == ' '
        this

    expect : (expected, extra) ->
        s = this.tail()
        cmp = s.substr(0, expected.length);
        throw "Expected #expected but got #cmp" if (cmp != expected)
        @pos+=expected.length
        this

    tail : ->
        @buffer.substr(@pos, @buffer.length - @pos)

    read : (r)-> 
        s = this.tail()
        pos = s.search(r)
        matches = s.match(r)
        sys.puts "failed to read #r from #s" if match==null
        match = matches[0]
        length = match.length
        @pos += pos + length
        match

    readIdentifier : ()->
        this.read(this._identifier);

    peekNonWs : ()->
        s = this.tail()
        s.charAt(s.search(/[^\s]/))

    peek : (n)->
        s = this.tail()
        #p = s.search(/[^\s]/)
        s.substr(0, n || 1)

    readUntil : (r)->
        s = this.tail()
        pos = s.search(r)
        @pos += pos
        s.substr(0, pos)


    readAttribute : ()->
        this.skipWs()
        name = this.readIdentifier()
        this.expect('=')
        this.expect('"')
        value = this.readUntil(/"/)
        this.expect('"')
        {name, value}

    readText : ->
        text = this.read(this._text)
        if (references = text.match(this._interpolation))?
            type = "interpolation"
            references = text.match(this._interpolation)
            return {type, text, references}
        {type:"text", text}

    readCodeBlock : ->
        this.expect('${')
        ref = this.readIdentifier()
        this.expect('}')
        {'type':'ref', ref}

    readTag : ()->
        this.expect('<')
        name = this.readIdentifier()
        this.skipWs()
        attribs = {}
        (attribs[attr.name] = attr.value) for attr in (this.readAttribute() while this.peekNonWs().match(/\w/)) 
         
        #alert(JSON.stringify(attribs))
        this.skipWs()
        #alert this.tail() if debug?
        this.expect('>')
        children=
        while((next = this.peek(2)) && next &&  '</' != next)
          if(next.charAt(0)=='<')
            this.readTag()
          else
            this.readText()

        this.expect('</')
        this.expect(name, 'End of tag')
        this.expect('>')
        {type:'tag', name , attribs, children}
    
    readWhitespace: ()->
        text = @read(/\s*/)
        {type:"whitespace", text: text}
        
    
    readTemplate : () ->
        this.skipWs()
        while(next = this.peek())
          if(next=='<')
            @readTag()
          else if next.match(/^\s$/)
            @readWhitespace()
          else
            @readText()

class Compiler
    constructor: (@dom) ->
        this.buffer=''
        this.length = @dom.length
        this.pos = 0;
    
    @eat: ->
        @dom[@pos++]

    evalCondition: (cond, model) ->
        evil =  "(function(){ "
        evil += "var " + key + " = " + sys.inspect(value) + "\n" for all key, value of model
        evil += "return " + cond + "})()"
        eval evil
    
    createObject: (prop, val) ->
        obj ={}
        obj[prop] = val
        obj
    
    renderTag: (elem, model, inEachLoop) ->
        b=""
        #handle conditional inclusion of tags with if-attribute
        if((cond = elem.attribs.if) && !@evalCondition(cond, model))
            return ""

        attribs = Object.keys elem.attribs
        hasAttribs = attribs.length>0

        #Loop if element as each-attribute
        if (each = elem.attribs['each']) && !inEachLoop
            inPos = each.search(/[ ]in /)
            varname = each.substr(0, inPos)
            collection = each.substr(inPos + 4, each.length - inPos - 4)
            (b+= @renderElement( elem, @createObject(varname, item), true)) for item in model[collection]
            return b        
        
        #begin tag
        b+="<#{elem.name}"

        #render attributes
        attrs=''
        attrs+=' ' + key + '="' + value + '"' for all key, value of elem.attribs when key!='each' && key!='if'
        b+= attrs if attrs.length>0

        b+='>'

        b+=@renderElement(element, model) for element in elem.children
        b+="</#{elem.name}>"
        b

    interpolate: (elem, model) ->
        text = elem.text
        (text = text.replace new RegExp("\\" + ref), model[ref.match(/\${([^}]*)}/)[1]])  for ref in elem.references
        text
        

    renderElement: (elem, model, inEachLoop) ->
        b=''
        switch elem.type
          when "tag" then @renderTag elem, model, inEachLoop
          when "text" then elem.text
          when "interpolation" then @interpolate(elem, model)
          when "whitespace" then elem.text
          else "unknown: " + elem.text

    renderTemplate: (model) ->
        b=""
        b+=@renderElement( element, model) for element in @dom
        b

  
longtemplate = '
<h1>${header}</h1>
<div test="value" src="/somepath">\nDet var en gång för länge sedan\n<p if="variable!=2">en konstigt ${header} placerad paragraf ${variable}</p><span each="product in products">${product}</span></div> asdf'


shorttemplate = '<span each="product in products">${product}</span>'

p = new Parser shorttemplate, 0  
###
alert JSON.stringify(p.expect('<').readIdentifier())
###


dom = p.readTemplate()
sys.puts JSON.stringify(dom)
alert new Compiler(dom).renderTemplate({'variable' : 'testar', header:"rubrik", products:["spis", "afa"]})

