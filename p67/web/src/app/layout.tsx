import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '民俗活动报名平台',
  description: '传承中华文化，参与民俗活动',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className="folk-pattern min-h-screen">{children}</body>
    </html>
  )
}
