import Link from 'next/link'
import Image from 'next/image'

export default function Home() {
  return (
    <main className="min-h-screen">
      <nav className="bg-gradient-to-r from-folk-red to-folk-brown text-white py-4 shadow-lg">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span className="text-folk-gold">🎭</span>
            民俗活动平台
          </h1>
          <div className="flex gap-6">
            <Link href="/" className="hover:text-folk-gold transition">首页</Link>
            <Link href="/activities" className="hover:text-folk-gold transition">活动展示</Link>
            <Link href="/admin" className="hover:text-folk-gold transition">操作台</Link>
          </div>
        </div>
      </nav>

      <section className="relative h-96 bg-gradient-to-r from-folk-red to-folk-brown">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-white">
            <h2 className="text-5xl font-bold mb-4">传承中华文化</h2>
            <p className="text-xl mb-8 text-folk-gold">参与精彩民俗活动，体验传统魅力</p>
            <Link href="/activities" className="bg-folk-gold text-folk-brown px-8 py-3 rounded-full font-bold hover:bg-yellow-400 transition">
              立即参与
            </Link>
          </div>
        </div>
      </section>

      <section className="py-16 container mx-auto px-4">
        <h3 className="text-3xl font-bold text-center text-folk-brown mb-12">热门活动</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { id: 1, title: '春节庙会', date: '2024-02-10', location: '北京地坛', image: 'https://picsum.photos/400/250?random=1' },
            { id: 2, title: '龙舟竞渡', date: '2024-06-10', location: '杭州西湖', image: 'https://picsum.photos/400/250?random=2' },
            { id: 3, title: '中秋赏月', date: '2024-09-17', location: '南京秦淮河', image: 'https://picsum.photos/400/250?random=3' },
          ].map(activity => (
            <div key={activity.id} className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition transform hover:-translate-y-1">
              <div className="relative h-48">
                <Image src={activity.image} alt={activity.title} fill className="object-cover" />
              </div>
              <div className="p-6">
                <h4 className="text-xl font-bold text-folk-brown mb-2">{activity.title}</h4>
                <p className="text-gray-600 mb-2">📅 {activity.date}</p>
                <p className="text-gray-600 mb-4">📍 {activity.location}</p>
                <Link href={`/activities/${activity.id}`} className="inline-block bg-folk-red text-white px-6 py-2 rounded-full hover:bg-red-700 transition">
                  查看详情
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-folk-brown py-16 text-white">
        <div className="container mx-auto px-4 text-center">
          <h3 className="text-3xl font-bold mb-8">平台数据</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <div className="text-4xl font-bold text-folk-gold">1,234</div>
              <div className="text-lg">活动数量</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-folk-gold">56,789</div>
              <div className="text-lg">注册用户</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-folk-gold">89%</div>
              <div className="text-lg">满意度</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-folk-gold">500+</div>
              <div className="text-lg">合作机构</div>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-folk-brown text-white py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-folk-gold">© 2024 民俗活动平台 版权所有</p>
          <p className="text-sm mt-2 opacity-80">传承中华文化，弘扬民族精神</p>
        </div>
      </footer>
    </main>
  )
}
