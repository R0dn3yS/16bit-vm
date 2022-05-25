const readline = require('readline');
const createMemory = require('./create-memory');
const CPU = require('./cpu');
const instructions = require('./instructions');

const IP = 0;
const ACC = 1;
const R1 = 2;
const R2 = 3;
const R3 = 4;
const R4 = 5;
const R5 = 6;
const R6 = 7;
const R7 = 8;
const R8 = 9;
const SP = 10;
const FP = 11;

const memory = createMemory(256*256);
const writableBytes = new Uint8Array(memory.buffer);

const cpu = new CPU(memory);

const subroutineAddress = 0x3000;
let i = 0;

writableBytes[i++] = instructions.PSH_LIT;
writableBytes[i++] = 0x33;
writableBytes[i++] = 0x33; // 0x3333

writableBytes[i++] = instructions.PSH_LIT;
writableBytes[i++] = 0x22;
writableBytes[i++] = 0x22; // 0x2222

writableBytes[i++] = instructions.PSH_LIT;
writableBytes[i++] = 0x11;
writableBytes[i++] = 0x11; // 0x1111

writableBytes[i++] = instructions.MOV_LIT_REG;
writableBytes[i++] = 0x12;
writableBytes[i++] = 0x34; // 0x1234
writableBytes[i++] = R1;

writableBytes[i++] = instructions.MOV_LIT_REG;
writableBytes[i++] = 0x56;
writableBytes[i++] = 0x78; // 0x5678
writableBytes[i++] = R2;

writableBytes[i++] = instructions.PSH_LIT;
writableBytes[i++] = 0x00;
writableBytes[i++] = 0x00; // 0x0000

writableBytes[i++] = instructions.CAL_LIT;
writableBytes[i++] = (subroutineAddress & 0xFF00) >> 8;
writableBytes[i++] = (subroutineAddress & 0x00FF);

writableBytes[i++] = instructions.PSH_LIT;
writableBytes[i++] = 0x44;
writableBytes[i++] = 0x44 // 0x4444

// Subroutine
i = subroutineAddress;

writableBytes[i++] = instructions.PSH_LIT;
writableBytes[i++] = 0x01;
writableBytes[i++] = 0x02; // 0x0102

writableBytes[i++] = instructions.PSH_LIT;
writableBytes[i++] = 0x03;
writableBytes[i++] = 0x04; // 0x0304

writableBytes[i++] = instructions.PSH_LIT;
writableBytes[i++] = 0x05;
writableBytes[i++] = 0x06; // 0x0506

writableBytes[i++] = instructions.MOV_LIT_REG;
writableBytes[i++] = 0x07;
writableBytes[i++] = 0x08; // 0x0708
writableBytes[i++] = R1;

writableBytes[i++] = instructions.MOV_LIT_REG;
writableBytes[i++] = 0x09;
writableBytes[i++] = 0x0A; // 0x090A
writableBytes[i++] = R8;

writableBytes[i++] = instructions.RET;

cpu.debug();
cpu.viewMemoryAt(cpu.getRegister('ip'));
cpu.viewMemoryAt(0xffff - 1 - 42, 44);

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});

rl.on('line', () => {
	cpu.step();
	cpu.debug();
	cpu.viewMemoryAt(cpu.getRegister('ip'));
	cpu.viewMemoryAt(0xffff - 1 - 42, 44);
});