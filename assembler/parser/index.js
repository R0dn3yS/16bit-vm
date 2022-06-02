const { inspect } = require('util');
const instructionParser = require('./instructions');

const deepLog = x => console.log(inspect(x, {
  depth: Infinity,
  colors: true
}));

const res = instructionParser.run('sub [!loc - $04], r4');
deepLog(res);
