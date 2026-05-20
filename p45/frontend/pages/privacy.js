import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getPrivateTransactions, decryptPayload, getAllOrgPublicKeys } from '../lib/api';

export default function Privacy() {
  const [transactions, setTransactions] = useState([]);
  const [orgKeys, setOrgKeys] = useState({});
  const [selectedTx, setSelectedTx] = useState(null);
  const [selectedOrg, setSelectedOrg] = useState('Org1');
  const [privateKey, setPrivateKey] = useState('');
  const [decryptedResult, setDecryptedResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [decrypting, setDecrypting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [txData, keysData] = await Promise.all([
        getPrivateTransactions(0, 10),
        getAllOrgPublicKeys(),
      ]);
      setTransactions(txData.content || []);
      setOrgKeys(keysData || {});
    } catch (err) {
      console.error('Failed to load privacy data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDecrypt = async () => {
    if (!selectedTx) return;

    setDecrypting(true);
    setError(null);
    setDecryptedResult(null);

    try {
      const result = await decryptPayload(selectedTx.input, selectedOrg, privateKey);
      setDecryptedResult(result);
    } catch (err) {
      console.error('Failed to decrypt:', err);
      const errorMsg = err.response?.data?.message || '解密失败：权限不足或密钥无效';
      setError({
        type: err.response?.data?.error || '解密失败',
        message: errorMsg,
        timestamp: err.response?.data?.timestamp
      });
    } finally {
      setDecrypting(false);
    }
  };

  return (
    <div className="container">
      <div className="header">
        <h1>隐私交易管理</h1>
        <Link href="/">
          <a className="back-btn">← 返回首页</a>
        </Link>
      </div>

      <div className="grid">
        <div className="section">
          <h2>隐私交易列表</h2>
          {loading ? (
            <div className="loading">Loading...</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>交易哈希</th>
                  <th>隐私组</th>
                  <th>发送方</th>
                  <th>选择</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.hash}>
                    <td className="hash">{tx.hash?.substring(0, 25)}...</td>
                    <td>{tx.privacyGroupId || 'N/A'}</td>
                    <td className="hash">{tx.privateFrom?.substring(0, 15)}...</td>
                    <td>
                      <button
                        onClick={() => {
                          setSelectedTx(tx);
                          setDecryptedResult(null);
                        }}
                        className="select-btn"
                      >
                        选择
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="section">
          <h2>组织公钥列表</h2>
          <div className="org-list">
            {Object.entries(orgKeys).map(([org, key]) => (
              <div key={org} className="org-item">
                <div className="org-name">{org}</div>
                <div className="org-key">{key?.substring(0, 30)}...</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedTx && (
        <div className="decrypt-section">
          <h2>Payload 解密演示</h2>
          <div className="demo-box">
            <div className="demo-row">
              <label>选择解密组织：</label>
              <select
                value={selectedOrg}
                onChange={(e) => setSelectedOrg(e.target.value)}
                className="select-input"
              >
                {Object.keys(orgKeys).map((org) => (
                  <option key={org} value={org}>
                    {org}
                  </option>
                ))}
              </select>
            </div>

            <div className="demo-row">
              <label>加密的 Payload：</label>
              <textarea
                readOnly
                value={selectedTx.input}
                className="payload-input"
              />
            </div>

            <div className="demo-row">
              <label>隐私密钥 <span className="required">(必填)</span>：</label>
              <input
                type="password"
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                placeholder="请输入组织对应的隐私密钥"
                className="key-input"
              />
              <div className="hint-text">
                💡 测试密钥: Org1 = {orgKeys['Org1']?.substring(0, 20)}...
              </div>
            </div>

            <button
              onClick={handleDecrypt}
              disabled={decrypting || !privateKey}
              className="decrypt-btn"
            >
              {decrypting ? '解密中...' : '开始解密'}
            </button>

            {error && (
              <div className="error-box">
                <h4>❌ {error.type}</h4>
                <p>{error.message}</p>
                <small className="error-time">时间: {error.timestamp || new Date().toISOString()}</small>
              </div>
            )}

            {decryptedResult && decryptedResult.success && (
              <div className="result-box">
                <h4>✅ 解密成功</h4>
                <p><strong>组织:</strong> {decryptedResult.orgName}</p>
                <p><strong>日志ID:</strong> {decryptedResult.logId}</p>
                <p><strong>解密结果:</strong></p>
                <pre>{decryptedResult.decryptedData}</pre>
              </div>
            )}
          </div>

          <div className="privacy-note">
            <h4>💡 隐私交易说明</h4>
            <p>
              联盟链中的隐私交易通过 Tessera 管理器实现：
            </p>
            <ul>
              <li>只有指定的参与组织可以解密交易内容</li>
              <li>交易哈希公开可见，但 payload 内容加密</li>
              <li>使用公钥加密，对应私钥解密</li>
            </ul>
          </div>
        </div>
      )}

      <style jsx>{`
        .container {
          max-width: 1200px;
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
        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 30px;
          margin-bottom: 30px;
        }
        .section {
          background: white;
          padding: 20px;
          border-radius: 10px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .section h2 {
          margin-top: 0;
          color: #333;
          margin-bottom: 20px;
        }
        .loading {
          text-align: center;
          padding: 50px;
        }
        .data-table {
          width: 100%;
          border-collapse: collapse;
        }
        .data-table th,
        .data-table td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #eee;
        }
        .data-table th {
          background: #f8f9fa;
          font-weight: 600;
        }
        .hash {
          font-family: monospace;
          font-size: 0.8em;
          color: #666;
        }
        .select-btn {
          background: #667eea;
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 4px;
          cursor: pointer;
        }
        .org-list {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }
        .org-item {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 8px;
        }
        .org-name {
          font-weight: bold;
          color: #667eea;
          margin-bottom: 5px;
        }
        .org-key {
          font-family: monospace;
          font-size: 0.8em;
          color: #666;
          word-break: break-all;
        }
        .decrypt-section {
          background: white;
          padding: 30px;
          border-radius: 10px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .decrypt-section h2 {
          margin-top: 0;
          color: #333;
        }
        .demo-box {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        .demo-row {
          margin-bottom: 15px;
        }
        .demo-row label {
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
          color: #555;
        }
        .select-input {
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 6px;
          min-width: 200px;
        }
        .payload-input {
          width: 100%;
          height: 80px;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-family: monospace;
          font-size: 0.8em;
          resize: none;
          background: white;
        }
        .decrypt-btn {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 12px 30px;
          border-radius: 6px;
          font-size: 1.1em;
          cursor: pointer;
          width: 100%;
        }
        .decrypt-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .result-box {
          margin-top: 20px;
          padding: 15px;
          background: #d4edda;
          border-radius: 6px;
          border: 1px solid #c3e6cb;
        }
        .result-box h4 {
          margin: 0 0 10px;
          color: #155724;
        }
        .result-box pre {
          margin: 0;
          white-space: pre-wrap;
          font-family: monospace;
          color: #155724;
        }
        .privacy-note {
          background: #fff3cd;
          padding: 20px;
          border-radius: 8px;
          border: 1px solid #ffeaa7;
        }
        .privacy-note h4 {
          margin: 0 0 10px;
          color: #856404;
        }
        .required {
          color: #dc3545;
        }
        .key-input {
          width: 100%;
          padding: 12px;
          border: 2px solid #ddd;
          border-radius: 6px;
          font-family: monospace;
          font-size: 0.9em;
          box-sizing: border-box;
          transition: border-color 0.3s;
        }
        .key-input:focus {
          outline: none;
          border-color: #667eea;
        }
        .hint-text {
          margin-top: 8px;
          font-size: 0.85em;
          color: #6c757d;
        }
        .error-box {
          margin-top: 20px;
          padding: 15px;
          background: #f8d7da;
          border-radius: 6px;
          border: 1px solid #f5c6cb;
        }
        .error-box h4 {
          margin: 0 0 10px;
          color: #721c24;
        }
        .error-box p {
          margin: 0 0 8px;
          color: #721c24;
        }
        .error-time {
          color: #a71d2a;
          font-size: 0.85em;
        }
        .privacy-note p,
        .privacy-note li {
          color: #856404;
        }
      `}</style>
    </div>
  );
}