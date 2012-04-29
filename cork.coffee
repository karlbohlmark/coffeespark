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

		functionBlock = templateAst.body

		visitors =
			3: (textNode, jsParentNode) ->
				sequence = interpolateLiteral(textNode.value)
				right = (if sequence.length is 1 then sequence[0] else ast.additionSequence(sequence))
				jsParentNode.push ast.assignmentStatement("buffer", "+=", right)

			1: (elementNode, jsParentNode) ->
				fn = ast.functionDeclaration(elementNode.tagName.toLowerCase(), [])
				fn.body.body.push ast.variableDeclaration("buffer", "")
		
				# Put the function declarations in the outer scope together with render to allow them
				# be used separately for partial rendering
				functionBlock.push fn

				#call the rendering function for this tag
				jsParentNode.push(
					ast.assignmentStatement('buffer', '+=',
							ast.callExpressionIdentifier(elementNode.tagName.toLowerCase())))

				elementNode.childNodes?.forEach (elem) ->
					visit elem, fn.body.body

				fn.body.body.push ast.returnIdentifier 'buffer'
		
		visit = (elem, jsParentNode) ->
			visitors[elem.nodeType] elem, jsParentNode

		#entry point function for template
		render = ast.functionDeclaration "render", [ "model" ]
		
		templateAst.body.push render

		dom.childNodes.forEach (node) ->
			visit node, render.body.body
		templateAst

	   


module.exports = new Cork escodegen.generate, parse

interpolateLiteral = (textData) ->
	console.log "interpolate: " + textData
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
	
	console.log "got:" + JSON.stringify(pieces)
	pieces

test = [
	'<div><span>${test}</span><input type="text></div>'
]

test.forEach (tmpl)-> console.log(module.exports.compile(tmpl))

#exports.interpolateLiteral = interpolateLiteral