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

    renderers: {
        tag: (element) ->
            selfClose = @selfClosing[element.value]
            fnName = "#{element.value}#{@renderFnCounter++}";
            buffer = ''
            buffer +="var output='';\n"

            if element.each?
                parts = element.each.split(' ')
                varname = parts[0]
                collection= parts[2]
                collName = collection.split('.').pop()
                loopCollection = "#{collName}#{@eachSeqNo}"
                buffer+= "model.#{collection}.forEach(function(#{varname}){"

                

            buffer += @startTagRenderer('output', element.value, element.attributes)

            children = (@createRenderer el for el in (element.children || []))
            buffer += (if child.name then "output+=part.#{child.name}(model, part);" else child) for child in children

            @functions.push(child) for child in children when child.name?
            if not selfClose
                buffer += "output+='</#{element.value}>';\n"


            if element.each?
                buffer+='})'
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
            "output+='#{@indentation}  ' + model.#{element.value}/*ref*/;\n"
    }

    compile: ->
        buffer = ''# @funcStart
        renderers = (@createRenderer element for element in @dom.template.children)
        
        parts = {}
        @functions.forEach (r)->
            parts[r.name] = new Function('model', 'console.log(JSON.stringify(model));' + r.body)
            console.log "#{r.name}: #{r.body}\n"

        entry = renderers[0]
        console.log "#{entry.name}:#{entry.body}"

        entryFn = new Function('model', 'part', entry.body)

        #(buffer+= renderer) for renderer in renderers
        buffer += '' #@funcEnd

        console.log entryFn.toString()
        { render: (model)->  entryFn(model, parts) } # {render:new Function(buffer), partials: @partials}

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

tmpl = '<div class="test"><span>${title}</span><div partial="magicpartial" each="product in products">${product.name}<span each="tag in product.tags">${tag}</span></div></div>'
l = new Lexer(tmpl)
#l = new Lexer('<div class="tes${testar}" id="myid"><input type="text"/></div>')
p = new Parser(l)
dom = p.parse()

console.log("----" + JSON.stringify(dom) + "----")

c = new Compiler(dom)
template = c.compile()

#console.log JSON.stringify(dom)
model = {
    title: "test title"
}
#console.log template.render
console.log template.render({products:[{name:"the first product", tags:['good', 'cheap']}, {name:"bicycle", tags:['expensive', 'red']}], title:"some title"})

#console.log template.render.toString()
###
(typeof window != "undefined") && (window.Spark = {}) && (window.Spark.Parser = Parser) && (window.Spark.Compiler = Compiler)
###