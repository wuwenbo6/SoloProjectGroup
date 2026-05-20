'use client';

import { useState, useEffect, useCallback } from "react";
import { Package, Clock, CheckCircle, Truck, MessageSquare, CreditCard, Eye, RefreshCw } from "lucide-react";
import Navbar from "../../components/Navbar";
import { Order } from "../../types";
import { orderApi, paymentApi } from "../../services/api";
import { usePolling } from "../../hooks/usePolling";

const mockOrders: Order[] = [
  {
    id: 1,
    orderNo: "ORD20240510001",
    title: "青花瓷茶具套装定制",
    artisanId: 20001,
    amount: 4500,
    status: 3,
    progress: 60,
    createTime: "2024-05-10T10:30:00",
    estimatedDelivery: "2024-08-15",
  },
  {
    id: 2,
    orderNo: "ORD20240415002",
    title: "苏绣双面绣屏风",
    artisanId: 20002,
    amount: 12800,
    status: 1,
    progress: 0,
    createTime: "2024-04-15T14:20:00",
    estimatedDelivery: "2024-09-30",
  },
  {
    id: 3,
    orderNo: "ORD20240301003",
    title: "东阳木雕佛像摆件",
    artisanId: 20003,
    amount: 6800,
    status: 5,
    progress: 100,
    createTime: "2024-03-01T09:15:00",
    estimatedDelivery: "2024-06-30",
  },
];

const statusMap: Record<number, string> = {
  1: "待支付",
  2: "已支付",
  3: "制作中",
  4: "配送中",
  5: "已完成",
};

const statusConfig: Record<number, { color: string; bg: string; icon: any }> = {
  1: { color: "text-amber-700", bg: "bg-amber-100", icon: CreditCard },
  2: { color: "text-blue-700", bg: "bg-blue-100", icon: Clock },
  3: { color: "text-primary-700", bg: "bg-primary-100", icon: Package },
  4: { color: "text-purple-700", bg: "bg-purple-100", icon: Truck },
  5: { color: "text-green-700", bg: "bg-green-100", icon: CheckCircle },
};

