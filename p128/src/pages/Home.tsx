import { useState } from 'react';
import { Candle, Droplets, Clock, Wind, Download, Layers } from 'lucide-react';
import { WaxRatioCalculator } from '@/components/WaxRatioCalculator';
import { BurnTimeCalculator } from '@/components/BurnTimeCalculator';
import { SmokeEstimator } from '@/components/SmokeEstimator';
import { FormulaExporter } from '@/components/FormulaExporter';
import { BatchCalculator } from '@/components/BatchCalculator';

type TabType = 'ratio' | 'burn' | 'smoke' | 'export' | 'batch';

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>('ratio');

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'ratio', label: '蜡料配比', icon: <Droplets size={18} /> },
    { id: 'burn', label: '燃烧时间', icon: <Clock size={18} /> },
    { id: 'smoke', label: '烟气估算', icon: <Wind size={18} /> },
    { id: 'export', label: '配方导出', icon: <Download size={18} /> },
    { id: 'batch', label: '批量计算', icon: <Layers size={18} /> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
      <header className="bg-white/80 backdrop-blur-md shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl shadow-lg">
              <Candle className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                蜡料配比计算器
              </h1>
              <p className="text-sm text-gray-500">专业的蜡烛配方设计与优化工具</p>
            </div>
          </div>
        </div>
      </header>

      <nav className="bg-white/60 backdrop-blur-sm border-b border-amber-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1 py-2 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg'
                    : 'text-gray-600 hover:bg-amber-100/50'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-fadeIn">
          {activeTab === 'ratio' && <WaxRatioCalculator />}
          {activeTab === 'burn' && <BurnTimeCalculator />}
          {activeTab === 'smoke' && <SmokeEstimator />}
          {activeTab === 'export' && <FormulaExporter />}
          {activeTab === 'batch' && <BatchCalculator />}
        </div>
      </main>

      <footer className="mt-auto py-6 text-center text-gray-500 text-sm">
        <p>蜡料配比计算器 · 专业蜡烛配方设计工具</p>
      </footer>
    </div>
  );
}
