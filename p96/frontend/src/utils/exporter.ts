import type { Annotation } from '@/types'

const escapeCSV = (text: string): string => {
  if (!text) return ''
  const escaped = text.replace(/"/g, '""')
  if (escaped.includes(',') || escaped.includes('\n') || escaped.includes('"')) {
    return `"${escaped}"`
  }
  return escaped
}

export const exportToCSV = (
  annotations: Annotation[],
  rubbingTitle: string = 'rubbing'
): void => {
  const headers = ['序号', '文字内容', '置信度', 'X坐标', 'Y坐标', '宽度', '高度', '创建时间']
  const rows = annotations.map((ann, index) => [
    index + 1,
    ann.text || '',
    ann.confidence ? `${Math.round(ann.confidence * 100)}%` : '',
    ann.x.toFixed(4),
    ann.y.toFixed(4),
    ann.width.toFixed(4),
    ann.height.toFixed(4),
    ann.createdAt || new Date().toISOString()
  ])

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => escapeCSV(String(cell))).join(','))
    .join('\n')

  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  
  const link = document.createElement('a')
  link.href = url
  link.download = `${rubbingTitle}_释读记录_${new Date().toLocaleDateString('zh-CN')}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export const exportToJSON = (
  annotations: Annotation[],
  rubbingTitle: string = 'rubbing',
  extraData?: Record<string, any>
): void => {
  const data = {
    title: rubbingTitle,
    exportTime: new Date().toISOString(),
    annotationCount: annotations.length,
    annotations: annotations.map(ann => ({
      text: ann.text,
      confidence: ann.confidence,
      position: {
        x: ann.x,
        y: ann.y,
        width: ann.width,
        height: ann.height
      },
      userId: ann.userId,
      createdAt: ann.createdAt
    })),
    ...extraData
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  
  const link = document.createElement('a')
  link.href = url
  link.download = `${rubbingTitle}_释读记录_${new Date().toLocaleDateString('zh-CN')}.json`
  link.click()
  URL.revokeObjectURL(url)
}

export const exportToTXT = (
  annotations: Annotation[],
  rubbingTitle: string = 'rubbing'
): void => {
  const content = [
    `拓片释读记录：${rubbingTitle}`,
    `导出时间：${new Date().toLocaleString('zh-CN')}`,
    `标注数量：${annotations.length}`,
    '',
    '='.repeat(50),
    '',
    ...annotations.map((ann, index) => {
      const lines = [
        `【第 ${index + 1} 条】`,
        `文字：${ann.text || '(未填写)'}`,
        `置信度：${ann.confidence ? Math.round(ann.confidence * 100) + '%' : 'N/A'}`,
        `位置：X=${ann.x.toFixed(4)}, Y=${ann.y.toFixed(4)}, W=${ann.width.toFixed(4)}, H=${ann.height.toFixed(4)}`,
        ''
      ]
      return lines.join('\n')
    })
  ].join('\n')

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  
  const link = document.createElement('a')
  link.href = url
  link.download = `${rubbingTitle}_释读记录_${new Date().toLocaleDateString('zh-CN')}.txt`
  link.click()
  URL.revokeObjectURL(url)
}

export const exportComparison = (
  interpretations: Array<{
    id: number
    title: string
    version: number
    annotations: Annotation[]
  }>,
  diffs: Array<{
    type: string
    oldText: string
    newText: string
    position: { x: number; y: number }
  }>
): void => {
  const content = [
    '拓片释读对比报告',
    `生成时间：${new Date().toLocaleString('zh-CN')}`,
    `参与对比版本：${interpretations.length} 个`,
    `差异数量：${diffs.length} 处`,
    '',
    '='.repeat(60),
    '',
    '【版本信息】',
    ...interpretations.map(interp => 
      `版本 ${interp.version}: ${interp.title} (${interp.annotations.length} 条标注)`
    ),
    '',
    '='.repeat(60),
    '',
    '【差异详情】',
    ...diffs.map((diff, index) => {
      const typeName = diff.type === 'add' ? '新增' : diff.type === 'delete' ? '删除' : '修改'
      return [
        `差异 ${index + 1} [${typeName}]`,
        `位置：X=${diff.position.x.toFixed(4)}, Y=${diff.position.y.toFixed(4)}`,
        diff.type !== 'delete' ? `当前内容：${diff.newText}` : '',
        diff.type !== 'add' ? `原内容：${diff.oldText}` : '',
        ''
      ].filter(Boolean).join('\n')
    })
  ].join('\n')

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  
  const link = document.createElement('a')
  link.href = url
  link.download = `释读对比报告_${new Date().toLocaleDateString('zh-CN')}.txt`
  link.click()
  URL.revokeObjectURL(url)
}

export const exportFormats = [
  { key: 'csv', name: 'CSV (Excel)', icon: 'Document' },
  { key: 'json', name: 'JSON', icon: 'DataAnalysis' },
  { key: 'txt', name: 'TXT 文本', icon: 'Notebook' }
]
