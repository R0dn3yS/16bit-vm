const A = require('arcsecond');
const {
  validIdentifier,
  hexLiteral,
} = require('./common');
const T = require('./types');

const optionalWhitespaceSurrounded = A.between(A.optionalWhitespace)(A.optionalWhitespace);
const commaSeperated = A.sepBy(optionalWhitespaceSurrounded(A.char(',')));

const dataParser = size => A.coroutine(function* () {
  const isExport = Boolean(yield A.possibly(A.char('+')));
  yield A.str(`data${size}`);

  yield A.whitespace;
  const name = yield validIdentifier;
  yield A.whitespace;
  yield A.char('=');
  yield A.whitespace;
  yield A.char('{');
  yield A.whitespace;

  const values = yield commaSeperated(hexLiteral);

  yield A.whitespace;
  yield A.char('}');
  yield A.optionalWhitespace;
  return T.data({
    size,
    isExport,
    name,
    values,
  });
});

module.exports = {
  data8: dataParser(8),
  data16: dataParser(16),
}