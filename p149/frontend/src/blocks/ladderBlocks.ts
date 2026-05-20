import * as Blockly from 'blockly';

export const defineLadderBlocks = () => {
  // 常开触点 - Normally Open
  Blockly.Blocks['contact_no'] = {
    init: function() {
      this.appendDummyInput()
        .appendField("| |")
        .appendField(new Blockly.FieldTextInput("I0.0"), "VAR");
      this.setOutput(true, "Contact");
      this.setColour(120);
      this.setTooltip("常开触点");
      this.setHelpUrl("");
    }
  };

  // 常闭触点 - Normally Closed
  Blockly.Blocks['contact_nc'] = {
    init: function() {
      this.appendDummyInput()
        .appendField("|/|")
        .appendField(new Blockly.FieldTextInput("I0.1"), "VAR");
      this.setOutput(true, "Contact");
      this.setColour(120);
      this.setTooltip("常闭触点");
      this.setHelpUrl("");
    }
  };

  // 上升沿触点 - Positive Edge
  Blockly.Blocks['contact_pos'] = {
    init: function() {
      this.appendDummyInput()
        .appendField("|P|")
        .appendField(new Blockly.FieldTextInput("I0.2"), "VAR");
      this.setOutput(true, "Contact");
      this.setColour(160);
      this.setTooltip("上升沿触点");
      this.setHelpUrl("");
    }
  };

  // 下降沿触点 - Negative Edge
  Blockly.Blocks['contact_neg'] = {
    init: function() {
      this.appendDummyInput()
        .appendField("|N|")
        .appendField(new Blockly.FieldTextInput("I0.3"), "VAR");
      this.setOutput(true, "Contact");
      this.setColour(160);
      this.setTooltip("下降沿触点");
      this.setHelpUrl("");
    }
  };

  // 普通线圈 - Output
  Blockly.Blocks['coil_out'] = {
    init: function() {
      this.appendValueInput("INPUT")
        .setCheck("Contact")
        .appendField("( )")
        .appendField(new Blockly.FieldTextInput("Q0.0"), "VAR");
      this.setPreviousStatement(true, "Rung");
      this.setNextStatement(true, "Rung");
      this.setColour(210);
      this.setTooltip("输出线圈");
      this.setHelpUrl("");
    }
  };

  // 置位线圈 - Set
  Blockly.Blocks['coil_set'] = {
    init: function() {
      this.appendValueInput("INPUT")
        .setCheck("Contact")
        .appendField("(S)")
        .appendField(new Blockly.FieldTextInput("Q0.1"), "VAR");
      this.setPreviousStatement(true, "Rung");
      this.setNextStatement(true, "Rung");
      this.setColour(210);
      this.setTooltip("置位线圈");
      this.setHelpUrl("");
    }
  };

  // 复位线圈 - Reset
  Blockly.Blocks['coil_reset'] = {
    init: function() {
      this.appendValueInput("INPUT")
        .setCheck("Contact")
        .appendField("(R)")
        .appendField(new Blockly.FieldTextInput("Q0.2"), "VAR");
      this.setPreviousStatement(true, "Rung");
      this.setNextStatement(true, "Rung");
      this.setColour(210);
      this.setTooltip("复位线圈");
      this.setHelpUrl("");
    }
  };

  // TON定时器 - Timer On
  Blockly.Blocks['timer_ton'] = {
    init: function() {
      this.appendValueInput("INPUT")
        .setCheck("Contact")
        .appendField("TON");
      this.appendDummyInput()
        .appendField("定时器:")
        .appendField(new Blockly.FieldTextInput("T0"), "TIMER");
      this.appendDummyInput()
        .appendField("预设值 PT:")
        .appendField(new Blockly.FieldNumber(1000, 0), "PT");
      this.setPreviousStatement(true, "Rung");
      this.setNextStatement(true, "Rung");
      this.setColour(290);
      this.setTooltip("延时接通定时器");
      this.setHelpUrl("");
    }
  };

  // TOF定时器 - Timer Off
  Blockly.Blocks['timer_tof'] = {
    init: function() {
      this.appendValueInput("INPUT")
        .setCheck("Contact")
        .appendField("TOF");
      this.appendDummyInput()
        .appendField("定时器:")
        .appendField(new Blockly.FieldTextInput("T1"), "TIMER");
      this.appendDummyInput()
        .appendField("预设值 PT:")
        .appendField(new Blockly.FieldNumber(1000, 0), "PT");
      this.setPreviousStatement(true, "Rung");
      this.setNextStatement(true, "Rung");
      this.setColour(290);
      this.setTooltip("延时断开定时器");
      this.setHelpUrl("");
    }
  };

  // TP定时器 - Pulse Timer
  Blockly.Blocks['timer_tp'] = {
    init: function() {
      this.appendValueInput("INPUT")
        .setCheck("Contact")
        .appendField("TP");
      this.appendDummyInput()
        .appendField("定时器:")
        .appendField(new Blockly.FieldTextInput("T2"), "TIMER");
      this.appendDummyInput()
        .appendField("预设值 PT:")
        .appendField(new Blockly.FieldNumber(1000, 0), "PT");
      this.setPreviousStatement(true, "Rung");
      this.setNextStatement(true, "Rung");
      this.setColour(290);
      this.setTooltip("脉冲定时器");
      this.setHelpUrl("");
    }
  };

  // 并联块 - OR
  Blockly.Blocks['logic_or'] = {
    init: function() {
      this.appendValueInput("A")
        .setCheck("Contact")
        .appendField("OR");
      this.appendValueInput("B")
        .setCheck("Contact");
      this.setOutput(true, "Contact");
      this.setColour(20);
      this.setTooltip("逻辑或（并联）");
      this.setHelpUrl("");
    }
  };

  // 串联块 - AND
  Blockly.Blocks['logic_and'] = {
    init: function() {
      this.appendValueInput("A")
        .setCheck("Contact")
        .appendField("AND");
      this.appendValueInput("B")
        .setCheck("Contact");
      this.setOutput(true, "Contact");
      this.setColour(20);
      this.setTooltip("逻辑与（串联）");
      this.setHelpUrl("");
    }
  };

  // 内部变量触点
  Blockly.Blocks['contact_m'] = {
    init: function() {
      this.appendDummyInput()
        .appendField("|M|")
        .appendField(new Blockly.FieldTextInput("M0.0"), "VAR");
      this.setOutput(true, "Contact");
      this.setColour(120);
      this.setTooltip("内部继电器触点");
      this.setHelpUrl("");
    }
  };
};