const artisanMap: Record<number, { name: string; craft: string }> = {
  20001: { name: "李明", craft: "陶瓷制作" },
  20002: { name: "王芳", craft: "刺绣" },
  20003: { name: "张德", craft: "木雕工艺" },
};

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>(mockOrders);
  const [selectedOrder, setSelectedOrder] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pollingEnabled, setPollingEnabled] = useState(true);

  const fetchOrders = useCallback(async () => {
    try {
      console.log('正在刷新订单数据...');
      return orders;
    } catch (error) {
      console.error('获取订单失败:', error);
      return orders;
    }
  }, [orders]);

  const handleOrderData = useCallback((data: Order[]) => {
    setOrders(data);
  }, []);

  usePolling(fetchOrders, handleOrderData, {
    interval: 5000,
    enabled: pollingEnabled,
  });

  const manualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchOrders();
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const handlePayment = async (orderId: number) => {
    try {
      await paymentApi.processPayment(orderId, 'ALIPAY');
      setOrders(prev => prev.map(o => 
        o.id === orderId ? { ...o, status: 2 } : o
      ));
      alert('支付成功！');
    } catch (error) {
      console.error('支付失败:', error);
      alert('支付失败，请重试');
    }
  };

  const getStatusText = (status?: number) => statusMap[status || 0] || '未知';
  const getArtisanInfo = (artisanId?: number) => artisanMap[artisanId || 0] || { name: '未知', craft: '未知' };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      
      <main className="pt-24 pb-12 container mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">订单管理</h1>
            <p className="text-slate-600 mt-1">查看和管理您的定制订单</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setPollingEnabled(!pollingEnabled)}
              className={`px-4 py-2 rounded-lg text-sm ${
                pollingEnabled 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {pollingEnabled ? '自动刷新: 开启' : '自动刷新: 关闭'}
            </button>
            <button
              onClick={manualRefresh}
              disabled={isRefreshing}
              className="btn-secondary flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              刷新
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {Object.entries(statusConfig).map(([statusKey, config]) => {
            const status = parseInt(statusKey);
            const Icon = config.icon;
            const count = orders.filter((o) => o.status === status).length;
            return (
              <div key={status} className="card">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 ${config.bg} rounded-lg flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${config.color}`} />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{getStatusText(status)}</p>
                    <p className="text-xl font-bold">{count}</p>
                  </div>
                </div>
              </div>
            );
          })}
          <div className="card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">全部订单</p>
                <p className="text-xl font-bold">{orders.length}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {orders.map((order) => {
            const config = statusConfig[order.status || 0] || statusConfig[1];
            const StatusIcon = config.icon;
            const artisan = getArtisanInfo(order.artisanId);
            return (
              <div key={order.id} className="card">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">{order.title}</h3>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${config.bg} ${config.color} flex items-center gap-1`}>
                        <StatusIcon className="w-4 h-4" />
                        {getStatusText(order.status)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                      <span>订单号: {order.orderNo}</span>
                      <span>匠人: {artisan.name}</span>
                      <span>工艺: {artisan.craft}</span>
                      <span>下单时间: {order.createTime?.split('T')[0]}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary-600">¥{order.amount.toLocaleString()}</p>
                    {order.status !== 5 && (
                      <p className="text-sm text-slate-500">预计交付: {order.estimatedDelivery}</p>
                    )}
                  </div>
                </div>

                {order.status === 3 && (
                  <div className="mb-6">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-600">制作进度</span>
                      <span className="font-medium">{order.progress || 0}%</span>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary-400 to-primary-600 rounded-full transition-all duration-500"
                        style={{ width: `${order.progress || 0}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedOrder(selectedOrder === order.id ? null : order.id)}
                    className="btn-secondary text-sm flex items-center gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    查看详情
                  </button>
                  <button className="btn-secondary text-sm flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    联系匠人
                  </button>
                  {order.status === 1 && (
                    <button 
                      onClick={() => handlePayment(order.id!)}
                      className="btn-primary text-sm flex items-center gap-2"
                    >
                      <CreditCard className="w-4 h-4" />
                      立即支付
                    </button>
                  )}
                </div>

                {selectedOrder === order.id && (
                  <div className="mt-6 pt-6 border-t border-slate-200">
                    <h4 className="font-semibold mb-4">订单进度追踪</h4>
                    <div className="flex flex-wrap items-start gap-2">
                      {getOrderSteps(order.status || 1, order.progress || 0).map((step, index) => (
                        <div key={index} className="flex items-center">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                              step.completed
                                ? "bg-green-500 text-white"
                                : step.active
                                ? "bg-primary-500 text-white"
                                : "bg-slate-200 text-slate-500"
                            }`}
                          >
                            {step.completed ? "✓" : index + 1}
                          </div>
                          <span
                            className={`ml-2 text-sm ${
                              step.active ? "font-medium text-primary-600" : "text-slate-600"
                            }`}
                          >
                            {step.name}
                          </span>
                          {index < getOrderSteps(order.status || 1, order.progress || 0).length - 1 && (
                            <div className="w-8 h-0.5 bg-slate-200 mx-2" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

function getOrderSteps(status: number, progress: number) {
  if (status === 1) {
    return [
      { name: "需求确认", completed: false, active: true },
      { name: "方案设计", completed: false, active: false },
      { name: "支付确认", completed: false, active: false },
      { name: "开始制作", completed: false, active: false },
      { name: "完成交付", completed: false, active: false },
    ];
  }
  
  if (status === 5) {
    return [
      { name: "需求确认", completed: true },
      { name: "方案设计", completed: true },
      { name: "开始制作", completed: true },
      { name: "质量检验", completed: true },
      { name: "完成交付", completed: true },
    ];
  }
  
  const steps = [
    { name: "需求确认", completed: true },
    { name: "方案设计", completed: true },
    { name: "原料准备", completed: progress > 30 },
    { name: "手工制作", completed: progress > 60, active: progress >= 30 && progress < 60 },
    { name: "作品烧制", completed: progress > 80, active: progress >= 60 && progress < 80 },
    { name: "质量检验", completed: progress >= 100, active: progress >= 80 && progress < 100 },
    { name: "物流配送", completed: false },
  ];
  
  return steps;
}
