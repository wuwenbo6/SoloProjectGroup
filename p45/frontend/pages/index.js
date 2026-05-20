import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { getStats, getBlocks, getTransactions } from '../lib/api';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function Home() {
  const [stats, setStats] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [statsData, blocksData, txData] = await Promise.all([
        getStats(),
        getBlocks(0, 5),
        getTransactions(0, 5),
      ]);
      setStats(statsData);
      setBlocks(blocksData.content || []);
      setTransactions(txData.content || []);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const chartData = {
    labels: ['Org1', 'Org2', 'Org3'],
    datasets: [
      {
        label: 'Transactions',
        data: [120, 190, 150],
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
      },
    ],
  };

  if (loading) return <div className="container">Loading...</div>;

  return (
    <div className="container">
      <h1 className="title">联盟链浏览器</h1>

      <div className="stats-grid">
        <div className="stat-card">
          <h3>区块数量</h3>
          <p className="stat-value">{stats?.blockCount || 0}</p>
        </div>
        <div className="stat-card">
          <h3>交易数量</h3>
          <p className="stat-value">{stats?.transactionCount || 0}</p>
        </div>
        <div className="stat-card">
          <h3>隐私交易</h3>
          <p className="stat-value">{stats?.privateTransactionCount || 0}</p>
        </div>
        <div className="stat-card">
          <h3>最新区块</h3>
          <p className="stat-value">#{stats?.latestBlockNumber || 0}</p>
        </div>
      </div>

      <div className="nav-links">
        <Link href="/blocks">
          <a className="nav-btn">查看所有区块</a>
        </Link>
        <Link href="/transactions">
          <a className="nav-btn">查看所有交易</a>
        </Link>
        <Link href="/privacy">
          <a className="nav-btn">隐私交易管理</a>
        </Link>
        <Link href="/contracts">
          <a className="nav-btn">合约调用图谱</a>
        </Link>
        <Link href="/transaction-flow">
          <a className="nav-btn nav-btn-special">交易流模式挖掘</a>
        </Link>
        <Link href="/contract-scan">
          <a className="nav-btn nav-btn-security">🔒 合约漏洞预警</a>
        </Link>
      </div>

      <div className="content-grid">
        <div className="section">
          <h2>最新区块</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>区块号</th>
                <th>哈希</th>
                <th>矿工</th>
                <th>交易数</th>
              </tr>
            </thead>
            <tbody>
              {blocks.map((block) => (
                <tr key={block.number}>
                  <td>{block.number}</td>
                  <td className="hash">{block.hash?.substring(0, 20)}...</td>
                  <td className="hash">{block.miner?.substring(0, 15)}...</td>
                  <td>{block.transactionCount || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="section">
          <h2>最新交易</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>交易哈希</th>
                <th>区块号</th>
                <th>From</th>
                <th>To</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.hash}>
                  <td className="hash">{tx.hash?.substring(0, 20)}...</td>
                  <td>{tx.blockNumber}</td>
                  <td className="hash">{tx.from?.substring(0, 15)}...</td>
                  <td className="hash">{tx.to?.substring(0, 15)}...</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="chart-section">
        <h2>组织交易分布</h2>
        <div style={{ height: '300px', width: '100%' }}>
          <Line data={chartData} />
        </div>
      </div>

      <style jsx>{`
        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
        }
        .title {
          text-align: center;
          color: #333;
          margin-bottom: 30px;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          margin-bottom: 30px;
        }
        .stat-card {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 20px;
          border-radius: 10px;
          text-align: center;
        }
        .stat-value {
          font-size: 2em;
          font-weight: bold;
          margin: 10px 0 0;
        }
        .nav-links {
          display: flex;
          gap: 15px;
          justify-content: center;
          margin-bottom: 30px;
          flex-wrap: wrap;
        }
        .nav-btn {
          background: #667eea;
          color: white;
          padding: 12px 24px;
          border-radius: 6px;
          text-decoration: none;
          transition: background 0.3s;
        }
        .nav-btn:hover {
          background: #5568d3;
        }
        .nav-btn-special {
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          animation: pulse 2s infinite;
        }
        .nav-btn-special:hover {
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          filter: brightness(1.1);
        }
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(245, 87, 108, 0.7); }
          70% { box-shadow: 0 0 0 10px rgba(245, 87, 108, 0); }
          100% { box-shadow: 0 0 0 0 rgba(245, 87, 108, 0); }
        }
        .nav-btn-security {
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
          animation: pulse-green 2s infinite;
        }
        .nav-btn-security:hover {
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
          filter: brightness(1.1);
        }
        @keyframes pulse-green {
          0% { box-shadow: 0 0 0 0 rgba(40, 167, 69, 0.7); }
          70% { box-shadow: 0 0 0 10px rgba(40, 167, 69, 0); }
          100% { box-shadow: 0 0 0 0 rgba(40, 167, 69, 0); }
        }
        .content-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 30px;
          margin-bottom: 30px;
        }
        .section {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 10px;
        }
        .section h2 {
          margin-top: 0;
          color: #333;
        }
        .data-table {
          width: 100%;
          border-collapse: collapse;
        }
        .data-table th,
        .data-table td {
          padding: 10px;
          text-align: left;
          border-bottom: 1px solid #ddd;
        }
        .hash {
          font-family: monospace;
          font-size: 0.9em;
        }
        .chart-section {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 10px;
        }
        .chart-section h2 {
          margin-top: 0;
        }
      `}</style>
    </div>
  );
}