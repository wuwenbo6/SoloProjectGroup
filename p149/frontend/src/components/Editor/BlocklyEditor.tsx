import React, { useEffect, useRef } from 'react';
import * as Blockly from 'blockly';
import { defineLadderBlocks, ladderGenerator } from '../../blocks/ladderBlocks';

interface BlocklyEditorProps {
  onXmlChange?: (xml: string) => void;
  initialXml?: string;
  readOnly?: boolean;
}

export const BlocklyEditor: React.FC<BlocklyEditorProps> = ({
  onXmlChange,
  initialXml,
  readOnly = false
}) => {
  const blocklyDiv = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);

  useEffect(() => {
    if (!blocklyDiv.current) return;

    // 定义梯形图块
    defineLadderBlocks();

    // 创建工作区
    const workspace = Blockly.inject(blocklyDiv.current, {
      toolbox: {
        kind: 'categoryToolbox',
        contents: [
          {
            kind: 'category',
            name: '输入触点',
            colour: '#5b8c00',
            contents: [
              { kind: 'block', type: 'contact_no' },
              { kind: 'block', type: 'contact_nc' },
              { kind: 'block', type: 'contact_pos' },
              { kind: 'block', type: 'contact_neg' },
            ]
          },
          {
            kind: 'category',
            name: '内部继电器',
            colour: '#135200',
            contents: [
              { kind: 'block', type: 'contact_m' },
            ]
          },
          {
            kind: 'category',
            name: '输出线圈',
            colour: '#1d39c4',
            contents: [
              { kind: 'block', type: 'coil_out' },
              { kind: 'block', type: 'coil_set' },
              { kind: 'block', type: 'coil_reset' },
            ]
          },
          {
            kind: 'category',
            name: '定时器',
            colour: '#531dab',
            contents: [
              { kind: 'block', type: 'timer_ton' },
              { kind: 'block', type: 'timer_tof' },
              { kind: 'block', type: 'timer_tp' },
            ]
          },
          {
            kind: 'category',
            name: '逻辑运算',
            colour: '#873800',
            contents: [
              { kind: 'block', type: 'logic_or' },
              { kind: 'block', type: 'logic_and' },
            ]
          }
        ]
      },
      grid: {
        spacing: 20,
        length: 3,
        colour: '#ccc',
        snap: true
      },
      zoom: {
        controls: true,
        wheel: true,
        startScale: 1.0,
        maxScale: 3,
        minScale: 0.3,
        scaleSpeed: 1.2
      },
      readOnly: readOnly,
      move: {
        scrollbars: true,
        drag: true,
        wheel: true
      }
    });

    workspaceRef.current = workspace;

    // 加载初始XML
    if (initialXml) {
      try {
        const xml = Blockly.utils.xml.textToDom(initialXml);
        Blockly.Xml.domToWorkspace(xml, workspace);
      } catch (e) {
        console.error('Error loading initial XML:', e);
      }
    }

    // 监听工作区变化
    const handleChange = () => {
      if (onXmlChange && workspaceRef.current) {
        const xml = Blockly.Xml.workspaceToDom(workspaceRef.current);
        const xmlText = Blockly.Xml.domToText(xml);
        onXmlChange(xmlText);
      }
    };

    workspace.addChangeListener(handleChange);

    return () => {
      workspace.removeChangeListener(handleChange);
      workspace.dispose();
    };
  }, [initialXml, readOnly, onXmlChange]);

  const generateCode = () => {
    if (!workspaceRef.current) return '';
    const code = ladderGenerator.workspaceToCode(workspaceRef.current);
    return `[${code.replace(/,\n$/, '')}]`;
  };

  return (
    <div className="relative w-full h-full">
      <div ref={blocklyDiv} className="w-full h-full" />
    </div>
  );
};

export default BlocklyEditor;
