'use client';

import { useState } from "react";
import { Search, Star, MapPin, Award, Filter, MessageCircle } from "lucide-react";
import Navbar from "../../components/Navbar";

const artisans = [
  {
    id: 1,
    name: "李明",
    title: "国家级非遗传承人",
    craft: "陶瓷制作",
    location: "景德镇",
    rating: 4.9,
    orders: 156,
    avatar: "👨‍🎨",
    description: "从事青花瓷制作30年，精通传统工艺，作品多次获国家级奖项",
    tags: ["青花瓷", "釉里红", "仿古瓷"],
  },
  {
    id: 2,
    name: "王芳",
    title: "省级非遗传承人",
    craft: "苏绣",
    location: "苏州",
    rating: 4.8,
    orders: 89,
    avatar: "👩‍🎨",
    description: "苏绣世家第四代传人，擅长双面绣、花鸟人物题材",
    tags: ["双面绣", "花鸟", "人物肖像"],
  },
  {
    id: 3,
    name: "张德",
    title: "工艺美术大师",
    craft: "木雕工艺",
    location: "东阳",
    rating: 4.7,
    orders: 124,
    avatar: "🧑‍🎨",
    description: "东阳木雕传承人，专注传统家具雕刻与佛像制作",
    tags: ["家具雕刻", "佛像", "屏风"],
  },
  {
    id: 4,
    name: "陈静",
    title: "青年匠人",
    craft: "漆器制作",
    location: "扬州",
    rating: 4.9,
    orders: 67,
    avatar: "👩‍🎨",
    description: "扬州漆艺新生代，创新传统工艺与现代设计结合",
    tags: ["脱胎漆器", "漆画", "首饰盒"],
  },
];

const craftTypes = ["全部", "陶瓷制作", "木雕工艺", "刺绣", "漆器制作", "竹编", "剪纸"];

export default function Artisans() {
  const [selectedType, setSelectedType] = useState("全部");
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      
      <main className="pt-24 pb-12 container mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">匠人展示</h1>
          <p className="text-slate-600 mt-1">发现传统手工艺匠人，定制专属作品</p>
        </div>

        <div className="card mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="搜索匠人姓名、工艺类型..."
                className="input-field pl-12"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-slate-500" />
              <div className="flex gap-2 flex-wrap">
                {craftTypes.map((type) => (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedType === type
                        ? "bg-primary-500 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {artisans.map((artisan) => (
            <div key={artisan.id} className="card hover:shadow-md transition-shadow">
              <div className="flex gap-4">
                <div className="text-6xl">{artisan.avatar}</div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-semibold">{artisan.name}</h3>
                      <p className="text-primary-600 text-sm">{artisan.title}</p>
                    </div>
                    <button className="btn-primary text-sm px-4">联系匠人</button>
                  </div>
                  <p className="text-slate-600 mt-2 text-sm">{artisan.description}</p>
                  <div className="flex items-center gap-4 mt-3 text-sm text-slate-500">
                    <span className="flex items-center gap-1">
                      <Award className="w-4 h-4" />
                      {artisan.craft}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {artisan.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-amber-500" />
                      {artisan.rating}
                    </span>
                    <span>已完成 {artisan.orders} 单</span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    {artisan.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
