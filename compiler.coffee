class Compiler
    constructor: (@dom)->
        @indentation=''
        @partials = {}
        @eachSeqNo=0
        console.dir @dom

    selfClosing:{
        'input':true
        'link':true
        'img':true
    }

    funcStart: 'var model = arguments[0], models=[], output=\'\';\n'
    funcEnd: 'return output;\n'

    renderers: {
        tag: (element) ->
            #@indentation += '  '
            buffer=""
            selfClose = @selfClosing[element.value]
            if element.each?
                @eachSeqNo++
                parts = element.each.split(' ')
                varname = parts[0]
                collection= parts[2]
                buffer+="models.unshift(model);\neachmodel#{@eachSeqNo}=model.#{collection};\n"
                buffer+="for(#{varname} in eachmodel#{@eachSeqNo}){\n"
                buffer+="model = {'#{varname}':eachmodel#{@eachSeqNo}[#{varname}]};\n"

            buffer += "output+='#{@indentation}<#{element.value}"
            if element.attributes?
                buffer += @renderers.attribute.call(this, attr) for attr in element.attributes
                #buffer += ' ' + attr.name + '=\\"' + @attrValue(attr.value)  + '\\"' for attr in element.attributes


            selfClose or (buffer += '>')
            buffer += '\';\n'
            children = @createRenderer el for el in element.children
            buffer += child for child in children
            if selfClose
                buffer += "output+='#{@indentation}/>';\n"
            else
                buffer += "output+='#{@indentation}</#{element.value}>';\n"

            if element.each?
                buffer+="}\n"
                buffer+="model=models.shift();\n"

            #@indentation = @indentation.substr(0, @indentation.length-2)
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
            "output+='#{@indentation}' + model.#{element.value};\n"
    }

    compile: ->
        buffer = @funcStart
        console.dir @dom.template
        renderers = @createRenderer element for element in @dom.template.children
        (buffer+= renderer) for renderer in renderers
        buffer += @funcEnd

        return {render:new Function(buffer), partials: @partials}

    createRenderer: (element) ->
        @renderers[element.type].call(this, element)

    stringOrRef: (value)->

exports.Compiler = Compiler
