const REGISTER_TYPES = {
  COIL: 'coil',
  DISCRETE_INPUT: 'discrete_input',
  HOLDING_REGISTER: 'holding_register',
  INPUT_REGISTER: 'input_register'
};

const REGISTER_TYPE_NAMES = {
  [REGISTER_TYPES.COIL]: '线圈 (Coil)',
  [REGISTER_TYPES.DISCRETE_INPUT]: '离散输入 (Discrete Input)',
  [REGISTER_TYPES.HOLDING_REGISTER]: '保持寄存器 (Holding Register)',
  [REGISTER_TYPES.INPUT_REGISTER]: '输入寄存器 (Input Register)'
};

module.exports = {
  REGISTER_TYPES,
  REGISTER_TYPE_NAMES
};
