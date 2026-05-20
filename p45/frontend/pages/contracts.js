import { useEffect, useState } from 'react';
import Link from 'next/link';
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
} from 'react-flow-renderer';

const initialNodes = [
  {
    id: 'Org1',
    type: 'input',
    data: { label: 'Org1 (发起方)' },
    position: { x: 50, y: 100 },
    style: { background: '#667eea', color: 'white' },
  },
  {
    id: 'Org2',
    type: 'input',
    data: { label: 'Org2 (参与方)' },
    position: { x: 50, y: 250 },
    style: { background: '#764ba2', color: 'white' },
  },
  {
    id: 'Org3',
    type: 'input',
    data: { label: 'Org3 (参与方)' },
    position: { x: 50, y: 400 },
    style: { background: '#f093fb', color: 'white' },
  },
  {
    id: 'Contract1',
    data: { label: '合约 A\n(资产转移)' },
    position: { x: 400, y: 175 },
    style: { background: '#43cea2', color: 'white' },
  },
  {
    id: 'Contract2',
    data: { label: '合约 B\n(数据存证)' },
    position: { x: 400, y: 350 },
    style: { background: '#11998e', color: 'white' },
  },
  {
    id: 'Ledger',
    type: 'output',
    data: { label: '共享账本' },
    position: { x: 750, y: 260 },
    style: { background: '#38ef7d', color: 'white' },
  },
];

const initialEdges = [
  { id: 'e1', source: 'Org1', target: 'Contract1', animated: true },
  { id: 'e2', source: 'Org2', target: 'Contract1', animated: true },
  { id: 'e3', source: 'Org1', target: 'Contract2', animated: true },
  { id: 'e4', source: 'Org3', target: 'Contract2', animated: true },
  { id: 'e5', source: 'Contract1', target: 'Ledger', animated: true },
  { id: 'e6', source: 'Contract2', target: 'Ledger', animated: true },
];

export default function Contracts() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState(null);

  const onConnect = (params) =>
    setEdges((eds) => addEdge({ ...params, animated: true }, eds));

  const onNodeClick = (event, node) => {
    setSelectedNode(node);
  };

  const contractCalls = [
    { id: 1, from: 'Org1', contract: '合约 A', method: 'transfer', params: '{to: Org2, value: 100}', time: '10:30:15' },
    { id: 2, from: 'Org2', contract: '合约 A', method: 'approve', params: '{spender: Org3, value: 50}', time: '10:32:45' },
    { id: 3, from: 'Org1', contract: '合约 B', method: 'storeData', params: '{hash: 0x1234...}', time: '10:35:20' },
    { id: 4, from: 'Org3', contract: '合约 B', method: 'verifyData', params: '{hash: 0x1234...}', time: '10:38:10' },
    { id: 5, from: 'Org2', contract: '合约 A', method: 'transferFrom', params: '{from: Org1, to: Org3, value: 30}', time: '10:40:55' },
  ];

  return (
    <div className="container">
      <div className="header">
        <h1>合约调用图谱</h1>
        <Link href="/">
          <a className="back-btn">← 返回首页</a>
        </Link>
      </div>

      <div className="content">
        <div className="flow-section">
          <h2>交易流可视化</h2>
          <div className="flow-container">
            <ReactFlowProvider>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                fitView
              >
                <Controls />
                <MiniMap />
                <Background variant="dots" gap={12} size={1} />
              </ReactFlow>
            </ReactFlowProvider>
          </div>

          {selectedNode && (
            <div className="node-info">
              <h4>选中节点信息</h4>
              <p><strong>ID:</strong> {selectedNode.id}</p>
              <p><strong>名称:</strong> {selectedNode.data.label}</p>
            </div>
          )}
        </div>

        <div className="calls-section">
          <h2>合约调用记录</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>调用方</th>
                <th>合约</th>
                <th>方法</th>
                <th>参数</th>
                <th>时间</th>
              </tr>
            </thead>
            <tbody>
              {contractCalls.map((call) => (
                <tr key={call.id}>
                  <td>{call.id}</td>
                  <td className="org-tag">{call.from}</td>
                  <td>{call.contract}</td>
                  <td className="method-tag">{call.method}</td>
                  <td className="params-col">{call.params}</td>
                  <td>{call.time}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="legend">
            <h4>图例说明</h4>
            <div className="legend-items">
              <div className="legend-item">
                <span className="legend-box org1"></span>
                <span>组织节点（发起/参与方）</span>
              </div>
              <div className="legend-item">
                <span className="legend-box contract1"></span>
                <span>智能合约</span>
              </div>
              <div className="legend-item">
                <span className="legend-box ledger"></span>
                <span>共享账本</span>
              </div>
              <div className="legend-item">
                <span className="legend-arrow">→</span>
                <span>交易调用流向</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
        }
        .header h1 {
          margin: 0;
          color: #333;
        }
        .back-btn {
          background: #6c757d;
          color: white;
          padding: 10px 20px;
          border-radius: 6px;
          text-decoration: none;
        }
        .content {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 30px;
        }
        .flow-section,
        .calls-section {
          background: white;
          padding: 20px;
          border-radius: 10px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .flow-section h2,
        .calls-section h2 {
          margin-top: 0;
          color: #333;
          margin-bottom: 20px;
        }
        .flow-container {
          height: 500px;
          border: 1px solid #eee;
          border-radius: 8px;
        }
        .node-info {
          margin-top: 20px;
          padding: 15px;
          background: #f8f9fa;
          border-radius: 8px;
        }
        .node-info h4 {
          margin: 0 0 10px;
          color: #333;
        }
        .node-info p {
          margin: 5px 0;
          color: #666;
        }
        .data-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.85em;
        }
        .data-table th,
        .data-table td {
          padding: 10px 8px;
          text-align: left;
          border-bottom: 1px solid #eee;
        }
        .data-table th {
          background: #f8f9fa;
          font-weight: 600;
          color: #333;
        }
        .org-tag {
          background: #667eea;
          color: white;
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 0.9em;
        }
        .method-tag {
          font-family: monospace;
          color: #764ba2;
          font-weight: 600;
        }
        .params-col {
          font-family: monospace;
          font-size: 0.9em;
          color: #666;
          max-width: 150px;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .legend {
          margin-top: 30px;
          padding: 20px;
          background: #f8f9fa;
          border-radius: 8px;
        }
        .legend h4 {
          margin: 0 0 15px;
          color: #333;
        }
        .legend-items {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .legend-item {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #666;
        }
        .legend-box {
          width: 20px;
          height: 20px;
          border-radius: 4px;
        }
        .org1 {
          background: #667eea;
        }
        .contract1 {
          background: #43cea2;
        }
        .ledger {
          background: #38ef7d;
        }
        .legend-arrow {
          font-size: 1.5em;
          color: #667eea;
        }
      `}</style>
    </div>
  );
}