const { asType } = require('./util');

const register = asType('REGISTER');
const hexLiteral = asType('HEX_LITERAL');
const variable = asType('VARIABLE');

const opPlus = asType('OP_PLUS');
const opMinus = asType('OP_MINUS');
const opMultiply = asType('OP_MULITPLY');

const binaryOperation = asType('BINARY_OPERATION');
const bracketedExpression = asType('BRACKETED_EXPRESSION');
const squareBracketExpression = asType('SQUARE_BRACKETED_EXPRESSION');

const instruction = asType('INSTRUCTION');

module.exports = {
  register,
  hexLiteral,
  variable,
  opPlus,
  opMinus,
  opMultiply,
  binaryOperation,
  bracketedExpression,
  squareBracketExpression,
  instruction,
};