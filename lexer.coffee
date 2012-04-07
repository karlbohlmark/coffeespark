class Lexer
    constructor: (@template) ->
        @tokens = []
        @listeners = {
            token: []
            error: []
        }
        @pos = 0
        @length = @template.length
        @last = {}
        @tags = []
        @insideTag = false

    currentToken : []

    on: (ev, listener)->
        if ev!='error' && ev != 'token'
            throw "Unsupported event:#{event}"
        @listeners[ev].push(listener)

    emit: (token) ->
        @last = token
        listener(token) for listener in @listeners['token']

    isAlpha: (chr)->
        code = chr.charCodeAt(0)
        return 64 < code < 91 || 96 < code < 122

    next: ->
        if @deferred
            (token = @deferred) && @deferred=null
            return @emit token
        current = @template[@pos]
        next = @template[@pos+1]
        type = null
        if current== '<' && next != '/'
            @pos++
            start = @pos
            while @isAlpha(@template[@pos]) && @pos<@length
                @pos++

            if @template[@pos]!='>'
                @insideTag = true

            value = @template.substr(start, @pos++-start)
            @tags.unshift value

            return @emit {type:'tag', value: value}


        if current == '<' && next == '/'
            @pos+=2
            start = @pos
            while @isAlpha(@template[@pos]) && @pos<@length
                @pos++

            value = @template.substr(start, @pos-start)
            lastOpened = @tags.shift()
            if value != lastOpened
                throw "expected #{lastOpened} got #{value}"
            @pos++
            @insideTag=false
            return @emit {type: 'tagend', value:value}

        #if @last.type =='tag'
        return if @pos>=@length

        if @insideTag
            if @template[@pos]=='>'
                @insideTag = false
                @pos++
                return true
            if @template[@pos]=='/' && @template[@pos+1]=='>'
                @insideTag  = false
                @pos+=2
                lastOpened = @tags.shift()
                return @emit {type: 'tagend', value: lastOpened}

            while(@template[@pos]==' ' || !@isAlpha(@template[@pos]) && @pos<@length)
                @pos++
            start = @pos
            @pos++ while @isAlpha(@template[@pos]) || @template[@pos]=='-' #attribute
            attrName = @template.substr start, @pos-start
            @pos++ #skip ending quote
            quot = @template[@pos]
            start = ++@pos
            while @template[@pos]!=quot
                @pos++
            attrValue = @template.substr start, @pos++-start

            #This section to support references in attribute values is rather hacky/incomplete. todo:rewrite
            refs = attrValue.match /\$\{[a-zA-Z_\-0-9\.]+\}/g

            console.log attrValue + refs

            if refs && refs.length>0
                ref = refs[0]
                ref = ref.substr(2, ref.length-3)
                parts = attrValue.split refs[0]
                attrValue = []
                attrValue.push({type:"content", value:parts[0]}) if parts[0]!=""
                attrValue.push({type:"ref", value:ref})
                attrValue.push({type:"content", value:parts[1]}) if parts[1]!=""

            return @emit {type: 'attribute', name: attrName, value: attrValue}

        start = @pos
        while @template[@pos] != '<' && (@pos<@length) && (@template[@pos]!='$' || @template[@pos+1]!='{')
            @pos++

        if @template[@pos]=='$' && @template[@pos+1]=='{'
            contentToken = {type:'content', value: @template.substr(start, @pos-start)} #todo:do not emit empty content tokens 
            @pos+=2
            start = @pos
            @pos++ while @template[@pos]!='}' && @pos<@length

            @deferred = {type:'ref', value:@template.substr start, @pos++-start}
            return @emit contentToken
        if (@pos-start)==0
            console.log 'theend'
        return @emit {type: 'content', value: @template.substr(start, @pos-start)}

exports.Lexer = Lexer
if typeof(window) != "undefined"
    window.Lexer = Lexer
