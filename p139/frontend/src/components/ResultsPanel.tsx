import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { SimulationResult } from '../types';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface ResultsPanelProps {
  results: SimulationResult | null;
  isRunning: boolean;
}

export const ResultsPanel: React.FC<ResultsPanelProps> = ({ results, isRunning }) => {
  if (isRunning) {
    return (
      <div
        style={{
          background: '#1a1a2e',
          padding: '20px',
          borderRadius: '8px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            display: 'inline-block',
            width: '40px',
            height: '40px',
            border: '4px solid #e94560',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
        <p style={{ color: '#fff', marginTop: '12px' }}>
          Simulating quantum circuit...
        </p>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!results) {
    return (
      <div
        style={{
          background: '#1a1a2e',
          padding: '40px 20px',
          borderRadius: '8px',
          textAlign: 'center',
          color: '#888',
        }}
      >
        <p style={{ fontSize: '18px', margin: '0 0 8px 0' }}>🔮</p>
        <p>Run a circuit to see the results</p>
      </div>
    );
  }

  const probabilityLabels = Object.keys(results.probabilities).sort();
  const probabilityData = probabilityLabels.map(
    (label) => results.probabilities[label] * 100
  );

  const chartData = {
    labels: probabilityLabels,
    datasets: [
      {
        label: 'Probability (%)',
        data: probabilityData,
        backgroundColor: 'rgba(233, 69, 96, 0.7)',
        borderColor: '#e94560',
        borderWidth: 2,
        borderRadius: 4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#fff',
        },
      },
    },
    scales: {
      x: {
        ticks: { color: '#888' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
      },
      y: {
        ticks: { color: '#888' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        beginAtZero: true,
        max: 100,
      },
    },
  };

  const measurements = Object.entries(results.measurements || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div
      style={{
        background: '#1a1a2e',
        padding: '20px',
        borderRadius: '8px',
      }}
    >
      <h3 style={{ margin: '0 0 16px 0', color: '#fff', fontSize: '16px' }}>
        Simulation Results
      </h3>

      <div style={{ marginBottom: '24px', height: '200px' }}>
        <Bar data={chartData} options={chartOptions} />
      </div>

      <div>
        <h4 style={{ margin: '0 0 12px 0', color: '#e94560', fontSize: '14px' }}>
          Top Measurements (1024 shots)
        </h4>
        <div style={{ display: 'grid', gap: '8px' }}>
          {measurements.map(([state, count]) => (
            <div
              key={state}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 12px',
                background: '#16213e',
                borderRadius: '6px',
              }}
            >
              <span style={{ color: '#fff', fontFamily: 'monospace' }}>
                |{state}⟩
              </span>
              <span style={{ color: '#888' }}>
                {count} ({((count / 1024) * 100).toFixed(1)}%)
              </span>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          marginTop: '16px',
          padding: '12px',
          background: '#16213e',
          borderRadius: '6px',
          textAlign: 'center',
        }}
      >
        <span style={{ color: '#888', fontSize: '12px' }}>
          Execution time: {results.execution_time.toFixed(3)}s
        </span>
      </div>
    </div>
  );
};
