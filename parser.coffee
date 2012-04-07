Lexer = require('./lexer') && require('./lexer').Lexer || window.Lexer

class Parser
    constructor: (@lexer)->
        @dom = {template:{children: []}, partials:{}}
        @partials = @dom.partials
        @deferredTokens = []
        @parent = @dom
        @currentNode = @dom.template
        @lexer.on 'token', (token) =>
            console.log(token)
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
        @eachSeqNo=0
        @renderFnCounter= 0
        @renderFnNames={}
        @functions= []


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
        buf += if @selfClosing[tagname] then "#{bufferName}+='/>';" else "#{bufferName}+='>';"
        buf

    parseEachAttr:(each)->
        parts = each.split(' ')
        varname = parts[0]
        collection= parts[2]
        collectionName = collection.split('.').pop()
        {varname, collectionName}

    getRenderFnName: (element)->
        if element.each
            name = @parseEachAttr(element.each).collectionName
            name += @renderFnCounter++ if @renderFnNames.hasOwnProperty(name)
        else
            name = "#{element.value}#{@renderFnCounter++}"
        @renderFnNames[name]=1
        name

    renderers: {
        tag: (element) ->
            selfClose = @selfClosing[element.value]
            fnName = element.partial || @getRenderFnName(element);
            buffer = ''
            buffer +="var output='';\n"

            if element.each?
                parts = element.each.split(' ')
                varname = parts[0]
                collection= parts[2]
                collName = collection.split('.').pop()
                loopCollection = "#{collName}#{@eachSeqNo}"
                buffer+= "model.#{collection}.forEach(function(#{varname}){ var model= {#{varname}:#{varname}};\n"

                

            buffer += @startTagRenderer('output', element.value, element.attributes)

            children = (@createRenderer el for el in (element.children || []))
            buffer += (if child.name then "output+=this.#{child.name}.call(this, model);" else child) for child in children

            @functions.push(child) for child in children when child.name?
            if not selfClose
                buffer += "output+='</#{element.value}>';\n"


            if element.each?
                buffer+='}.bind(this));'

            buffer+='return output;'
            ###
            if element.each?
                buffer+="}\n"
                buffer+="model=models.shift();\n"
            ###
            ###
            if element.partial?
                console.log '\n' + buffer + '\n'
                @partials[element.partial] = @funcStart+buffer+@funcEnd
            ###

            { name: fnName, body: buffer }

        attribute: (element) ->
            buffer= " #{element.name}="
            if typeof element.value=="string"
                buffer += "\"" + element.value + "\""
            else
                buffer += "'"
                buffer +=" + " + (if(item.type == "content") then "'" + item.value + "'" else "model.#{item.value}") for item in element.value
                buffer +=" + '"
            buffer

        content: (element) ->
            return '' if element.value==''
            "output+='#{@indentation}  #{element.value.replace('\n', '\\n')}';\n"

        ref: (element) ->
            "output+='#{@indentation}  ' + model.#{element.value};\n"
    }

    compile: ->
        buffer = ''# @funcStart
        renderers = (@createRenderer element for element in @dom.template.children)
        entry = renderers[0]

        templ = """template = {
            render: function(model){#{entry.body}}
        """

        @functions.forEach (r)->
            #console.log(JSON.stringify(model));
            templ+=", #{r.name}: function(model){#{r.body}}"
        
        templ+="};/*end template*/"

        parts = {}
        @functions.forEach (r)->
            parts[r.name] = new Function('model', 'console.log(JSON.stringify(model));' + r.body)

        
        console.log templ

        entryFn = new Function('model', entry.body)

        #(buffer+= renderer) for renderer in renderers
        buffer += '' #@funcEnd

        { render: (model)->  entryFn.call(parts, model) } # {render:new Function(buffer), partials: @partials}

    createRenderer: (element) ->
        @renderers[element.type].call(this, element)

    stringOrRef: (value)->
        return value if typeof value=="string"

        item.type == "content" ? item.value 


exports.Parser = Parser
###
exports.Compiler = Compiler

exports.Parser = Parser
exports.Compiler = Compiler
###

tmpl = '<div class="test"><span partial="title">${title}</span><div each="product in products" data-id="${product.id}">${product.name}<span each="tag in product.tags">${tag}</span></div></div>'
l = new Lexer(tmpl)
p = new Parser(l)
dom = p.parse()

console.log("----" + JSON.stringify(dom) + "----")

c = new Compiler(dom)
template = c.compile()

model = {
    title: "test title"
}

console.log template.render({products:[{id:1, name:"the first product", tags:['good', 'cheap']}, {id:2, name:"bicycle", tags:['expensive', 'red']}], title:"some title"})


###
(typeof window != "undefined") && (window.Spark = {}) && (window.Spark.Parser = Parser) && (window.Spark.Compiler = Compiler)
###