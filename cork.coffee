html5 		= require 'html5'
escodegen 	= require 'escodegen'
ast			= require './astBuilder'
Parser 		= html5.Parser

parse = (tmpl)->
	p = new Parser()
	p.parse_fragment(tmpl)
	bodyFromParser = (parser)->parser.document.childNodes[0].childNodes[1]
	bodyFromParser(p)

class Cork
	constructor: (@codegen, @parse)->
		@names = {}

	compile: (tmpl)-> @codegen @generateAst @parse tmpl


	constructName: (tag)->
		disambiguationSequence = (()->
			current = -1
			()-> if ++current==0 then '' else current
		)()

		candidate = tag.tagName.toLowerCase()

		while @names.hasOwnProperty (candidate = candidate + disambiguationSequence())
			;
		@names[candidate] = candidate

	generateAst: (dom)->
		templateAst =
			type:'Program',
			body: []

		scopeExpr = ast.functionExpression null
		functionBlock = scopeExpr.body.body

		selfInvoking = ast.callExpression scopeExpr
		templateAst.body.push ast.expressionStatement selfInvoking


		selfClosing = ['input', 'meta', 'link']
		isSelfClosing = (tag)-> selfClosing.indexOf(tag.tagName.toLowerCase()) != -1

		visitors =
			3: (textNode, jsParentNode, parentParams) =>
				sequence = interpolateLiteral textNode.value, parentParams
				
				right = (if sequence.length is 1 then sequence[0] else ast.additionSequence(sequence))
				jsParentNode.push ast.assignmentStatement("buffer", "+=", right)

			1: (elementNode, jsParentNode, parentParams) =>
				# generate render-function name for the node
				renderFnName = @constructName elementNode

				# function that renders this node
				fn = ast.functionDeclaration(renderFnName, parentParams.map((p)->p.name))
				fn.body.body.push ast.variableDeclaration("buffer", "")
		
				# Put the function declarations in the outer scope together with render to allow them
				# be used separately for partial rendering
				functionBlock.push fn

				# Make a copy of the params array to use when looking up variables. In each-loops, the loop variable with will be appended to this list
				params = fn.params.slice()

				# Mark this node to be iterated over, and parse the iteration directive
				registerEach = (tag, eachDirective)->
					eachParts = eachDirective.split(' ')
					loopVariable = eachParts[0]
					enumerable = eachParts[2]
					tag.each = { loopVariable, enumerable }

				# Construct the concatenation expression of the starttag (with attributes)
				startTag = (tag)->
					parts = []
					parts.push ast.literal '<' + tag.tagName.toLowerCase()
					if tag.attributes.length
						for i in [0..tag.attributes.length-1]
							attr = tag.attributes[i]
							if attr.name == 'each'
								registerEach(tag, attr.value) 
								continue
							parts.push ast.literal ' ' + attr.name + '="'
							parts.push part for part in interpolateLiteral attr.value, parentParams
							parts.push ast.literal '"'
					parts.push ast.literal '>'
					compactedParts = []
					last={type:null}
					###
					for part, i in parts
						if part.type == 'Literal' and last.type == 'Literal'
							console.log "compact" + part.value
							compactedParts[compactedParts.length-1].value += part.value
						else
							console.log "push: " + JSON.stringify(part)
							compactedParts.push part
						last = part
					###
					compactedParts.forEach (p)->console.log p.type
					console.log JSON.stringify compactedParts
					ast.additionSequence parts

				body = fn.body.body

				# Ok, this is a bit weird. When the starttag is generated, the attributes are traversed and each-directives are parsed
				# meaning the start tag must be generated before the each-property of the tag is accessed. <- Refactor
				elStartTag = startTag elementNode

				if elementNode.each
					loopFn = ast.functionExpression 'each_' + elementNode.each.loopVariable, [elementNode.each.loopVariable]
					params.push(ast.identifier elementNode.each.loopVariable)
					console.log(elementNode.each.loopVariable)

					body = loopFn.body.body
					loopExp = ast.expressionStatement ast.callExpression(
						ast.memberExpression(ast.memberExpression(ast.identifier('model'), ast.identifier(elementNode.each.enumerable)), 
							ast.identifier 'forEach'), [loopFn])
					fn.body.body.push loopExp
				

				
				body.push ast.assignmentStatement 'buffer', '+=', elStartTag

				#call the rendering function for this tag
				jsParentNode.push(
					ast.assignmentStatement('buffer', '+=',
							ast.callExpressionIdentifier(renderFnName, fn.params )))

				elementNode.childNodes?.forEach (elem) ->
					visit elem, body, params
				
				if not isSelfClosing elementNode
					body.push ast.assignmentStatement 'buffer', '+=', ast.literal '</' + elementNode.tagName.toLowerCase() + '>'

				body.push ast.returnIdentifier 'buffer'
		
		visit = (elem, jsParentNode, parentParams) ->
			visitors[elem.nodeType] elem, jsParentNode, parentParams

		#entry point function for template
		render = ast.functionDeclaration "render", [ "model" ]
		render.body.body.push ast.variableDeclaration 'buffer', ''
		functionBlock.push render
		
		dom.childNodes.forEach (node) ->
			visit node, render.body.body, render.params

		render.body.body.push ast.returnIdentifier 'buffer'

		templateProperties = []
		functionBlock.forEach (statement)->
			if statement.type is 'FunctionDeclaration'
				templateProperties.push ast.property statement.id.name, ast.identifier statement.id.name

		obj = ast.objectExpression templateProperties
		functionBlock.push ast.returnStatement ast.objectExpression templateProperties
		JSON.stringify(templateAst)
		templateAst

	   


module.exports = new Cork escodegen.generate, parse

makeMemberExpr = (identifier, objName)->
	identifier.type = 'MemberExpression'
	identifier.object = ast.identifier objName
	identifier.property = ast.identifier identifier.name
	identifier.computed = false
	delete identifier.name
	identifier

interpolateLiteral = (textData, parentParams) ->
	match = undefined
	pieces = []
	interpolationPattern = /\$\{([^\}]*)\}/
	if interpolationPattern.test(textData)
		while match = interpolationPattern.exec(textData)
			index = textData.indexOf(match[0])
			if index
				pieces.push ast.literal textData.substring(0, index)

			pieces.push ast.identifier match[1]

			textData = textData.slice(index + match[0].length)
		if textData.length > 0
			pieces.push ast.literal textData
	else
		pieces.push ast.literal textData

	for expr in pieces when expr.type == 'Identifier'
		name = expr.name
		memberExprParts = expr.name.split('.')
		if memberExprParts.length>1
			name = memberExprParts[0]
		if parentParams.filter((id)->id.name==name).length == 0
			console.log 'could not find ' + name + ' in ' + JSON.stringify(parentParams)
			makeMemberExpr expr, 'model'


	pieces

test = [
	'<div><span each="product in products">${product.test} <ul><li each="tag in product.tags"><span>${tag}</span></li></ul></span><input data-test="${as}asd" type="text"></div>'
]

test.forEach (tmpl)-> console.log(module.exports.compile(tmpl))

#exports.interpolateLiteral = interpolateLiteral
