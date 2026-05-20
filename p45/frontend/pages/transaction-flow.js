import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import * as d3 from 'd3';
import { getTransactionFlowGraph } from '../lib/api';

export default function TransactionFlow() {
  const [graphData, setGraphData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);
  const svgRef = useRef(null);

  useEffect(() => {
    loadGraphData();
  }, []);

  useEffect(() => {
    if (graphData && svgRef.current) {
      renderForceDirectedGraph();
    }
  }, [graphData]);

  const loadGraphData = async () => {
    try {
      const data = await getTransactionFlowGraph(500);
      setGraphData(data);
    } catch (err) {
      console.error('Failed to load transaction flow:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderForceDirectedGraph = () => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 800;
    const height = 600;

    const { nodes, edges } = graphData;

    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(edges).id(d => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(40));

    const zoom = d3.zoom()
      .scaleExtent([0.1, 5])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    const g = svg.append('g');

    const defs = svg.append('defs');
    defs.append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 28)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .append('svg:path')
      .attr('d', 'M 0,-5 L 10,0 L 0,5')
      .attr('fill', '#999');

    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(edges)
      .enter()
      .append('line')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', d => Math.min(Math.sqrt(d.transactionCount) * 2, 8))
      .attr('marker-end', 'url(#arrowhead)');

    link.append('title')
      .text(d => `转账金额: ${d.value.toFixed(2)}\n交易次数: ${d.transactionCount}`);

    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .attr('cursor', 'pointer')
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    node.append('circle')
      .attr('r', d => Math.min(10 + d.degree * 2, 35))
      .attr('fill', d => getNodeColor(d))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .on('click', (event, d) => setSelectedNode(d));

    node.append('text')
      .text(d => d.label)
      .attr('font-size', '8px')
      .attr('text-anchor', 'middle')
      .attr('dy', 4)
      .attr('fill', '#333')
      .attr('pointer-events', 'none');

    node.append('title')
      .text(d => `地址: ${d.id}\n度数: ${d.degree}\n入度: ${d.inDegree}\n出度: ${d.outDegree}\n总金额: ${d.amount.toFixed(2)}`);

    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node
        .attr('transform', d => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }
  };

  const getNodeColor = (node) => {
    const ratio = node.inDegree / (node.inDegree + node.outDegree);
    if (ratio > 0.7) return '#28a745';
    if (ratio < 0.3) return '#dc3545';
    return '#667eea';
  };

  const getPatternIcon = (type) => {
    switch (type) {
      case 'STAR': return '⭐';
      case 'CHAIN': return '🔗';
      case 'HUB': return '🎯';
      default: return '📊';
    }
  };

  const getPatternColor = (type) => {
    switch (type) {
      case 'STAR': return '#ffc107';
      case 'CHAIN': return '#28a745';
      case 'HUB': return '#dc3545';
      default: return '#667eea';
    }
  };

  return (
    <div className="container">
      <div className="header">
        <h1>交易流模式挖掘</h1>
        <Link href="/">
          <a className="back-btn">← 返回首页</a>
        </Link>
      </div>

      {loading ? (
        <div className="loading">正在分析交易流数据...</div>
      ) : (
        <div className="content">
          <div className="main-section">
            <div className="graph-container">
              <h2>力导向图 - 账户转账关系</h2>
              <div className="legend">
                <span className="legend-item">
                  <span className="legend-dot" style={{ background: '#28a745' }}></span>
                  主要收款账户
                </span>
                <span className="legend-item">
                  <span className="legend-dot" style={{ background: '#dc3545' }}></span>
                  主要付款账户
                </span>
                <span className="legend-item">
                  <span className="legend-dot" style={{ background: '#667eea' }}></span>
                  双向转账账户
                </span>
              </div>
              <svg ref={svgRef} width="100%" height="600" style={{ background: '#f8f9fa', borderRadius: '8px' }}></svg>
              <p className="hint">💡 拖拽节点可调整位置，滚轮可缩放</p>
            </div>

            {selectedNode && (
              <div className="node-details">
                <h3>选中节点详情</h3>
                <div className="detail-item">
                  <span className="label">地址:</span>
                  <span className="value mono">{selectedNode.id}</span>
                </div>
                <div className="detail-item">
                  <span className="label">总度数:</span>
                  <span className="value">{selectedNode.degree}</span>
                </div>
                <div className="detail-item">
                  <span className="label">入度:</span>
                  <span className="value">{selectedNode.inDegree}</span>
                </div>
                <div className="detail-item">
                  <span className="label">出度:</span>
                  <span className="value">{selectedNode.outDegree}</span>
                </div>
                <div className="detail-item">
                  <span className="label">交易次数:</span>
                  <span className="value">{selectedNode.transactionCount}</span>
                </div>
                <div className="detail-item">
                  <span className="label">总金额:</span>
                  <span className="value">{selectedNode.amount.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          <div className="side-section">
            <div className="stats-card">
              <h3>图统计信息</h3>
              <div className="stat-grid">
                <div className="stat-item">
                  <div className="stat-value">{graphData?.statistics?.nodeCount}</div>
                  <div className="stat-label">节点数</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{graphData?.statistics?.edgeCount}</div>
                  <div className="stat-label">边数</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{graphData?.statistics?.averageDegree}</div>
                  <div className="stat-label">平均度数</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{graphData?.statistics?.density}</div>
                  <div className="stat-label">图密度</div>
                </div>
              </div>
            </div>

            <div className="patterns-card">
              <h3>🔍 拓扑模式识别</h3>
              <div className="patterns-list">
                {graphData?.patterns?.length === 0 ? (
                  <div className="no-patterns">暂无识别到的模式</div>
                ) : (
                  graphData?.patterns?.map((pattern, idx) => (
                    <div
                      key={idx}
                      className="pattern-item"
                      style={{ borderLeftColor: getPatternColor(pattern.type) }}
                    >
                      <div className="pattern-header">
                        <span className="pattern-icon">{getPatternIcon(pattern.type)}</span>
                        <span className="pattern-name">{pattern.name}</span>
                      </div>
                      <p className="pattern-desc">{pattern.description}</p>
                      <div className="pattern-meta">
                        <span className="confidence">
                          置信度: {pattern.confidence.toFixed(1)}%
                        </span>
                        <span className="tx-count">
                          交易: {pattern.transactionCount}次
                        </span>
                      </div>
                      <div className="related-nodes">
                        <small>相关节点 ({pattern.relatedNodes.length}个):</small>
                        <div className="nodes-tags">
                          {pattern.relatedNodes.slice(0, 5).map((node, i) => (
                            <span key={i} className="node-tag">
                              {node.substring(0, 8)}...
                            </span>
                          ))}
                          {pattern.relatedNodes.length > 5 && (
                            <span className="node-tag more">
                              +{pattern.relatedNodes.length - 5}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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
        .loading {
          text-align: center;
          padding: 100px;
          font-size: 1.2em;
          color: #666;
        }
        .content {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 30px;
        }
        .graph-container {
          background: white;
          padding: 20px;
          border-radius: 10px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          margin-bottom: 20px;
        }
        .graph-container h2 {
          margin-top: 0;
          color: #333;
          font-size: 1.3em;
        }
        .legend {
          display: flex;
          gap: 20px;
          margin-bottom: 15px;
          flex-wrap: wrap;
        }
        .legend-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.9em;
          color: #666;
        }
        .legend-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          display: inline-block;
        }
        .hint {
          text-align: center;
          color: #999;
          font-size: 0.9em;
          margin-top: 10px;
        }
        .node-details {
          background: white;
          padding: 20px;
          border-radius: 10px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .node-details h3 {
          margin-top: 0;
          color: #333;
        }
        .detail-item {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #eee;
        }
        .detail-item:last-child {
          border-bottom: none;
        }
        .label {
          color: #666;
          font-weight: 500;
        }
        .value {
          color: #333;
        }
        .value.mono {
          font-family: monospace;
          font-size: 0.85em;
          word-break: break-all;
          max-width: 300px;
          text-align: right;
        }
        .stats-card,
        .patterns-card {
          background: white;
          padding: 20px;
          border-radius: 10px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          margin-bottom: 20px;
        }
        .stats-card h3,
        .patterns-card h3 {
          margin-top: 0;
          color: #333;
        }
        .stat-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
        }
        .stat-item {
          text-align: center;
          padding: 15px;
          background: #f8f9fa;
          border-radius: 8px;
        }
        .stat-value {
          font-size: 1.5em;
          font-weight: bold;
          color: #667eea;
        }
        .stat-label {
          font-size: 0.85em;
          color: #666;
          margin-top: 5px;
        }
        .patterns-list {
          max-height: 600px;
          overflow-y: auto;
        }
        .no-patterns {
          text-align: center;
          padding: 40px;
          color: #999;
        }
        .pattern-item {
          padding: 15px;
          background: #f8f9fa;
          border-radius: 8px;
          margin-bottom: 15px;
          border-left: 4px solid #667eea;
        }
        .pattern-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 8px;
        }
        .pattern-icon {
          font-size: 1.2em;
        }
        .pattern-name {
          font-weight: 600;
          color: #333;
        }
        .pattern-desc {
          margin: 0 0 10px;
          font-size: 0.9em;
          color: #666;
        }
        .pattern-meta {
          display: flex;
          justify-content: space-between;
          font-size: 0.85em;
          margin-bottom: 10px;
        }
        .confidence {
          color: #28a745;
          font-weight: 500;
        }
        .tx-count {
          color: #667eea;
        }
        .related-nodes small {
          color: #999;
          display: block;
          margin-bottom: 8px;
        }
        .nodes-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .node-tag {
          background: #e9ecef;
          padding: 3px 8px;
          border-radius: 12px;
          font-size: 0.75em;
          color: #495057;
          font-family: monospace;
        }
        .node-tag.more {
          background: #667eea;
          color: white;
        }
      `}</style>
    </div>
  );
}