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

	compile: (tmpl)-> @codegen @generateAst @parse tmpl

	generateAst: (dom)->
		templateAst =
			type:'Program',
			body: []

		scopeExpr = ast.functionExpression null
		functionBlock = scopeExpr.body.body

		selfInvoking = ast.callExpression scopeExpr
		templateAst.body.push ast.expressionStatement selfInvoking


		selfClosing = ['input', 'meta', 'link']

		visitors =
			3: (textNode, jsParentNode, parentParams) ->
				sequence = interpolateLiteral textNode.value, parentParams
				
				console.log JSON.stringify(sequence)
				right = (if sequence.length is 1 then sequence[0] else ast.additionSequence(sequence))
				jsParentNode.push ast.assignmentStatement("buffer", "+=", right)

			1: (elementNode, jsParentNode, parentParams) ->
				fn = ast.functionDeclaration(elementNode.tagName.toLowerCase(), ['model'])
				fn.body.body.push ast.variableDeclaration("buffer", "")
		
				# Put the function declarations in the outer scope together with render to allow them
				# be used separately for partial rendering
				functionBlock.push fn

				startTag = (tag)->
					parts = []
					parts.push ast.literal '<' + tag.tagName.toLowerCase()
					if tag.attributes.length
						for i in [0..tag.attributes.length-1]
							attr = tag.attributes[i]
							console.log attr.value
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


				fn.body.body.push ast.assignmentStatement 'buffer', '+=', startTag elementNode

				#call the rendering function for this tag
				jsParentNode.push(
					ast.assignmentStatement('buffer', '+=',
							ast.callExpressionIdentifier(elementNode.tagName.toLowerCase(), [ast.identifier('model')] )))

				elementNode.childNodes?.forEach (elem) ->
					visit elem, fn.body.body, fn.params

				fn.body.body.push ast.assignmentStatement 'buffer', '+=', ast.literal '</' + elementNode.tagName.toLowerCase() + '>'

				fn.body.body.push ast.returnIdentifier 'buffer'
		
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
		makeMemberExpr expr, 'model' if parentParams.indexOf(expr.name) ==-1

	pieces

test = [
	'<div><span>${test}</span><input data-test="${as}asd" type="text"></div>'
]

test.forEach (tmpl)-> console.log(module.exports.compile(tmpl))

#exports.interpolateLiteral = interpolateLiteral