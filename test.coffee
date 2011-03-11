
if !alert?
    if window?
        alert = window.alert
    else
        alert = require('sys').puts
class Parser
    constructor : (@buffer, @pos) ->
        this.length = @buffer.length

    _identifier: /\w[\w\d]*/
    _text : /[^<]*/
    _interpolation: /\$\{(\w[\w\d]*)\}/g
    _tags : []

    partials : {}

    atEnd :->
        @pos == this.length-1

    skipWs : () ->
        len = @buffer.length
        @pos++ while @pos < len && @buffer.charAt(@pos) == ' '
        this

    expect : (expected, extra) ->
        s = this.tail()
        cmp = s.substr(0, expected.length)
        throw "Expected #expected but got #cmp" if (cmp != expected)
        @pos+=expected.length
        this

    tail : ->
        @buffer.substr(@pos, @buffer.length - @pos)

    read : (r)->
        s = this.tail()
        pos = s.search(r)
        matches = s.match(r)
        alert "failed to read #r from #s" if match==null
        match = matches[0]
        length = match.length
        @pos += pos + length
        match

    readIdentifier : ()->
        this.read(this._identifier)

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
        @skipWs()
        name = @readIdentifier()
        @expect('=')
        @expect('"')
        value = @readUntil(/"/)
        @expect('"')
        {name, value}

    readText : ->
        text = @read(this._text)
        if (references = text.match(@_interpolation))?
            type = "interpolation"
            references = text.match(@_interpolation)
            @_tags[0].refs.push(ref) for ref in references
            return {type, text, references}
        {type:"text", text}

    readCodeBlock : ->
        @expect('${')
        ref = @readIdentifier()
        @expect('}')
        {'type':'ref', ref}

    readTag : ()->
        @expect('<')
        name = @readIdentifier()
        @skipWs()

        attribs = {}
        tag = {name:name, attribs:attribs, type:'tag', refs:[]}
        @_tags.unshift(tag)

        (attribs[attr.name] = attr.value) for attr in (@readAttribute() while @peekNonWs().match(/\w/))

        partial = attribs[partial]
        @partials[partial] = tag if partial

        @skipWs()
        alert @tail() if debug?
        @expect('>')
        children=
        while((next = @peek(2)) && next &&  '</' != next)
          if(next.charAt(0)=='<')
            @readTag()
          else
            @readText()

        @_tags.shift()

        @expect('</')
        @expect(name, 'End of tag')
        @expect('>')
        #{type:'tag', name , attribs, children}
        tag.children = children
        tag

    readWhitespace: ()->
        text = @read(/\s*/)
        {type:"whitespace", text: text}

    readTemplate : () ->
        @skipWs()
        dom = while(next = this.peek())
          if(next=='<')
            @readTag()
          else if next.match(/^\s$/)
            @readWhitespace()
          else
            @readText()

        partials = @partials
        {dom, partials}

class Compiler
    constructor: (@dom) ->
        this.buffer=''
        this.length = @dom.length
        this.partials = @dom.filter (e)->
            e.attribs && e.attribs.partial

        this.pos = 0

    @eat: ->
        @dom[@pos++]

    evalCondition: (cond, model) ->
        evil =  "(function(){ "
        #evil += "var " + key + " = " + JSON.stringify(value) + "\n" for all key, value of model
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
            (b+= @renderElement( elem, @createObject(varname, item), true, i)) for item, i in @getPropVal(model,collection)
            return b

        #begin tag
        b+="b+=\"<#{elem.name}\"\n"

        elem.attribs["data-refs"] = elem.refs
        if(each)
            elem.attribs["data-enumeration"] = each

        #render attributes
        attrs=''
        attrs+=' ' + key + '="' + value + '"' for  key, value of elem.attribs when key!='each' && key!='if'
        b+="b+=\"" + attrs + "\"\n" if attrs.length>0

        b+='b+=">"'

        b+=@renderElement(element, model) for element in elem.children
        b+="b+=\"</#{elem.name}>\"\n"
        b

    getPropVal: (model, propname) ->
        val = prop = model[propname]
        val = prop.call(model) if typeof prop=="function"
        #val
        return "model[" + propname + "]"

    interpolate: (elem, model) ->
        text = elem.text
        for ref in elem.references
            prop = ref.match(/\${([^}]*)}/)[1]
            (text = text.replace new RegExp("\\" + ref), "\"+" + (@getPropVal model, prop) +"+\"" )
        "b+=\"" + text + "\"\n"

    compilePartial: (element)->
        

    renderElement: (elem, model, inEachLoop) ->
        switch elem.type
          when "tag" then @renderTag elem, model, inEachLoop
          when "text" then "b+=\"" + elem.text + "\""
          when "interpolation" then @interpolate(elem, model)
          when "whitespace" then "b+=\"" + elem.text + "\""
          else "unknown: " + elem.text

    renderTemplate: (model) ->
        b="{\n"
        b+=@compilePartial(element) for element in @partials
        elements = ""
        elements += @renderElement( element, model)  for element in @dom
        b + ", render : function(model) { \n" + elements + "\n}\n"

###
class Compiler
    constructor: (@dom) -> 
        this.pos = 0

        
    compile:() ->
        b=""
        b+=@renderElement( element, model) for element in @dom
        b
###

longtemplate = '
<h1>${header}</h1>
<div partial="hellopartial" test="value" src="/somepath">\nDet var en gång för länge sedan\n<p if="variable!=2">en konstigt ${header} placerad paragraf ${variable}</p><span each="product in products">${product}</span></div> asdf'

if window?
    window.Parser = Parser
    window.Compiler = Compiler

#shorttemplate = '<span each="product in products">${product}</span>'
templ = "<div>${smth}<ul partial=\"mypartial\"><li>t</li></ul></div>"
p = new Parser templ, 0
###
alert JSON.stringify(p.expect('<').readIdentifier())
###


t = p.readTemplate()

#sys.puts JSON.stringify(dom)
#alert new Compiler(dom).renderTemplate({'smth': -> return "test"})
alert new Compiler(t.dom).renderTemplate({'variable' : 'testar', header:"rubrik", products:["spis", "afa"]})

