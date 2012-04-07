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

    selfClosing:{
        'input':true
        'link':true
        'img':true
    }

    funcStart: 'var model = arguments[0], models=[], output=\'\';\n'
    funcEnd: 'return output;\n'

    renderers: {
        tag: (element) ->
            console.log JSON.stringify(element)
            @indentation += '  '
            buffer=""
            selfClose = @selfClosing[element.value]
            if element.each?
                @eachSeqNo++
                parts = element.each.split(' ')
                varname = parts[0]
                collection= parts[2]
                collName = collection.split('.').pop()
                buffer+="""
models.unshift(model);\n
var render_#{varname} = function(#{varname}){

}
var render_#{collName} = function(#{collName}#{@eachSeqNo}){
    var buffer = ''
    #{collName}#{@eachSeqNo}.forEach( function(#{varname}){
        buffer += render_#{varname}(#{varname})
    })
    return buffer;
}
var #{collName}#{@eachSeqNo}=model.#{collection};\n"""
                
                buffer+="for(var #{varname} in #{collName}#{@eachSeqNo}){\n"
                buffer+="  model = {'#{varname}':#{collName}#{@eachSeqNo}[#{varname}]};\n"

            buffer += "  output+='\\n#{@indentation}<#{element.value}"
            if element.attributes?
                buffer += @renderers.attribute.call(this, attr) for attr in element.attributes
                #buffer += ' ' + attr.name + '=\\"' + @attrValue(attr.value)  + '\\"' for attr in element.attributes

            selfClose or (buffer += '>\\n')
            buffer += '\';\n'
            
            children = (@createRenderer el for el in (element.children || []))
            buffer += child for child in children

            indent = if element.each then '  ' else ''

            if selfClose
                buffer += "#{indent}output+='#{@indentation}/>';\n"
            else
                buffer += "#{indent}output+='\\n#{@indentation}</#{element.value}>';\n"

            if element.each?
                buffer+="}\n"
                buffer+="model=models.shift();\n"

            @indentation = @indentation.substr(0, @indentation.length-2)
            if element.partial?
                console.log '\n' + buffer + '\n'
                @partials[element.partial] = @funcStart+buffer+@funcEnd
            buffer

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
        buffer = @funcStart
        renderers = @createRenderer element for element in @dom.template.children
        (buffer+= renderer) for renderer in renderers
        buffer += @funcEnd

        return {render:new Function(buffer), partials: @partials}

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

#console.dir(dom)

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