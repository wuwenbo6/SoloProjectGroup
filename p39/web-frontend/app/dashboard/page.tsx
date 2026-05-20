'use client';

import { useState } from "react";
import { Plus, FileText, Calendar, DollarSign, Send, X } from "lucide-react";
import Navbar from "../../components/Navbar";

const craftTypes = [
  "陶瓷制作", "木雕工艺", "刺绣", "漆器制作", "竹编", "剪纸", "皮影", "景泰蓝"
];

export default function Dashboard() {
  const [showModal, setShowModal] = useState(false);
  const [requirements, setRequirements] = useState([
    {
      id: 1,
      title: "青花瓷茶具套装定制",
      type: "陶瓷制作",
      budget: "3000-5000",
      deadline: "2024-08-15",
      status: "已接单",
      description: "需要定制一套青花瓷茶具，包括茶壶、茶杯、茶盘...",
      createdAt: "2024-05-10",
    }
  ]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      
      <main className="pt-24 pb-12 container mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">定制操作台</h1>
            <p className="text-slate-600 mt-1">管理您的手工艺品定制需求</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            发布新需求
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm">全部需求</p>
                <p className="text-2xl font-bold mt-1">5</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm">进行中</p>
                <p className="text-2xl font-bold mt-1">3</p>
              </div>
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </div>
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm">待支付</p>
                <p className="text-2xl font-bold mt-1">1</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm">已完成</p>
                <p className="text-2xl font-bold mt-1">1</p>
              </div>
              <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                <Send className="w-6 h-6 text-slate-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold mb-6">我的定制需求</h2>
          <div className="space-y-4">
            {requirements.map((req) => (
              <div
                key={req.id}
                className="border border-slate-200 rounded-lg p-4 hover:border-primary-300 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-lg">{req.title}</h3>
                    <p className="text-slate-500 text-sm mt-1">{req.description}</p>
                    <div className="flex gap-4 mt-3">
                      <span className="text-sm text-slate-600 bg-slate-100 px-2 py-1 rounded">
                        {req.type}
                      </span>
                      <span className="text-sm text-slate-600">预算: ¥{req.budget}</span>
                      <span className="text-sm text-slate-600">截止: {req.deadline}</span>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
                    {req.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-xl font-semibold">发布定制需求</h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  需求标题
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="例如：青花瓷茶具套装定制"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  工艺类型
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {craftTypes.map((type) => (
                    <button
                      key={type}
                      className="px-3 py-2 text-sm border border-slate-200 rounded-lg hover:border-primary-500 hover:text-primary-600 transition-colors"
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    预算范围 (元)
                  </label>
                  <input type="text" className="input-field" placeholder="例如：3000-5000" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    期望交付日期
                  </label>
                  <input type="date" className="input-field" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  详细描述
                </label>
                <textarea
                  className="input-field h-32 resize-none"
                  placeholder="请详细描述您的定制需求，包括尺寸、材质、风格、特殊要求等..."
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowModal(false)}
                  className="btn-secondary flex-1"
                >
                  取消
                </button>
                <button className="btn-primary flex-1">发布需求</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
