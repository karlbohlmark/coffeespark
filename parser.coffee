Lexer = require('./lexer').Lexer

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
            @currentNode.attributes = [] if !@currentNode.attribute?
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
        console.log @lexer.pos
        while @lexer.pos<@lexer.length
            @lexer.next()
        return @dom

class Compiler
    constructor: (@dom)->
        @indentation=''
        @partials = {}

    funcStart: 'var model = arguments[0], models=[], output=\'\';\n'
    funcEnd: 'return output;\n'

    renderers: {
        tag: (element) ->
            @indentation += '  '
            buffer=""
            if element.each?
                parts = element.each.split(' ')
                varname = parts[0]
                collection= parts[2]
                buffer+="models.unshift(model);\neachmodel=model['#{collection}'];\n"
                buffer+="for(#{varname} in eachmodel){\n"
                buffer+="model = {'#{varname}':eachmodel[#{varname}]}\n"

            buffer += "output+='#{@indentation}<#{element.value}"
            if element.attributes?
                buffer += ' ' + attr.name + '=\\"' + attr.value  + '\\"' for attr in element.attributes
            buffer += '>\'\n'
            children = @createRenderer el for el in element.children
            buffer += child for child in children
            buffer += "output+='#{@indentation}</#{element.value}>'\n"

            if element.each?
                buffer+="}\n"
                buffer+="model=models.shift()\n"

            @indentation = @indentation.substr(0, @indentation.length-2)
            if element.partial?
                console.log '\n' + buffer + '\n'
                @partials[element.partial] = @funcStart+buffer+@funcEnd
            buffer

        content: (element) ->
            return '' if element.value==''
            "output+='#{@indentation}  #{element.value}'\n"

        ref: (element) ->
            "output+='#{@indentation}' + model['#{element.value}']\n"
    }

    compile: ->
        buffer = @funcStart
        renderers = @createRenderer element for element in @dom.template.children
        (buffer+= renderer) for renderer in renderers
        buffer += @funcEnd

        return {render:new Function(buffer), partials: @partials}

    createRenderer: (element) ->
        @renderers[element.type].call(this, element)

l = new Lexer('<div class="test"><span>${title}</span><div partial="magicpartial" each="product in products">${product}</div></div>')
p = new Parser(l)
dom = p.parse()

c = new Compiler(dom)
template = c.compile()

console.log JSON.stringify(dom)
model = {
    title: "test title"
}
console.log template.render({products:["the first product", "bicycle", "princess"], title:"some title"})
