functionDeclaration = (name, args) ->
  type: "FunctionDeclaration"
  id:
    type: "Identifier"
    name: name

  params: (args or []).map((arg) ->
    type: "Identifier"
    name: arg
  )
  body:
    type: "BlockStatement"
    body: []

identifier = (name) ->
  type: "Identifier"
  name: name

literal = (value) ->
  type: "Literal"
  value: value

variableDeclaration = (name, init) ->
  type: "VariableDeclaration"
  declarations: [
    type: "VariableDeclarator"
    id:
      type: "Identifier"
      name: name

    init:
      type: "Literal"
      value: init
  ]
  kind: "var"

returnIdentifier = (name)->
  type: "ReturnStatement"
  "argument": {
    "type": "Identifier",
    "name": name
  }

expressionStatement = (expression) ->
  type: "ExpressionStatement"
  expression: expression

callExpression = (callee, arguments) ->
  type: "CallExpression"
  callee: callee
  arguments: arguments or []

callExpressionIdentifier = (identifier, arguments) ->
  callExpression
    type: "Identifier"
    name: identifier
  , arguments

additionSequence = (pieces) ->
  right =
    type: "BinaryExpression"
    operator: "+"

  current = [ right ]
  p = 0

  while p < pieces.length - 2
    current.unshift current[0].left =
      type: "BinaryExpression"
      operator: "+"
    p++
  current[0].left = pieces.shift()
  current.shift().right = pieces.shift()  while current.length and pieces.length
  right

assignmentStatement = (identifierLeft, operator, expressionRight) ->
  type: "ExpressionStatement"
  expression:
    type: "AssignmentExpression"
    operator: operator
    left:
      type: "Identifier"
      name: identifierLeft

    right: expressionRight

module.exports = {
  functionDeclaration
  variableDeclaration
  expressionStatement
  callExpression
  callExpressionIdentifier
  additionSequence
  assignmentStatement
  identifier
  literal
  returnIdentifier
}