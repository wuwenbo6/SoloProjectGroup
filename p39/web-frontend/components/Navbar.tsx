'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutDashboard, Users, ShoppingBag, User } from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();

  const navItems = [
    { href: "/", label: "首页", icon: Home },
    { href: "/dashboard", label: "定制操作台", icon: LayoutDashboard },
    { href: "/artisans", label: "匠人展示", icon: Users },
    { href: "/orders", label: "订单管理", icon: ShoppingBag },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-b border-slate-200 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🎨</span>
            <span className="font-bold text-xl text-primary-600">CraftHub</span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    isActive
                      ? "bg-primary-50 text-primary-600"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-4">
            <button className="btn-secondary flex items-center gap-2">
              <User className="w-4 h-4" />
              <span>登录</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
