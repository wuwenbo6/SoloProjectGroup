'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, X, Check, Package, CreditCard, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface Notification {
  id: string;
  type: string;
  title: string;
  content: string;
  relatedId?: number;
  relatedType?: string;
  isRead: boolean;
  createTime: string;
}

const iconMap: Record<string, React.ComponentType<any>> = {
  ORDER_PROGRESS: Package,
  PAYMENT: CreditCard,
  MESSAGE: MessageSquare,
};

const colorMap: Record<string, string> = {
  ORDER_PROGRESS: 'text-blue-500 bg-blue-100',
  PAYMENT: 'text-green-500 bg-green-100',
  MESSAGE: 'text-purple-500 bg-purple-100',
};

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const mockNotifications: Notification[] = [
      {
        id: '1',
        type: 'ORDER_PROGRESS',
        title: '订单进度更新',
        content: '您的订单 ORD20240510001 进度已更新为 80% - 作品烧制完成',
        relatedId: 1,
        relatedType: 'ORDER',
        isRead: false,
        createTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      },
      {
        id: '2',
        type: 'PAYMENT',
        title: '支付成功',
        content: '您的订单 ORD20240415002 支付成功，匠人已开始制作',
        relatedId: 2,
        relatedType: 'ORDER',
        isRead: false,
        createTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: '3',
        type: 'MESSAGE',
        title: '新消息',
        content: '匠人李明给您发送了一条消息',
        relatedId: 20001,
        relatedType: 'ARTISAN',
        isRead: true,
        createTime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      },
    ];

    setNotifications(mockNotifications);
    setUnreadCount(mockNotifications.filter(n => !n.isRead).length);
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, isRead: true } : n))
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }, []);

  const formatTime = (time: string) => {
    return formatDistanceToNow(new Date(time), {
      addSuffix: true,
      locale: zhCN,
    });
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-slate-100 transition-colors"
      >
        <Bell className="w-6 h-6 text-slate-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">通知中心</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                  >
                    全部已读
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-slate-100 rounded-full"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
            </div>

            <div className="max-h-[500px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-12 text-center">
                  <Bell className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">暂无通知</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {notifications.map(notification => {
                    const Icon = iconMap[notification.type] || Bell;
                    const colorClass = colorMap[notification.type] || 'text-slate-500 bg-slate-100';
                    return (
                      <div
                        key={notification.id}
                        className={`p-4 hover:bg-slate-50 transition-colors ${
                          !notification.isRead ? 'bg-blue-50/50' : ''
                        }`}
                      >
                        <div className="flex gap-3">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${colorClass}`}
                          >
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="font-medium text-slate-900 truncate">
                                {notification.title}
                              </h4>
                              {!notification.isRead && (
                                <button
                                  onClick={() => markAsRead(notification.id)}
                                  className="p-1 hover:bg-slate-200 rounded-full flex-shrink-0"
                                >
                                  <Check className="w-4 h-4 text-slate-500" />
                                </button>
                              )}
                            </div>
                            <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                              {notification.content}
                            </p>
                            <p className="text-xs text-slate-400 mt-2">
                              {formatTime(notification.createTime)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
