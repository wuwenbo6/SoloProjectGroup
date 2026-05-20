import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getContractScanDashboard,
  getScanResults,
  getHighRiskVulnerabilities,
  scanContract
} from '../lib/api';

export default function ContractScan() {
  const [dashboardStats, setDashboardStats] = useState(null);
  const [scanResults, setScanResults] = useState([]);
  const [highRiskVulns, setHighRiskVulns] = useState([]);
  const [selectedContract, setSelectedContract] = useState(null);
  const [newContractAddress, setNewContractAddress] = useState('');
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState('ALL');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [stats, results, highRisk] = await Promise.all([
        getContractScanDashboard(),
        getScanResults(),
        getHighRiskVulnerabilities()
      ]);
      setDashboardStats(stats);
      setScanResults(results);
      setHighRiskVulns(highRisk);
    } catch (err) {
      console.error('Failed to load scan data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleScanContract = async () => {
    if (!newContractAddress.trim()) return;
    
    setScanning(true);
    try {
      const result = await scanContract(newContractAddress);
      setScanResults(prev => [result, ...prev]);
      setNewContractAddress('');
      await loadData();
    } catch (err) {
      console.error('Failed to scan contract:', err);
    } finally {
      setScanning(false);
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'CRITICAL': return '#dc3545';
      case 'HIGH': return '#fd7e14';
      case 'MEDIUM': return '#ffc107';
      case 'LOW': return '#28a745';
      default: return '#6c757d';
    }
  };

  const getSeverityLabel = (severity) => {
    switch (severity) {
      case 'CRITICAL': return '严重';
      case 'HIGH': return '高危';
      case 'MEDIUM': return '中等';
      case 'LOW': return '低危';
      default: return severity;
    }
  };

  const getTotalVulns = (severityCounts) => {
    if (!severityCounts) return 0;
    return Object.values(severityCounts).reduce((a, b) => a + b, 0);
  };

  const filteredVulns = filterSeverity === 'ALL'
    ? highRiskVulns
    : highRiskVulns.filter(v => v.severity === filterSeverity);

  return (
    <div className="container">
      <div className="header">
        <h1>🔒 合约漏洞预警</h1>
        <Link href="/">
          <a className="back-btn">← 返回首页</a>
        </Link>
      </div>

      {loading ? (
        <div className="loading">正在加载扫描数据...</div>
      ) : (
        <>
          <div className="stats-grid">
            <div className="stat-card critical">
              <div className="stat-icon">🚨</div>
              <div className="stat-value">{dashboardStats?.criticalCount || 0}</div>
              <div className="stat-label">严重漏洞</div>
            </div>
            <div className="stat-card high">
              <div className="stat-icon">⚠️</div>
              <div className="stat-value">{dashboardStats?.highCount || 0}</div>
              <div className="stat-label">高危漏洞</div>
            </div>
            <div className="stat-card medium">
              <div className="stat-icon">🔶</div>
              <div className="stat-value">{dashboardStats?.mediumCount || 0}</div>
              <div className="stat-label">中等漏洞</div>
            </div>
            <div className="stat-card total">
              <div className="stat-icon">📊</div>
              <div className="stat-value">{dashboardStats?.contractsScanned || 0}</div>
              <div className="stat-label">已扫描合约</div>
            </div>
          </div>

          <div className="scan-section">
            <div className="scan-header">
              <h2>📡 扫描新合约</h2>
              <div className="scan-tools">
                <span className="tool-badge">Slither</span>
                <span className="tool-badge">Oyente</span>
              </div>
            </div>
            <div className="scan-input-group">
              <input
                type="text"
                value={newContractAddress}
                onChange={(e) => setNewContractAddress(e.target.value)}
                placeholder="输入合约地址 (0x...)"
                className="scan-input"
              />
              <button
                onClick={handleScanContract}
                disabled={scanning || !newContractAddress}
                className="scan-btn"
              >
                {scanning ? '扫描中...' : '开始扫描'}
              </button>
            </div>
          </div>

          <div className="content-layout">
            <div className="main-panel">
              <div className="panel-header">
                <h2>📋 合约扫描结果</h2>
              </div>
              <div className="scan-list">
                {scanResults.map((result) => (
                  <div
                    key={result.scanId}
                    className="scan-item"
                    onClick={() => setSelectedContract(
                      selectedContract?.contractAddress === result.contractAddress
                        ? null
                        : result
                    )}
                  >
                    <div className="scan-item-header">
                      <div className="contract-info">
                        <h3>{result.contractName}</h3>
                        <p className="contract-address">{result.contractAddress}</p>
                      </div>
                      <div className="scan-badges">
                        {result.severityCounts.CRITICAL > 0 && (
                          <span className="severity-badge critical">
                            CRITICAL: {result.severityCounts.CRITICAL}
                          </span>
                        )}
                        {result.severityCounts.HIGH > 0 && (
                          <span className="severity-badge high">
                            HIGH: {result.severityCounts.HIGH}
                          </span>
                        )}
                        {result.severityCounts.MEDIUM > 0 && (
                          <span className="severity-badge medium">
                            MEDIUM: {result.severityCounts.MEDIUM}
                          </span>
                        )}
                        {getTotalVulns(result.severityCounts) === 0 && (
                          <span className="severity-badge safe">安全</span>
                        )}
                      </div>
                    </div>
                    <div className="scan-meta">
                      <span>工具: {result.tool}</span>
                      <span>编译器: {result.compilerVersion}</span>
                      <span>代码: {result.totalLines} 行</span>
                      <span>耗时: {result.durationMs}ms</span>
                    </div>
                    <div className="scan-summary">{result.scanSummary}</div>

                    {selectedContract?.contractAddress === result.contractAddress && (
                      <div className="vuln-details">
                        <h4>漏洞详情</h4>
                        {result.vulnerabilities.map((vuln, idx) => (
                          <div key={idx} className="vuln-item">
                            <div className="vuln-header">
                              <span
                                className="vuln-severity"
                                style={{ backgroundColor: getSeverityColor(vuln.severity) }}
                              >
                                {getSeverityLabel(vuln.severity)}
                              </span>
                              <span className="vuln-score">CVSS: {vuln.cvssScore}</span>
                              <span className="vuln-tool">{vuln.tool}</span>
                            </div>
                            <h5 className="vuln-name">{vuln.name}</h5>
                            <p className="vuln-desc">{vuln.description}</p>
                            <div className="vuln-impact">
                              <strong>影响:</strong> {vuln.impact}
                            </div>
                            <div className="vuln-recommendation">
                              <strong>建议:</strong> {vuln.recommendation}
                            </div>
                            <div className="vuln-location">
                              受影响函数: <code>{vuln.functionName}</code> | 行号: {vuln.affectedLines?.join(', ')}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="side-panel">
              <div className="panel-section">
                <h3>🚨 高危漏洞预警</h3>
                <div className="filter-bar">
                  <select
                    value={filterSeverity}
                    onChange={(e) => setFilterSeverity(e.target.value)}
                    className="filter-select"
                  >
                    <option value="ALL">全部</option>
                    <option value="CRITICAL">严重</option>
                    <option value="HIGH">高危</option>
                  </select>
                  <span className="vuln-count">共 {filteredVulns.length} 个</span>
                </div>
                <div className="high-risk-list">
                  {filteredVulns.slice(0, 10).map((vuln, idx) => (
                    <div key={idx} className="high-risk-item">
                      <div
                        className="risk-indicator"
                        style={{ backgroundColor: getSeverityColor(vuln.severity) }}
                      />
                      <div className="risk-content">
                        <h5>{vuln.name}</h5>
                        <p className="risk-contract">
                          合约: {vuln.contractAddress?.substring(0, 18)}...
                        </p>
                        <p className="risk-function">
                          函数: {vuln.functionName} | CVSS: {vuln.cvssScore}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="panel-section">
                <h3>📚 漏洞知识库</h3>
                <div className="knowledge-list">
                  <div className="knowledge-item">
                    <h4>🔄 重入攻击</h4>
                    <p>攻击者通过递归调用在状态更新前提取资金</p>
                  </div>
                  <div className="knowledge-item">
                    <h4>🔢 整数溢出</h4>
                    <p>算术运算超出数据类型范围导致计算错误</p>
                  </div>
                  <div className="knowledge-item">
                    <h4>🚀 DelegateCall</h4>
                    <p>可控目标地址的delegatecall可能导致任意代码执行</p>
                  </div>
                  <div className="knowledge-item">
                    <h4>⚠️ tx.origin</h4>
                    <p>使用tx.origin认证容易受到钓鱼攻击</p>
                  </div>
                </div>
              </div>

              <div className="panel-section">
                <h3>🛠️ 集成工具</h3>
                <div className="tool-info">
                  <div className="tool-card">
                    <div className="tool-name">Slither</div>
                    <p className="tool-desc">基于Python的静态分析框架，支持多种漏洞检测</p>
                    <div className="tool-status">✓ 已集成</div>
                  </div>
                  <div className="tool-card">
                    <div className="tool-name">Oyente</div>
                    <p className="tool-desc">基于符号执行的EVM字节码分析工具</p>
                    <div className="tool-status">✓ 已集成</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
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
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          margin-bottom: 30px;
        }
        .stat-card {
          padding: 25px;
          border-radius: 12px;
          color: white;
          text-align: center;
        }
        .stat-card.critical {
          background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
        }
        .stat-card.high {
          background: linear-gradient(135deg, #fd7e14 0%, #e46c0a 100%);
        }
        .stat-card.medium {
          background: linear-gradient(135deg, #ffc107 0%, #e0a800 100%);
        }
        .stat-card.total {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .stat-icon {
          font-size: 2em;
          margin-bottom: 10px;
        }
        .stat-value {
          font-size: 2.5em;
          font-weight: bold;
        }
        .stat-label {
          opacity: 0.9;
          margin-top: 5px;
        }
        .scan-section {
          background: white;
          padding: 25px;
          border-radius: 12px;
          box-shadow: 0 2px 15px rgba(0,0,0,0.08);
          margin-bottom: 30px;
        }
        .scan-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .scan-header h2 {
          margin: 0;
          color: #333;
        }
        .scan-tools {
          display: flex;
          gap: 10px;
        }
        .tool-badge {
          background: #667eea;
          color: white;
          padding: 5px 12px;
          border-radius: 20px;
          font-size: 0.85em;
        }
        .scan-input-group {
          display: flex;
          gap: 15px;
        }
        .scan-input {
          flex: 1;
          padding: 15px 20px;
          border: 2px solid #e9ecef;
          border-radius: 8px;
          font-size: 1em;
          font-family: monospace;
        }
        .scan-input:focus {
          outline: none;
          border-color: #667eea;
        }
        .scan-btn {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 15px 40px;
          border-radius: 8px;
          font-size: 1.1em;
          font-weight: 600;
          cursor: pointer;
        }
        .scan-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .content-layout {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 30px;
        }
        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .panel-header h2 {
          margin: 0;
          color: #333;
        }
        .scan-list {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .scan-item {
          background: white;
          padding: 25px;
          border-radius: 12px;
          box-shadow: 0 2px 15px rgba(0,0,0,0.08);
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .scan-item:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 20px rgba(0,0,0,0.12);
        }
        .scan-item-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 15px;
        }
        .contract-info h3 {
          margin: 0 0 5px;
          color: #333;
        }
        .contract-address {
          margin: 0;
          font-family: monospace;
          color: #666;
          font-size: 0.9em;
        }
        .scan-badges {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .severity-badge {
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 0.8em;
          font-weight: 600;
          color: white;
        }
        .severity-badge.critical { background: #dc3545; }
        .severity-badge.high { background: #fd7e14; }
        .severity-badge.medium { background: #ffc107; color: #333; }
        .severity-badge.safe { background: #28a745; }
        .scan-meta {
          display: flex;
          gap: 20px;
          font-size: 0.85em;
          color: #666;
          margin-bottom: 15px;
          flex-wrap: wrap;
        }
        .scan-summary {
          padding: 12px;
          background: #f8f9fa;
          border-radius: 6px;
          font-weight: 500;
        }
        .vuln-details {
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid #eee;
        }
        .vuln-details h4 {
          margin: 0 0 15px;
          color: #333;
        }
        .vuln-item {
          padding: 15px;
          background: #fff5f5;
          border-radius: 8px;
          margin-bottom: 15px;
          border-left: 4px solid #dc3545;
        }
        .vuln-header {
          display: flex;
          gap: 10px;
          align-items: center;
          margin-bottom: 10px;
          flex-wrap: wrap;
        }
        .vuln-severity {
          color: white;
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 0.75em;
          font-weight: 600;
        }
        .vuln-score {
          font-weight: 600;
          color: #dc3545;
        }
        .vuln-tool {
          background: #e9ecef;
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 0.8em;
        }
        .vuln-name {
          margin: 0 0 8px;
          color: #333;
        }
        .vuln-desc {
          margin: 0 0 8px;
          color: #666;
          font-size: 0.9em;
        }
        .vuln-impact, .vuln-recommendation {
          margin: 5px 0;
          font-size: 0.85em;
          color: #555;
        }
        .vuln-location {
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px dashed #ddd;
          font-size: 0.85em;
          color: #666;
          font-family: monospace;
        }
        .side-panel {
          display: flex;
          flex-direction: column;
          gap: 25px;
        }
        .panel-section {
          background: white;
          padding: 20px;
          border-radius: 12px;
          box-shadow: 0 2px 15px rgba(0,0,0,0.08);
        }
        .panel-section h3 {
          margin: 0 0 15px;
          color: #333;
          font-size: 1.1em;
        }
        .filter-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }
        .filter-select {
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 6px;
        }
        .vuln-count {
          font-size: 0.9em;
          color: #666;
        }
        .high-risk-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          max-height: 400px;
          overflow-y: auto;
        }
        .high-risk-item {
          display: flex;
          gap: 12px;
          padding: 12px;
          background: #fff5f5;
          border-radius: 8px;
        }
        .risk-indicator {
          width: 6px;
          border-radius: 3px;
          flex-shrink: 0;
        }
        .risk-content h5 {
          margin: 0 0 5px;
          color: #333;
          font-size: 0.9em;
        }
        .risk-contract, .risk-function {
          margin: 2px 0;
          font-size: 0.8em;
          color: #666;
          font-family: monospace;
        }
        .knowledge-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .knowledge-item {
          padding: 12px;
          background: #f8f9fa;
          border-radius: 8px;
        }
        .knowledge-item h4 {
          margin: 0 0 5px;
          color: #333;
          font-size: 0.9em;
        }
        .knowledge-item p {
          margin: 0;
          font-size: 0.8em;
          color: #666;
          line-height: 1.4;
        }
        .tool-info {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .tool-card {
          padding: 15px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 8px;
          color: white;
        }
        .tool-name {
          font-weight: 600;
          font-size: 1.1em;
          margin-bottom: 5px;
        }
        .tool-desc {
          margin: 0;
          font-size: 0.85em;
          opacity: 0.9;
        }
        .tool-status {
          margin-top: 8px;
          font-size: 0.85em;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}
