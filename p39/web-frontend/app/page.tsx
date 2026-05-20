import Link from "next/link";
import { Search, Sparkles, Users, Shield, Clock, MessageSquare } from "lucide-react";
import Navbar from "../components/Navbar";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-white">
      <Navbar />
      
      <main className="pt-20">
        <section className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-5xl font-bold mb-6 text-slate-900">
              定制专属<span className="text-primary-500">传统手工艺品</span>
            </h1>
            <p className="text-xl text-slate-600 mb-8">
              连接匠人匠心，传承非遗文化，让每一件作品都承载故事与温度
            </p>
            <div className="flex gap-4 justify-center">
              <Link href="/dashboard" className="btn-primary text-lg px-8 py-3">
                发布定制需求
              </Link>
              <Link href="/artisans" className="btn-secondary text-lg px-8 py-3">
                探索匠人
              </Link>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-12">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="card text-center">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-primary-500" />
              </div>
              <h3 className="text-xl font-semibold mb-2">发布需求</h3>
              <p className="text-slate-600">描述您的定制需求，包括工艺类型、材质、尺寸等细节</p>
            </div>
            <div className="card text-center">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-primary-500" />
              </div>
              <h3 className="text-xl font-semibold mb-2">匹配匠人</h3>
              <p className="text-slate-600">智能匹配适合的匠人，沟通方案细节与报价</p>
            </div>
            <div className="card text-center">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-primary-500" />
              </div>
              <h3 className="text-xl font-semibold mb-2">收货作品</h3>
              <p className="text-slate-600">全程跟踪制作进度，验收专属定制手工艺品</p>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-12">
          <h2 className="text-3xl font-bold text-center mb-12">平台特色</h2>
          <div className="grid md:grid-cols-4 gap-6">
            <div className="text-center">
              <Shield className="w-12 h-12 text-craft-jade mx-auto mb-3" />
              <h4 className="font-semibold mb-1">匠人认证</h4>
              <p className="text-sm text-slate-500">严格资质审核，保障工艺水准</p>
            </div>
            <div className="text-center">
              <Clock className="w-12 h-12 text-craft-bronze mx-auto mb-3" />
              <h4 className="font-semibold mb-1">进度追踪</h4>
              <p className="text-sm text-slate-500">实时查看制作进度，透明可靠</p>
            </div>
            <div className="text-center">
              <MessageSquare className="w-12 h-12 text-craft-wood mx-auto mb-3" />
              <h4 className="font-semibold mb-1">在线沟通</h4>
              <p className="text-sm text-slate-500">与匠人直接沟通，细节零误差</p>
            </div>
            <div className="text-center">
              <Sparkles className="w-12 h-12 text-primary-500 mx-auto mb-3" />
              <h4 className="font-semibold mb-1">作品保障</h4>
              <p className="text-sm text-slate-500">品质保证，满意后确认交付</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-slate-900 text-white py-12">
        <div className="container mx-auto px-4 text-center">
          <h3 className="text-2xl font-bold mb-4">CraftHub</h3>
          <p className="text-slate-400">传统手工艺品定制平台 · 匠心传承</p>
        </div>
      </footer>
    </div>
  );
}
