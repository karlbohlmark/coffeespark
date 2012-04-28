Lexer = this.Lexer || exports.Lexer || require('./lexer').Lexer

class Parser
    constructor: (@lexer)->
        @dom = {template:{children: []}, partials:{}}
        @partials = @dom.partials
        @deferredTokens = []
        @parent = @dom
        @currentNode = @dom.template
        @lexer.on 'token', (token) =>
            @receive token

    receive: (token) ->
        if token.type == 'tagend'
            return @currentNode = @parent

        @currentNode.children = [] if !@currentNode.children?
        if token.type=='attribute'
            @currentNode.attributes = [] if !@currentNode.attributes?
            switch token.name
                when 'partial' then @currentNode.partial = token.value
                when 'each'    then @currentNode.each = token.value
                when 'if'    then @currentNode.if = token.value
                else
                    @currentNode.attributes.push token

            return
        @currentNode.children.push token
        if token.type == 'tag'
            @parent = @currentNode
            @currentNode = token

    parse: ->
        while @lexer.pos<@lexer.length
            @lexer.next()
        return @dom

class Compiler
    constructor: (@dom)->
        @indentation=''
        @partials = {}
        @eachSeqNo = 0
        @renderFnCounter = 0
        @renderFnNames= {}
        @functions = []
        @models = []


    selfClosing:{
        'input':true
        'link':true
        'img':true
    }

    funcStart: 'var model = arguments[0], models=[], output=\'\';\n'
    funcEnd: 'return output;\n'

    startTagRenderer: (bufferName, tagname, attributes)->
        buf = "#{bufferName}+='<#{tagname}';"
        (buf += "#{bufferName}+='" + @renderers.attribute.call(@, attr) + "';") for attr in (attributes || [])
        buf +=  "#{bufferName}+='>';"
        buf

    parseEachAttr:(each)->
        parts = each.split(' ')
        varname = parts[0]
        collection= parts[2]
        collectionName = collection.split('.').pop()
        {varname, collectionName, collection}

    getRenderFnName: (element)->
        if element.each
            name = @parseEachAttr(element.each).collectionName
            name += @renderFnCounter++ if @renderFnNames.hasOwnProperty(name)
        else
            name = "#{element.value}#{@renderFnCounter++}"
        @renderFnNames[name]=1
        name
    expand: (expression)->
        return "(function(){ try{return #{expression}} catch(ex){return model.#{expression}}}())"
    renderers: {
        tag: (element) ->
            selfClose = @selfClosing[element.value]
            fnName = element.partial || @getRenderFnName(element);
            buffer = ''
            buffer +="var output='';\n"

            if element.each?
                {varname, collectionName, collection} = @parseEachAttr element.each
                loopCollection = "#{collectionName}#{@eachSeqNo}"
                buffer+= "model.#{collection}.forEach(function(m, #{varname}){var model= {#{varname}:#{varname}, model:m};this.models.unshift(#{varname});\n"

            if element.if
                buffer+= "if(#{@expand(element.if)}){\n"
            buffer += @startTagRenderer('output', element.value, element.attributes)

            children = (@createRenderer el for el in (element.children || []))
            buffer += (if child.name then "output+=this.#{child.name}.call(this, model);" else child) for child in children

            @functions.push(child) for child in children when child.name?
            if not selfClose
                buffer += "output+='</#{element.value}>';\n"

            buffer += '}' if element.if

            if element.each?
                buffer+='}.bind(this, model));'
            
            buffer+='return output;'

            { name: fnName, body: buffer }

        attribute: (element) ->
            buffer= " #{element.name}="
            if typeof element.value=="string"
                buffer += "\"" + element.value + "\""
            else
                buffer += "'"
                buffer +=" + " + (if(item.type == "content") then "'" + item.value + "'" else "'\"' + model.#{item.value} + '\"'") for item in element.value
                buffer +=" + '"
            buffer

        content: (element) ->
            return '' if element.value==''
            "output+='#{element.value.replace(/\n/g, '\\n')}';\n"

        ref: (element) ->
            "output+=model.#{element.value};\n"
    }

    compile: ->
        console.log 'start compile'
        buffer = ''# @funcStart
        renderers = (@createRenderer element for element in @dom.template.children)
        
        renderers.forEach( (r, i)-> 
            if typeof r=='string'
                renderers[i] = name: 'entry', body: ()-> r
        )

        entry = renderers[0]
        console.log @dom.template.children.length if not entry 

        templ = """var template = {
            models:[],
            render: function(model){#{entry.body}}
        """

        @functions.forEach (r)->
            #console.log(JSON.stringify(model));
            templ+=", #{r.name}: function(model){#{r.body}}"
        
        templ+="};/*end template*/;"

        templ = "define(function(){#{templ}\nreturn template; });"
        #console.log templ
        parts = { models:[] }
        @functions.forEach (r)->
            #console.log(JSON.stringify(model));
            try
                parts[r.name] = new Function('model', '' + r.body)
            catch ex
                console.error r.body

        entryFn = ->
        try
            entryFn = new Function('model', entry.body)
        catch ex
            console.error entry.body

        #(buffer+= renderer) for renderer in renderers
        buffer += '' #@funcEnd

        { render: ((model)->  entryFn.call(parts, model) )
        , tmpl: templ } # {render:new Function(buffer), partials: @partials}

    createRenderer: (element) ->
        @renderers[element.type].call(this, element)

    stringOrRef: (value)->
        return value if typeof value=="string"

        item.type == "content" ? item.value 

if typeof exports!='undefined'
    exports.Parser = Parser
    exports.Compiler = Compiler

###
tmpl = '<div>${title}</div>'#'<div class="test"><span partial="title">${title}</span><div if="product.id!=1" each="product in products" data-id="${product.id}">${product.name}<span each="tag in product.tags">${tag}</span></div></div>'
l = new Lexer(tmpl)
p = new Parser(l)
dom = p.parse()

console.log("----" + JSON.stringify(dom) + "----")

c = new Compiler(dom)
template = c.compile()

model = {
    title: "test title"
}
###
#console.log template.render({products:[{id:1, name:"the first product", tags:['good', 'cheap']}, {id:2, name:"bicycle", tags:['expensive', 'red']}], title:"some title"})

if typeof window isnt 'undefined'
    window.Spark = { Compiler, Parser, Lexer }

compile = (tmpl)-> new Compiler(new Parser(new Lexer(tmpl)).parse()).compile()

if typeof process !='undefined' && process and not process.parent
    console.log 'main'
    file = process.argv[2]
    tmplText = require('fs').readFileSync(file).toString()
    template = compile(tmplText)
    outfile = file.replace '.cork.html', '.cork.js'
    require('fs').writeFileSync(outfile, js_beautify( template.tmpl ) )

###
(typeof window != "undefined") && (window.Spark = {}) && (window.Spark.Parser = Parser) && (window.Spark.Compiler = Compiler)
###
