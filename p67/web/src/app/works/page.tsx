'use client'
import { useState, useEffect } from 'react'
import Image from 'next/image'

export default function WorksGalleryPage() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const works = [
    { id: 1, url: 'https://picsum.photos/800/1200?random=101', title: '传统剪纸艺术' },
    { id: 2, url: 'https://picsum.photos/800/1200?random=102', title: '国画山水' },
    { id: 3, url: 'https://picsum.photos/800/1200?random=103', title: '刺绣作品' },
    { id: 4, url: 'https://picsum.photos/800/1200?random=104', title: '陶瓷艺术' },
    { id: 5, url: 'https://picsum.photos/800/1200?random=105', title: '木雕工艺' },
    { id: 6, url: 'https://picsum.photos/800/1200?random=106', title: '民俗年画' },
  ]

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1000)
    return () => clearTimeout(timer)
  }, [])

  const openLightbox = (index: number) => {
    setCurrentIndex(index)
    setSelectedImage(works[index].url)
    document.body.style.overflow = 'hidden'
  }

  const closeLightbox = () => {
    setSelectedImage(null)
    document.body.style.overflow = 'auto'
  }

  const goToPrev = () => {
    const newIndex = currentIndex > 0 ? currentIndex - 1 : works.length - 1
    setCurrentIndex(newIndex)
    setSelectedImage(works[newIndex].url)
  }

  const goToNext = () => {
    const newIndex = currentIndex < works.length - 1 ? currentIndex + 1 : 0
    setCurrentIndex(newIndex)
    setSelectedImage(works[newIndex].url)
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedImage) return
      if (e.key === 'Escape') closeLightbox()
      if (e.key === 'ArrowLeft') goToPrev()
      if (e.key === 'ArrowRight') goToNext()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedImage, currentIndex])

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-gradient-to-r from-red-700 to-red-800 text-white py-4 shadow-lg">
        <div className="container mx-auto px-4">
          <h1 className="text-xl font-bold text-center">🎨 民俗作品画廊</h1>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {works.map((work, index) => (
            <div
              key={work.id}
              onClick={() => openLightbox(index)}
              className="group relative rounded-xl overflow-hidden shadow-lg cursor-pointer transform hover:scale-105 transition-all duration-300"
            >
              <div className="aspect-[3/4] relative">
                <Image
                  src={work.url}
                  alt={work.title}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                  priority={index < 3}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="absolute bottom-4 left-4 text-white">
                    <h3 className="font-bold text-lg">{work.title}</h3>
                    <p className="text-sm text-white/80">点击查看大图</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center"
          onClick={closeLightbox}
        >
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 text-white text-4xl hover:text-gray-300 transition-colors z-10"
          >
            ×
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); goToPrev() }}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white text-6xl hover:text-gray-300 transition-colors z-10"
          >
            ‹
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); goToNext() }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-6xl hover:text-gray-300 transition-colors z-10"
          >
            ›
          </button>
          <div
            className="relative w-full h-full max-w-4xl max-h-[90vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={selectedImage}
              alt={works[currentIndex].title}
              fill
              className="object-contain"
              quality={100}
            />
          </div>
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white text-center">
            <h3 className="text-xl font-bold">{works[currentIndex].title}</h3>
            <p className="text-white/60 mt-1">{currentIndex + 1} / {works.length}</p>
            <p className="text-white/50 text-sm mt-2">使用 ← → 键切换，ESC 关闭</p>
          </div>
        </div>
      )}
    </div>
  )
}
