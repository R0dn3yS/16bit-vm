const createMemory = require('./create-memory');
const registers = require('./registers');
const instructions = require('./instructions/meta');

class CPU {
  constructor(memory, interruptVectorAddress = 0x1000) {
    this.memory = memory;

    this.registers = createMemory(registers.length * 2);
    this.registerMap = registers.reduce((map, name, i) => {
      map[name] = i * 2;
      return map;
    }, {});

    this.interruptVectorAddress = interruptVectorAddress;
    this.isInInterruptHandler = false;
    this.setRegister('im', 0xffff);

    this.setRegister('sp', 0xffff - 1);
    this.setRegister('fp', 0xffff - 1);

    this.stackFrameSize = 0;
  }

  debug() {
    this.registerNames.forEach(name => {
      console.log(`${name}: ${this.getRegister(name).toString(16).padStart(4, '0')}`);
    });
    console.log();
  }

  viewMemoryAt(address, n = 8) {
    const nextNBytes = Array.from({length: n}, (_, i) =>
      this.memory.getUint8(address + i)
    ).map(v => `0x${v.toString(16).padStart(2, '0')}`);

    console.log(`${address.toString(16).padStart(4, '0')}: ${nextNBytes.join(' ')}`);
  }

  getRegister(name) {
    if (!(name in this.registerMap)) {
      throw new Error(`getRegister: No such register '${name}'`);
    }
    return this.registers.getUint16(this.registerMap[name]);
  }

  setRegister(name, value) {
    if (!(name in this.registerMap)) {
      throw new Error(`setRegister: No such register '${name}'`);
    }
    return this.registers.setUint16(this.registerMap[name], value);
  }

  fetch() {
    const nextInstructionAddress = this.getRegister('ip');
    const instruction = this.memory.getUint8(nextInstructionAddress);
    this.setRegister('ip', nextInstructionAddress + 1);
    return instruction;
  }

  fetch16() {
    const nextInstructionAddress = this.getRegister('ip');
    const instruction = this.memory.getUint16(nextInstructionAddress);
    this.setRegister('ip', nextInstructionAddress + 2);
    return instruction;
  }

  push(value) {
    const spAddress = this.getRegister('sp');
    this.memory.setUint16(spAddress, value);
    this.setRegister('sp', spAddress - 2);
    this.stackFrameSize += 2;
  }

  pop() {
    const nextSpAddress = this.getRegister('sp') + 2;
    this.setRegister('sp', nextSpAddress);
    this.stackFrameSize -= 2;
    return this.memory.getUint16(nextSpAddress);
  }

  pushState() {
    this.push(this.getRegister('r1'));
    this.push(this.getRegister('r2'));
    this.push(this.getRegister('r3'));
    this.push(this.getRegister('r4'));
    this.push(this.getRegister('r5'));
    this.push(this.getRegister('r6'));
    this.push(this.getRegister('r7'));
    this.push(this.getRegister('r8'));
    this.push(this.getRegister('ip'));
    this.push(this.stackFrameSize + 2);

    this.setRegister('fp', this.getRegister('sp'));
    this.stackFrameSize = 0;
  }

  popState() {
    const framePointerAddress = this.getRegister('fp');
    this.setRegister('sp', framePointerAddress);

    this.stackFrameSize = this.pop();
    const stackFrameSize = this.stackFrameSize;

    this.setRegister('ip', this.pop());
    this.setRegister('r8', this.pop());
    this.setRegister('r7', this.pop());
    this.setRegister('r6', this.pop());
    this.setRegister('r5', this.pop());
    this.setRegister('r4', this.pop());
    this.setRegister('r3', this.pop());
    this.setRegister('r2', this.pop());
    this.setRegister('r1', this.pop());

    const nArgs = this.pop();
    for (let i = 0; i < nArgs; i++) {
      this.pop();
    }

    this.setRegister('fp', framePointerAddress + stackFrameSize);
  }

  fetchRegisterIndex() {
    return (this.fetch() % this.registerNames.length) * 2;
  }

  handleInterrupt(value) {
    const interruptVectorIndex = value % 0xf;

    const isUnmasked = Boolean((1 << interruptVectorIndex) & this.getRegister('im'));
    if (!isUnmasked) {
      return;
    }

    const addressPointer = this.interruptVectorAddress + (interruptVectorIndex * 2);
    const address = this.memory.getUint16(addressPointer);

    if (!this.isInInterruptHandler) {
      // Push 0 for the number of arguments
      this.push(0);
      this.pushState();
    }

    this.isInInterruptHandler = true;
    this.setRegister('ip', address);
  }

