'use client';

import { useState, useEffect } from 'react';
import { Check, X, ArrowLeftRight, FileText, Clock, DollarSign, Wrench } from 'lucide-react';
import Link from 'next/link';

interface Proposal {
  id: number;
  requirementId: number;
  artisanId: number;
  title: string;
  description: string;
  price: number;
  deliveryDays: number;
  materialDesc: string;
  craftDesc: string;
  status: number;
  createTime: string;
  artisan?: {
    id: number;
    name: string;
    avatar: string;
    rating: number;
  };
}

const mockProposals: Proposal[] = [
  {
    id: 1,
    requirementId: 1001,
    artisanId: 20001,
    title: '青花瓷茶具套装 - 经典款',
    description: '采用传统青花工艺，精选优质高岭土，经过1300度高温烧制而成。包含茶壶、公道杯、品茗杯共6件，适合日常使用和收藏。',
    price: 4500,
    deliveryDays: 30,
    materialDesc: '优质高岭土、天然矿物釉料',
    craftDesc: '传统拉坯、手绘青花、1300度高温烧制',
    status: 1,
    createTime: '2024-05-10T10:30:00',
    artisan: {
      id: 20001,
      name: '李明',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face',
      rating: 4.8,
    },
  },
  {
    id: 2,
    requirementId: 1001,
    artisanId: 20002,
    title: '青花瓷茶具套装 - 精品款',
    description: '大师级纯手工制作，采用独家配方釉料，每件作品都带有独特的艺术风格。包含茶壶、公道杯、品茗杯、茶宠等10件精品套装。',
    price: 8800,
    deliveryDays: 45,
    materialDesc: '特级高岭土、独家配方釉料、贵金属描金',
    craftDesc: '大师手工拉坯、原创手绘、多次烧制、1350度高温',
    status: 1,
    createTime: '2024-05-11T09:20:00',
    artisan: {
      id: 20002,
      name: '王芳',
      avatar: 'https://images.unsplash.com/photo-1438761681035-6521fbbaf13?w=100&h=100&fit=crop&crop=face',
      rating: 4.9,
    },
  },
  {
    id: 3,
    requirementId: 1001,
    artisanId: 20003,
    title: '青花瓷茶具套装 - 经济款',
    description: '性价比之选，采用标准化生产工艺，保证品质的同时降低成本。包含基础茶具4件，适合入门玩家。',
    price: 2800,
    deliveryDays: 20,
    materialDesc: '优质瓷土、标准青花釉料',
    craftDesc: '模具成型、印花工艺、1280度烧制',
    status: 1,
    createTime: '2024-05-09T14:45:00',
    artisan: {
      id: 20003,
      name: '张德',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face',
      rating: 4.5,
    },
  },
];

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<Proposal[]>(mockProposals);
  const [selectedIds, setSelectedIds] = useState<number[]>([1, 2]);
  const [compareMode, setCompareMode] = useState(true);

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(pid => pid !== id);
      }
      if (prev.length >= 3) {
        return prev;
      }
      return [...prev, id];
    });
  };

  const selectedProposals = proposals.filter(p => selectedIds.includes(p.id));

  const getPriceClass = (price: number) => {
    const prices = selectedProposals.map(p => p.price);
    const min = Math.min(...prices);
    if (price === min) return 'text-green-600 font-bold';
    return 'text-slate-700';
  };

  const getDaysClass = (days: number) => {
    const allDays = selectedProposals.map(p => p.deliveryDays);
    const min = Math.min(...allDays);
    if (days === min) return 'text-green-600 font-bold';
    return 'text-slate-700';
  };

  const getRatingClass = (rating: number) => {
    const ratings = selectedProposals.map(p => p.artisan?.rating || 0);
    const max = Math.max(...ratings);
    if (rating === max) return 'text-green-600 font-bold';
    return 'text-amber-500';
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/requirements" className="p-2 hover:bg-slate-100 rounded-full">
                <ArrowLeftRight className="w-5 h-5 text-slate-600" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-slate-900">方案对比</h1>
                <p className="text-sm text-slate-500">
                  定制需求 #REQ1001 - 青花瓷茶具
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-500">
                已选择 {selectedIds.length}/3 个方案
              </span>
              <button
                onClick={() => setCompareMode(!compareMode)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  compareMode
                    ? 'bg-primary-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {compareMode ? '对比视图' : '列表视图'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {compareMode ? (
          <div className="overflow-x-auto">
            <table className="w-full bg-white rounded-xl border border-slate-200">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left p-4 bg-slate-50 rounded-tl-xl w-48">
                    对比项
                  </th>
                  {selectedProposals.map(proposal => (
                    <th
                      key={proposal.id}
                      className="text-left p-4 bg-slate-50 min-w-64"
                    >
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleSelect(proposal.id)}
                          className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${
                            selectedIds.includes(proposal.id)
                              ? 'bg-primary-500 border-primary-500'
                              : 'border-slate-300'
                          }`}
                        >
                          {selectedIds.includes(proposal.id) && (
                            <Check className="w-4 h-4 text-white" />
                          )}
                        </button>
                        <div className="flex items-center gap-2">
                          <img
                            src={proposal.artisan?.avatar}
                            alt={proposal.artisan?.name}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                          <div>
                            <p className="font-medium text-slate-900">
                              {proposal.artisan?.name}
                            </p>
                            <p className={`text-sm ${getRatingClass(proposal.artisan?.rating || 0)}`}>
                              ★ {proposal.artisan?.rating}
                            </p>
                          </div>
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="p-4 bg-slate-50 font-medium text-slate-700">
                    方案名称
                  </td>
                  {selectedProposals.map(proposal => (
                    <td key={proposal.id} className="p-4">
                      <p className="font-medium text-slate-900">{proposal.title}</p>
                    </td>
                  ))}
                </tr>

                <tr>
                  <td className="p-4 bg-slate-50 font-medium text-slate-700">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      报价
                    </div>
                  </td>
                  {selectedProposals.map(proposal => (
                    <td key={proposal.id} className="p-4">
                      <p className={`text-lg ${getPriceClass(proposal.price)}`}>
                        ¥{proposal.price.toLocaleString()}
                      </p>
                    </td>
                  ))}
                </tr>

                <tr>
                  <td className="p-4 bg-slate-50 font-medium text-slate-700">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      交付周期
                    </div>
                  </td>
                  {selectedProposals.map(proposal => (
                    <td key={proposal.id} className="p-4">
                      <p className={getDaysClass(proposal.deliveryDays)}>
                        {proposal.deliveryDays} 天
                      </p>
                    </td>
                  ))}
                </tr>

                <tr>
                  <td className="p-4 bg-slate-50 font-medium text-slate-700">
                    <div className="flex items-center gap-2">
                      <Wrench className="w-4 h-4" />
                      用材说明
                    </div>
                  </td>
                  {selectedProposals.map(proposal => (
                    <td key={proposal.id} className="p-4">
                      <p className="text-slate-600 text-sm">
                        {proposal.materialDesc}
                      </p>
                    </td>
                  ))}
                </tr>

                <tr>
                  <td className="p-4 bg-slate-50 font-medium text-slate-700">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      工艺说明
                    </div>
                  </td>
                  {selectedProposals.map(proposal => (
                    <td key={proposal.id} className="p-4">
                      <p className="text-slate-600 text-sm">
                        {proposal.craftDesc}
                      </p>
                    </td>
                  ))}
                </tr>

                <tr>
                  <td className="p-4 bg-slate-50 font-medium text-slate-700">
                    方案描述
                  </td>
                  {selectedProposals.map(proposal => (
                    <td key={proposal.id} className="p-4">
                      <p className="text-slate-600 text-sm line-clamp-3">
                        {proposal.description}
                      </p>
                    </td>
                  ))}
                </tr>

                <tr>
                  <td className="p-4 bg-slate-50 font-medium text-slate-700 rounded-bl-xl">
                    操作
                  </td>
                  {selectedProposals.map(proposal => (
                    <td key={proposal.id} className="p-4">
                      <button className="w-full py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors">
                        选择此方案
                      </button>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="space-y-4">
            {proposals.map(proposal => (
              <div
                key={proposal.id}
                className={`p-6 bg-white rounded-xl border-2 transition-all cursor-pointer ${
                  selectedIds.includes(proposal.id)
                    ? 'border-primary-500 shadow-lg'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
                onClick={() => toggleSelect(proposal.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center border-2 mt-1 flex-shrink-0 ${
                        selectedIds.includes(proposal.id)
                          ? 'bg-primary-500 border-primary-500'
                          : 'border-slate-300'
                      }`}
                    >
                      {selectedIds.includes(proposal.id) && (
                        <Check className="w-4 h-4 text-white" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <img
                          src={proposal.artisan?.avatar}
                          alt={proposal.artisan?.name}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                        <div>
                          <h3 className="font-semibold text-slate-900">
                            {proposal.title}
                          </h3>
                          <p className="text-sm text-slate-500">
                            {proposal.artisan?.name} · ★ {proposal.artisan?.rating}
                          </p>
                        </div>
                      </div>
                      <p className="text-slate-600 mb-4">{proposal.description}</p>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center p-3 bg-slate-50 rounded-lg">
                          <p className="text-2xl font-bold text-primary-600">
                            ¥{proposal.price.toLocaleString()}
                          </p>
                          <p className="text-sm text-slate-500">报价</p>
                        </div>
                        <div className="text-center p-3 bg-slate-50 rounded-lg">
                          <p className="text-2xl font-bold text-slate-700">
                            {proposal.deliveryDays}天
                          </p>
                          <p className="text-sm text-slate-500">交付周期</p>
                        </div>
                        <div className="text-center p-3 bg-slate-50 rounded-lg">
                          <p className="text-lg font-bold text-amber-500">
                            ★ {proposal.artisan?.rating}
                          </p>
                          <p className="text-sm text-slate-500">匠人评分</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedIds.length > 0 && (
          <div className="mt-8 flex justify-center">
            <div className="inline-flex gap-3">
              <button
                onClick={() => setSelectedIds([])}
                className="px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors"
              >
                清除选择
              </button>
              <button className="px-6 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors">
                确认选择方案 ({selectedIds.length})
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
