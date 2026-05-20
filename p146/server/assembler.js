const REGISTERS = {
  'zero': 0, 'x0': 0, 'ra': 1, 'x1': 1, 'sp': 2, 'x2': 2, 'gp': 3, 'x3': 3,
  'tp': 4, 'x4': 4, 't0': 5, 'x5': 5, 't1': 6, 'x6': 6, 't2': 7, 'x7': 7,
  's0': 8, 'fp': 8, 'x8': 8, 's1': 9, 'x9': 9, 'a0': 10, 'x10': 10, 'a1': 11, 'x11': 11,
  'a2': 12, 'x12': 12, 'a3': 13, 'x13': 13, 'a4': 14, 'x14': 14, 'a5': 15, 'x15': 15,
  'a6': 16, 'x16': 16, 'a7': 17, 'x17': 17, 's2': 18, 'x18': 18, 's3': 19, 'x19': 19,
  's4': 20, 'x20': 20, 's5': 21, 'x21': 21, 's6': 22, 'x22': 22, 's7': 23, 'x23': 23,
  's8': 24, 'x24': 24, 's9': 25, 'x25': 25, 's10': 26, 'x26': 26, 's11': 27, 'x27': 27,
  't3': 28, 'x28': 28, 't4': 29, 'x29': 29, 't5': 30, 'x30': 30, 't6': 31, 'x31': 31
};

const CSR_REGISTERS = {
  'mstatus': 0x300,
  'mie': 0x304,
  'mtvec': 0x305,
  'mscratch': 0x340,
  'mepc': 0x341,
  'mcause': 0x342,
  'mtval': 0x343,
  'mip': 0x344
};

function parseNumber(str) {
  if (str.startsWith('0x') || str.startsWith('0X')) {
    return parseInt(str, 16);
  } else if (str.startsWith('0b') || str.startsWith('0B')) {
    return parseInt(str.slice(2), 2);
  } else {
    return parseInt(str, 10);
  }
}

