const elfy = require('elfy');

function parse(buffer) {
  const elf = elfy.parse(buffer);
  
  const entry = elf.entry;
  const sections = [];
  const segments = [];

  elf.sections.forEach(section => {
    if (section.type === 'PROGBITS' && section.flags && section.flags.write) {
      sections.push({
        name: section.name,
        address: section.addr,
        size: section.size,
        data: buffer.slice(section.offset, section.offset + section.size)
      });
    }
  });

  elf.segments.forEach(segment => {
    if (segment.type === 'LOAD') {
      segments.push({
        vaddr: segment.vaddr,
        memsz: segment.memsz,
        filesz: segment.filesz,
        offset: segment.offset,
        data: buffer.slice(segment.offset, segment.offset + segment.filesz)
      });
    }
  });

  return {
    entry,
    sections,
    segments,
    is64Bit: elf.class === 'ELF64',
    endian: elf.data === '2LSB' ? 'little' : 'big'
  };
}

module.exports = { parse };