  execute(instruction) {
    switch (instruction) {
      // Return from interrupt
      case instructions.RET_INT.opcode: {
        this.isInInterruptHandler = false;
        this.popState();
        return;
      }

      // Software Triggered Interrupt
      case instructions.INT.opcode: {
        const interruptValue = this.fetch16();
        this.handleInterrupt(interruptValue);
        return;
      }

      // Move Literal intro Register
      case instructions.MOV_LIT_REG.opcode: {
        const literal = this.fetch16();
        const register = this.fetchRegisterIndex();
        this.registers.setUint16(register, literal);
        return;
      }

      // Move Register to Register
      case instructions.MOV_REG_REG.opcode: {
        const registerFrom = this.fetchRegisterIndex();
        const registerTo = this.fetchRegisterIndex();
        const value = this.registers.getUint16(registerFrom);
        this.registers.setUint16(registerTo, value);
        return;
      }

      // Move Register to Memory
      case instructions.MOV_REG_MEM.opcode: {
        const registerFrom = this.fetchRegisterIndex();
        const address = this.fetch16();
        const value = this.registers.getUint16(registerFrom);
        this.memory.setUint16(address, value);
        return;
      }

      // Move Memory to Register
      case instructions.MOV_MEM_REG.opcode: {
        const address = this.fetch16();
        const registerTo = this.fetchRegisterIndex();
        const value = this.memory.getUint16(address);
        this.registers.setUint16(registerTo, value);
        return;
      }

      // Move Literal to Memory
      case instructions.MOV_LIT_MEM.opcode: {
        const value = fetch16();
        const address = fetch16();
        this.memory.setUint16(address, value);
        return;
      }

      // Move Register* to Register
      case instructions.MOV_REG_PTR_REG.opcode: {
        const r1 = this.fetchRegisterIndex();
        const r2 = this.fetchRegisterIndex();
        const ptr = this.registers.getUint16(r1);
        const value = this.memory.getUint16(ptr);
        this.registers.setUint16(r2, value);
        return;
      }

      // Move value at [Literal + Register] to Register
      case instructions.MOV_LIT_OFF_REG.opcode: {
        const baseAddress = this.fetch16();
        const r1 = this.fetchRegisterIndex();
        const r2 = this.fetchRegisterIndex();
        const offset = this.registers.getUint16(r1);

        const value = this.memory.getUint16(baseAddress + offset);
        this.registers.setUint16(r2, value);
      }

      // Add Register to Register
      case instructions.ADD_REG_REG.opcode: {
        const r1 = this.fetch();
        const r2 = this.fetch();
        const registerValue1 = this.registers.getUint16(r1);
        const registerValue2 = this.registers.getUint16(r2);
        this.setRegister('acc', registerValue1 + registerValue2);
        return;
      }

      // Add Literal to Register
      case instructions.ADD_LIT_REG.opcode: {
        const literal = fetch16();
        const r1 = this.fetchRegisterIndex();
        const registerValue = this.registers.getUint16(r1);
        this.setRegister('acc', literal + registerValue);
        return;
      }

      // Subtract Literal from Register
      case instructions.SUB_LIT_REG.opcode: {
        const literal = fetch16();
        const r1 = this.fetchRegisterIndex();
        const registerValue = this.registers.getUint16(r1);
        const res = registerValue - literal;
        this.setRegister('acc', res);
        return;
      }

      // Subtract Register value from Literal
      case instructions.SUB_REG_LIT.opcode: {
        const r1 = this.fetchRegisterIndex();
        const literal = fetch16();
        const registerValue = this.registers.getUint16(r1);
        const res = literal - registerValue;
        this.setRegister('acc', res);
        return;
      }

      // Subtract Register value from Register Value
      case instructions.SUB_REG_REG.opcode: {
        const r1 = this.fetchRegisterIndex();
        const r2 = this.fetchRegisterIndex();
        const registerValue1 = this.registers.getUint16(r1);
        const registerValue2 = this.registers.getUint16(r2);
        const res = registerValue1 - registerValue2;
        this.setRegister('acc', res);
        return;
      }

      // Multiply Literal by Register value
      case instructions.MUL_LIT_REG.opcode: {
        const literal = fetch16();
        const r1 = this.fetchRegisterIndex();
        const registerValue = this.registers.getUint16(r1);
        const res = literal * registerValue;
        this.setRegister('acc', res);
        return;
      }

      // Multiply Register value by Register value
      case instructions.MUL_REG_REG.opcode: {
        const r1 = this.fetchRegisterIndex();
        const r2 = this.fetchRegisterIndex();
        const registerValue1 = this.registers.getUint16(r1);
        const registerValue2 = this.registers.getUint16(r1);
        const res = registerValue1 * registerValue2;
        this.setRegister('acc', res);
        return;
      }

      // Increment value in Register
      case instructions.INC_REG.opcode: {
        const r1 = this.fetchRegisterIndex();
        const oldValue = this.registers.getUint16(r1);
        const newValue = oldValue + 1;
        this.setRegister('r1', newValue);
        return;
      }

      // Decrement value in Register
      case instructions.DEC_REG.opcode: {
        const r1 = this.fetchRegisterIndex();
        const oldValue = this.registers.getUint16(r1);
        const newValue = oldValue - 1;
        this.setRegister('r1', newValue);
        return;
      }

      // Left shift Register by literal
      case instructions.LSF_REG_LIT.opcode: {
        const r1 = this.fetchRegisterIndex();
        const literal = this.fetch();
        const registerValue = this.registers.getUint16(r1);
        const res = registerValue << literal;
        this.registers.setUint16('r1', res);
        return;
      }

      // Left shift Register by Register
      case instructions.LSF_REG_REG.opcode: {
        const r1 = this.fetchRegisterIndex();
        const r2 = this.fetchRegisterIndex();
        const registerValue = this.registers.getUint16(r1);
        const shiftBy = this.registers.getUint16(r2);
        const res = registerValue << shiftBy;
        this.registers.setUint16('r1', res);
        return;
      }

      // Right shift Register by literal
      case instructions.RSF_REG_LIT.opcode: {
        const r1 = this.fetchRegisterIndex();
        const literal = this.fetch();
        const registerValue = this.registers.getUint16(r1);
        const res = registerValue >> literal;
        this.registers.setUint16('r1', res);
        return;
      }

      // Right shift Register by Register
      case instructions.RSF_REG_REG.opcode: {
        const r1 = this.fetchRegisterIndex();
        const r2 = this.fetchRegisterIndex();
        const registerValue = this.registers.getUint16(r1);
        const shiftBy = this.registers.getUint16(r2);
        const res = registerValue >> shiftBy;
        this.registers.setUint16('r1', res);
        return;
      }

      // AND Register with Literal
      case instructions.AND_REG_LIT.opcode: {
        const r1 = this.fetchRegisterIndex();
        const literal = this.fetch16();
        const registerValue = this.registers.getUint16(r1);
        const res = registerValue & literal;
        this.setRegister('acc', res);
        return;
      }

      // AND Register with Register
      case instructions.AND_REG_REG.opcode: {
        const r1 = this.fetchRegisterIndex();
        const r2 = this.fetchRegisterIndex();
        const registerValue1 = this.registers.getUint16(r1);
        const registerValue2 = this.registers.getUint16(r2);
        const res = registerValue1 & registerValue2;
        this.setRegister('acc', res);
        return;
      }

      // OR Register with Literal
      case instructions.OR_REG_LIT.opcode: {
        const r1 = this.fetchRegisterIndex();
        const literal = this.fetch16();
        const registerValue = this.registers.getUint16(r1);
        const res = registerValue | literal;
        this.setRegister('acc', res);
        return;
      }

      // OR Register with Register
      case instructions.OR_REG_REG.opcode: {
        const r1 = this.fetchRegisterIndex();
        const r2 = this.fetchRegisterIndex();
        const registerValue1 = this.registers.getUint16(r1);
        const registerValue2 = this.registers.getUint16(r2);
        const res = registerValue1 | registerValue2;
        this.setRegister('acc', res);
        return;
      }

      // XOR Register with Literal
      case instructions.XOR_REG_LIT.opcode: {
        const r1 = this.fetchRegisterIndex();
        const literal = this.fetch16();
        const registerValue = this.registers.getUint16(r1);
        const res = registerValue ^ literal;
        this.setRegister('acc', res);
        return;
      }

      // XOR Register with Register
      case instructions.XOR_REG_REG.opcode: {
        const r1 = this.fetchRegisterIndex();
        const r2 = this.fetchRegisterIndex();
        const registerValue1 = this.registers.getUint16(r1);
        const registerValue2 = this.registers.getUint16(r2);
        const res = registerValue1 ^ registerValue2;
        this.setRegister('acc', res);
        return;
      }

      // NOT
      case instructions.NOT.opcode: {
        const r1 = this.fetchRegisterIndex();
        const registerValue = this.registers.getUint16(r1);
        const res = (~registerValue) & 0xffff;
        this.setRegister('acc', res);
        return;
      }

      // Jump if not equal
      case instructions.JMP_NOT_EQ.opcode: {
        const value = this.fetch16();
        const address = this.fetch16();

        if (value !== this.getRegister('acc')) {
          this.setRegister('ip', address);
        }

        return;
      }

      // Jump if Register not equal
      case instructions.JNE_REG.opcode: {
        const r1 = this.fetchRegisterIndex();
        const value = this.registers.getUint16(r1);
        const address = this.fetch16();

        if (value !== this.getRegister('acc')) {
          this.setRegister('ip', address);
        }
        return;
      }

      // Jump if equal
      case instructions.JMP_NOT_EQ.opcode: {
        const value = this.fetch16();
        const address = this.fetch16();

        if (value === this.getRegister('acc')) {
          this.setRegister('ip', address);
        }

        return;
      }

      // Jump if Register equal
      case instructions.JNE_REG.opcode: {
        const r1 = this.fetchRegisterIndex();
        const value = this.registers.getUint16(r1);
        const address = this.fetch16();

        if (value === this.getRegister('acc')) {
          this.setRegister('ip', address);
        }
        return;
      }

      // Jump if less than
      case instructions.JMP_NOT_EQ.opcode: {
        const value = this.fetch16();
        const address = this.fetch16();

        if (value < this.getRegister('acc')) {
          this.setRegister('ip', address);
        }

        return;
      }

      // Jump if Register less than
      case instructions.JNE_REG.opcode: {
        const r1 = this.fetchRegisterIndex();
        const value = this.registers.getUint16(r1);
        const address = this.fetch16();

        if (value < this.getRegister('acc')) {
          this.setRegister('ip', address);
        }
        return;
      }

      // Jump if greater than
      case instructions.JMP_NOT_EQ.opcode: {
        const value = this.fetch16();
        const address = this.fetch16();

        if (value > this.getRegister('acc')) {
          this.setRegister('ip', address);
        }

        return;
      }

      // Jump if Register greater than
      case instructions.JNE_REG.opcode: {
        const r1 = this.fetchRegisterIndex();
        const value = this.registers.getUint16(r1);
        const address = this.fetch16();

        if (value > this.getRegister('acc')) {
          this.setRegister('ip', address);
        }
        return;
      }

      // Jump if less than or equal
      case instructions.JMP_NOT_EQ.opcode: {
        const value = this.fetch16();
        const address = this.fetch16();

        if (value <= this.getRegister('acc')) {
          this.setRegister('ip', address);
        }

        return;
      }

      // Jump if Register less than or equal
      case instructions.JNE_REG.opcode: {
        const r1 = this.fetchRegisterIndex();
        const value = this.registers.getUint16(r1);
        const address = this.fetch16();

        if (value <= this.getRegister('acc')) {
          this.setRegister('ip', address);
        }
        return;
      }

      // Jump if greater than or equal
      case instructions.JMP_NOT_EQ.opcode: {
        const value = this.fetch16();
        const address = this.fetch16();

        if (value >= this.getRegister('acc')) {
          this.setRegister('ip', address);
        }

        return;
      }

      // Jump if Register greater than or equal
      case instructions.JNE_REG.opcode: {
        const r1 = this.fetchRegisterIndex();
        const value = this.registers.getUint16(r1);
        const address = this.fetch16();

        if (value >= this.getRegister('acc')) {
          this.setRegister('ip', address);
        }
        return;
      }

      // Push Literal
      case instructions.PSH_LIT.opcode: {
        const value = this.fetch16();
        this.push(value);
        return;
      }

      // Push Register
      case instructions.PSH_REG.opcode: {
        const registerIndex = this.fetchRegisterIndex();
        this.push(this.registers.getUint16(registerIndex));
        return;
      }

      // Pop
      case instructions.POP.opcode: {
        const registerIndex = this.fetchRegisterIndex();
        const value = this.pop();
        this.registers.setUint16(registerIndex, value);
        return;
      }

      // Call Literal
      case instructions.CAL_LIT.opcode: {
        const address = this.fetch16();
        this.pushState();
        this.setRegister('ip', address);
        return;
      }

      // Call Register
      case instructions.CAL_REG.opcode: {
        const registerIndex = this.fetchRegisterIndex();
        const address = this.registers.getUint16(registerIndex);
        this.pushState();
        this.setRegister('ip', address);
        return;
      }

      // Return from subroutine
      case instructions.RET.opcode: {
        this.popState();
        return;
      }

      case instructions.HLT.opcode: {
        return true;
      }
    }
  }

  step() {
    const instruction = this.fetch();
    return this.execute(instruction);
  }

  run() {
    const halt = this.step();
    if (!halt) {
      setImmediate(() => this.run());
    }
  }
}

module.exports = CPU;