function parseStringLiteral(str) {
  str = str.replace(/^["']|["']$/g, '');
  const bytes = [];
  let i = 0;
  while (i < str.length) {
    if (str[i] === '\\' && i + 1 < str.length) {
      i++;
      switch (str[i]) {
        case 'n': bytes.push(10); break;
        case 'r': bytes.push(13); break;
        case 't': bytes.push(9); break;
        case '\\': bytes.push(92); break;
        case '"': bytes.push(34); break;
        case '\'': bytes.push(39); break;
        default: bytes.push(str.charCodeAt(i));
      }
    } else {
      bytes.push(str.charCodeAt(i));
    }
    i++;
  }
  return bytes;
}

function assemble(code) {
  const lines = code.split('\n');
  const instructions = [];
  const labels = {};
  const dataBytes = [];
  let address = 0;

  lines.forEach((line, index) => {
    line = line.split('#')[0].trim();
    if (!line) return;

    const labelMatch = line.match(/^(\w+):\s*(.*)$/);
    if (labelMatch) {
      labels[labelMatch[1]] = address;
      line = labelMatch[2].trim();
    }

    if (!line) return;

    if (line.startsWith('.')) {
      const parts = line.split(/\s+/);
      const directive = parts[0].toLowerCase();
      
      if (directive === '.string') {
        const strContent = line.slice(7).trim();
        const bytes = parseStringLiteral(strContent);
        for (const b of bytes) {
          dataBytes.push({ address, value: b });
          address++;
        }
        dataBytes.push({ address, value: 0 });
        address++;
        return;
      } else if (directive === '.align') {
        const align = parseNumber(parts[1]) || 4;
        while (address % align !== 0) {
          dataBytes.push({ address, value: 0 });
          address++;
        }
        return;
      }
    }

    address += 4;
  });

  address = 0;
  const errors = [];

  lines.forEach((line, index) => {
    line = line.split('#')[0].trim();
    if (!line) return;

    const labelMatch = line.match(/^\w+:\s*(.*)$/);
    if (labelMatch) {
      line = labelMatch[1].trim();
    }

    if (!line) return;

    if (line.startsWith('.')) {
      const parts = line.split(/\s+/);
      const directive = parts[0].toLowerCase();
      
      if (directive === '.string') {
        const strContent = line.slice(7).trim();
        const bytes = parseStringLiteral(strContent);
        for (const b of bytes) {
          instructions.push({
            address: 0x10000 + address,
            code: b,
            isData: true,
            original: line
          });
          address++;
        }
        instructions.push({
          address: 0x10000 + address,
          code: 0,
          isData: true,
          original: line
        });
        address++;
        return;
      } else if (directive === '.align') {
        const align = parseNumber(parts[1]) || 4;
        while (address % align !== 0) {
          instructions.push({
            address: 0x10000 + address,
            code: 0,
            isData: true,
            original: line
          });
          address++;
        }
        return;
      }
    }

    const parts = line.split(/\s+/);
    const mnemonic = parts[0].toLowerCase();
    const operands = parts.slice(1).join('').split(',');

    let instruction = 0;

    try {
      switch (mnemonic) {
        case 'lui': {
          const rd = REGISTERS[operands[0].trim()];
          const imm = parseNumber(operands[1].trim());
          instruction = (imm & 0xfffff000) | (rd << 7) | 0x37;
          break;
        }
        case 'auipc': {
          const rd = REGISTERS[operands[0].trim()];
          const imm = parseNumber(operands[1].trim());
          instruction = (imm & 0xfffff000) | (rd << 7) | 0x17;
          break;
        }
        case 'jal': {
          const rd = REGISTERS[operands[0].trim()];
          let imm = labels[operands[1].trim()] !== undefined
            ? labels[operands[1].trim()] - address
            : parseNumber(operands[1].trim());
          const imm20 = ((imm >> 20) & 0x1) << 31;
          const imm10 = ((imm >> 1) & 0x3ff) << 21;
          const imm11 = ((imm >> 11) & 0x1) << 20;
          const imm8 = ((imm >> 12) & 0xff) << 12;
          instruction = imm20 | imm10 | imm11 | imm8 | (rd << 7) | 0x6f;
          break;
        }
        case 'jalr': {
          const rd = REGISTERS[operands[0].trim()];
          const rs1Match = operands[1].match(/(\d+)\((\w+)\)/);
          const offset = parseNumber(rs1Match[1]);
          const rs1 = REGISTERS[rs1Match[2]];
          instruction = ((offset & 0xfff) << 20) | (rs1 << 15) | (rd << 7) | 0x67;
          break;
        }
        case 'beq': case 'bne': case 'blt': case 'bge': case 'bltu': case 'bgeu': {
          const rs1 = REGISTERS[operands[0].trim()];
          const rs2 = REGISTERS[operands[1].trim()];
          let imm = labels[operands[2].trim()] !== undefined
            ? labels[operands[2].trim()] - address
            : parseNumber(operands[2].trim());
          const funct3 = { beq: 0, bne: 1, blt: 4, bge: 5, bltu: 6, bgeu: 7 }[mnemonic];
          const imm12 = ((imm >> 12) & 0x1) << 31;
          const imm10 = ((imm >> 1) & 0x3f) << 25;
          const imm4 = ((imm >> 5) & 0xf) << 8;
          const imm11 = ((imm >> 11) & 0x1) << 7;
          instruction = imm12 | imm10 | (rs2 << 20) | (rs1 << 15) | (funct3 << 12) | imm4 | imm11 | 0x63;
          break;
        }
        case 'lb': case 'lh': case 'lw': case 'lbu': case 'lhu': {
          const rd = REGISTERS[operands[0].trim()];
          const memMatch = operands[1].match(/([-\d]+)\((\w+)\)/);
          const offset = parseNumber(memMatch[1]);
          const rs1 = REGISTERS[memMatch[2]];
          const funct3 = { lb: 0, lh: 1, lw: 2, lbu: 4, lhu: 5 }[mnemonic];
          instruction = ((offset & 0xfff) << 20) | (rs1 << 15) | (funct3 << 12) | (rd << 7) | 0x03;
          break;
        }
        case 'sb': case 'sh': case 'sw': {
          const rs2 = REGISTERS[operands[0].trim()];
          const memMatch = operands[1].match(/([-\d]+)\((\w+)\)/);
          const offset = parseNumber(memMatch[1]);
          const rs1 = REGISTERS[memMatch[2]];
          const funct3 = { sb: 0, sh: 1, sw: 2 }[mnemonic];
          const imm7 = ((offset >> 5) & 0x7f) << 25;
          const imm5 = (offset & 0x1f) << 7;
          instruction = imm7 | (rs2 << 20) | (rs1 << 15) | (funct3 << 12) | imm5 | 0x23;
          break;
        }
        case 'addi': case 'slti': case 'sltiu': case 'xori': case 'ori': case 'andi': {
          const rd = REGISTERS[operands[0].trim()];
          const rs1 = REGISTERS[operands[1].trim()];
          const imm = parseNumber(operands[2].trim());
          const funct3 = { addi: 0, slti: 2, sltiu: 3, xori: 4, ori: 6, andi: 7 }[mnemonic];
          instruction = ((imm & 0xfff) << 20) | (rs1 << 15) | (funct3 << 12) | (rd << 7) | 0x13;
          break;
        }
        case 'slli': case 'srli': case 'srai': {
          const rd = REGISTERS[operands[0].trim()];
          const rs1 = REGISTERS[operands[1].trim()];
          const shamt = parseNumber(operands[2].trim()) & 0x1f;
          const funct3 = { slli: 1, srli: 5, srai: 5 }[mnemonic];
          const funct7 = mnemonic === 'srai' ? 0x20 : 0x00;
          instruction = (funct7 << 25) | (shamt << 20) | (rs1 << 15) | (funct3 << 12) | (rd << 7) | 0x13;
          break;
        }
        case 'add': case 'sub': case 'sll': case 'slt': case 'sltu': case 'xor': case 'srl': case 'sra': case 'or': case 'and': {
          const rd = REGISTERS[operands[0].trim()];
          const rs1 = REGISTERS[operands[1].trim()];
          const rs2 = REGISTERS[operands[2].trim()];
          const funct3 = { add: 0, sub: 0, sll: 1, slt: 2, sltu: 3, xor: 4, srl: 5, sra: 5, or: 6, and: 7 }[mnemonic];
          const funct7 = (mnemonic === 'sub' || mnemonic === 'sra') ? 0x20 : 0x00;
          instruction = (funct7 << 25) | (rs2 << 20) | (rs1 << 15) | (funct3 << 12) | (rd << 7) | 0x33;
          break;
        }
        case 'fence': {
          instruction = 0x0000000f;
          break;
        }
        case 'ecall': {
          instruction = 0x00000073;
          break;
        }
        case 'ebreak': {
          instruction = 0x00100073;
          break;
        }
        case 'mret': {
          instruction = 0x30200073;
          break;
        }
        case 'csrrw': case 'csrrs': case 'csrrc': {
          const rd = REGISTERS[operands[0].trim()];
          let csr = operands[1].trim();
          const rs1 = REGISTERS[operands[2].trim()];
          if (CSR_REGISTERS[csr] !== undefined) {
            csr = CSR_REGISTERS[csr];
          } else {
            csr = parseNumber(csr);
          }
          const funct3 = { csrrw: 1, csrrs: 2, csrrc: 3 }[mnemonic];
          instruction = (csr << 20) | (rs1 << 15) | (funct3 << 12) | (rd << 7) | 0x73;
          break;
        }
        case 'csrrwi': case 'csrrsi': case 'csrrci': {
          const rd = REGISTERS[operands[0].trim()];
          let csr = operands[1].trim();
          const zimm = parseNumber(operands[2].trim()) & 0x1f;
          if (CSR_REGISTERS[csr] !== undefined) {
            csr = CSR_REGISTERS[csr];
          } else {
            csr = parseNumber(csr);
          }
          const funct3 = { csrrwi: 5, csrrsi: 6, csrrci: 7 }[mnemonic];
          instruction = (csr << 20) | (zimm << 15) | (funct3 << 12) | (rd << 7) | 0x73;
          break;
        }
        default:
          errors.push({ line: index + 1, message: `Unknown instruction: ${mnemonic}` });
          return;
      }

      instructions.push({
        address: 0x10000 + address,
        code: instruction,
        original: line
      });
    } catch (e) {
      errors.push({ line: index + 1, message: e.message });
    }

    address += 4;
  });

  const codeBuffer = [];
  let lastAddress = 0x10000;
  
  instructions.sort((a, b) => a.address - b.address);
  
  instructions.forEach(inst => {
    while (lastAddress < inst.address) {
      codeBuffer.push(0);
      lastAddress++;
    }
    if (inst.isData) {
      codeBuffer.push(inst.code & 0xff);
      lastAddress++;
    } else {
      codeBuffer.push(inst.code & 0xff);
      codeBuffer.push((inst.code >> 8) & 0xff);
      codeBuffer.push((inst.code >> 16) & 0xff);
      codeBuffer.push((inst.code >> 24) & 0xff);
      lastAddress += 4;
    }
  });

  return {
    code: new Uint8Array(codeBuffer),
    instructions,
    errors
  };
}

module.exports = { assemble };