// 梯形图代码生成器
export const ladderGenerator = new Blockly.Generator('LADDER');

ladderGenerator.forBlock['contact_no'] = function(block) {
  const varName = block.getFieldValue('VAR');
  return [`{"type":"contact_no","var":"${varName}"}`, ladderGenerator.ORDER_ATOMIC];
};

ladderGenerator.forBlock['contact_nc'] = function(block) {
  const varName = block.getFieldValue('VAR');
  return [`{"type":"contact_nc","var":"${varName}"}`, ladderGenerator.ORDER_ATOMIC];
};

ladderGenerator.forBlock['contact_pos'] = function(block) {
  const varName = block.getFieldValue('VAR');
  return [`{"type":"contact_pos","var":"${varName}"}`, ladderGenerator.ORDER_ATOMIC];
};

ladderGenerator.forBlock['contact_neg'] = function(block) {
  const varName = block.getFieldValue('VAR');
  return [`{"type":"contact_neg","var":"${varName}"}`, ladderGenerator.ORDER_ATOMIC];
};

ladderGenerator.forBlock['contact_m'] = function(block) {
  const varName = block.getFieldValue('VAR');
  return [`{"type":"contact_m","var":"${varName}"}`, ladderGenerator.ORDER_ATOMIC];
};

ladderGenerator.forBlock['coil_out'] = function(block) {
  const input = ladderGenerator.valueToCode(block, 'INPUT', ladderGenerator.ORDER_ATOMIC) || 'null';
  const varName = block.getFieldValue('VAR');
  return `{"type":"coil_out","var":"${varName}","input":${input}},\n`;
};

ladderGenerator.forBlock['coil_set'] = function(block) {
  const input = ladderGenerator.valueToCode(block, 'INPUT', ladderGenerator.ORDER_ATOMIC) || 'null';
  const varName = block.getFieldValue('VAR');
  return `{"type":"coil_set","var":"${varName}","input":${input}},\n`;
};

ladderGenerator.forBlock['coil_reset'] = function(block) {
  const input = ladderGenerator.valueToCode(block, 'INPUT', ladderGenerator.ORDER_ATOMIC) || 'null';
  const varName = block.getFieldValue('VAR');
  return `{"type":"coil_reset","var":"${varName}","input":${input}},\n`;
};

ladderGenerator.forBlock['timer_ton'] = function(block) {
  const input = ladderGenerator.valueToCode(block, 'INPUT', ladderGenerator.ORDER_ATOMIC) || 'null';
  const timer = block.getFieldValue('TIMER');
  const pt = block.getFieldValue('PT');
  return `{"type":"timer_ton","timer":"${timer}","pt":${pt},"input":${input}},\n`;
};

ladderGenerator.forBlock['timer_tof'] = function(block) {
  const input = ladderGenerator.valueToCode(block, 'INPUT', ladderGenerator.ORDER_ATOMIC) || 'null';
  const timer = block.getFieldValue('TIMER');
  const pt = block.getFieldValue('PT');
  return `{"type":"timer_tof","timer":"${timer}","pt":${pt},"input":${input}},\n`;
};

ladderGenerator.forBlock['timer_tp'] = function(block) {
  const input = ladderGenerator.valueToCode(block, 'INPUT', ladderGenerator.ORDER_ATOMIC) || 'null';
  const timer = block.getFieldValue('TIMER');
  const pt = block.getFieldValue('PT');
  return `{"type":"timer_tp","timer":"${timer}","pt":${pt},"input":${input}},\n`;
};

ladderGenerator.forBlock['logic_or'] = function(block) {
  const a = ladderGenerator.valueToCode(block, 'A', ladderGenerator.ORDER_ATOMIC) || 'null';
  const b = ladderGenerator.valueToCode(block, 'B', ladderGenerator.ORDER_ATOMIC) || 'null';
  return [`{"type":"or","a":${a},"b":${b}}`, ladderGenerator.ORDER_ATOMIC];
};

ladderGenerator.forBlock['logic_and'] = function(block) {
  const a = ladderGenerator.valueToCode(block, 'A', ladderGenerator.ORDER_ATOMIC) || 'null';
  const b = ladderGenerator.valueToCode(block, 'B', ladderGenerator.ORDER_ATOMIC) || 'null';
  return [`{"type":"and","a":${a},"b":${b}}`, ladderGenerator.ORDER_ATOMIC];
};

ladderGenerator.scrub_ = function(block, code, thisOnly) {
  const nextBlock = block.nextConnection && block.nextConnection.targetBlock();
  if (nextBlock && !thisOnly) {
    return code + ladderGenerator.blockToCode(nextBlock);
  }
  return code;
};
