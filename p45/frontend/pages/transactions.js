import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getTransactions } from '../lib/api';

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTransactions();
  }, [page]);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const data = await getTransactions(page, 20);
      setTransactions(data.content || []);
    } catch (err) {
      console.error('Failed to load transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="header">
        <h1>交易列表</h1>
        <Link href="/">
          <a className="back-btn">← 返回首页</a>
        </Link>
      </div>

      {loading ? (
        <div className="loading">Loading...</div>
      ) : (
        <>
          <table className="data-table">
            <thead>
              <tr>
                <th>交易哈希</th>
                <th>区块号</th>
                <th>From</th>
                <th>To</th>
                <th>Value</th>
                <th>Gas Price</th>
                <th>私有</th>
                <th>时间</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.hash}>
                  <td className="hash">{tx.hash?.substring(0, 30)}...</td>
                  <td className="block-number">{tx.blockNumber}</td>
                  <td className="hash">{tx.from?.substring(0, 20)}...</td>
                  <td className="hash">{tx.to?.substring(0, 20)}...</td>
                  <td>{tx.value}</td>
                  <td>{tx.gasPrice}</td>
                  <td>
                    {tx.isPrivate ? (
                      <span className="private-badge">私有</span>
                    ) : (
                      <span className="public-badge">公开</span>
                    )}
                  </td>
                  <td>{new Date(tx.timestamp).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pagination">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="page-btn"
            >
              上一页
            </button>
            <span className="page-info">第 {page + 1} 页</span>
            <button
              onClick={() => setPage(page + 1)}
              className="page-btn"
            >
              下一页
            </button>
          </div>
        </>
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
        .loading {
          text-align: center;
          padding: 50px;
          font-size: 1.2em;
        }
        .data-table {
          width: 100%;
          border-collapse: collapse;
          background: white;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          border-radius: 8px;
          overflow: hidden;
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
          color: #333;
        }
        .data-table tr:hover {
          background: #f8f9fa;
        }
        .block-number {
          font-weight: bold;
          color: #667eea;
        }
        .hash {
          font-family: monospace;
          font-size: 0.8em;
          color: #666;
        }
        .private-badge {
          background: #dc3545;
          color: white;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 0.8em;
        }
        .public-badge {
          background: #28a745;
          color: white;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 0.8em;
        }
        .pagination {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 20px;
          margin-top: 30px;
        }
        .page-btn {
          background: #667eea;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
        }
        .page-btn:disabled {
          background: #ccc;
          cursor: not-allowed;
        }
        .page-info {
          color: #666;
        }
      `}</style>
    </div>
  );
}