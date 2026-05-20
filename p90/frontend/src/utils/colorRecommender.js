const TRADITIONAL_PALETTES = [
  {
    name: '关羽红脸',
    description: '忠义、勇猛',
    colors: ['#C41E3A', '#1E1E1E', '#FFD700', '#228B22', '#FFFFFF'],
    tags: ['忠义', '关羽', '经典']
  },
  {
    name: '曹操白脸',
    description: '奸诈、多疑',
    colors: ['#FFFFFF', '#1E1E1E', '#C0C0C0', '#4A4A4A', '#FFD700'],
    tags: ['奸诈', '曹操', '白脸']
  },
  {
    name: '包拯黑脸',
    description: '正直、无私',
    colors: ['#1E1E1E', '#C41E3A', '#FFFFFF', '#FFD700', '#228B22'],
    tags: ['正直', '包拯', '黑脸']
  },
  {
    name: '典韦黄脸',
    description: '勇猛、暴躁',
    colors: ['#FFD700', '#1E1E1E', '#C41E3A', '#228B22', '#FFFFFF'],
    tags: ['勇猛', '典韦', '黄脸']
  },
  {
    name: '窦尔敦蓝脸',
    description: '刚强、骁勇',
    colors: ['#1E90FF', '#FFD700', '#C41E3A', '#1E1E1E', '#FFFFFF'],
    tags: ['刚强', '窦尔敦', '蓝脸']
  },
  {
    name: '程咬金绿脸',
    description: '莽撞、草莽',
    colors: ['#228B22', '#FFD700', '#C41E3A', '#1E1E1E', '#FFFFFF'],
    tags: ['莽撞', '程咬金', '绿脸']
  },
  {
    name: '二郎神金脸',
    description: '神勇、威严',
    colors: ['#FFD700', '#C41E3A', '#1E1E1E', '#4169E1', '#FFFFFF'],
    tags: ['神勇', '二郎神', '金脸']
  },
  {
    name: '哪吒紫脸',
    description: '刚烈、威严',
    colors: ['#800080', '#FFD700', '#C41E3A', '#1E1E1E', '#FFFFFF'],
    tags: ['刚烈', '哪吒', '紫脸']
  }
]

const COLOR_HARMONY_RULES = {
  complementary: (color) => {
    const hsl = hexToHSL(color)
    hsl.h = (hsl.h + 180) % 360
    return hslToHex(hsl)
  },
  analogous: (color) => {
    const hsl = hexToHSL(color)
    return [
      hslToHex({ h: (hsl.h - 30 + 360) % 360, s: hsl.s, l: hsl.l }),
      hslToHex({ h: (hsl.h + 30) % 360, s: hsl.s, l: hsl.l })
    ]
  },
  triadic: (color) => {
    const hsl = hexToHSL(color)
    return [
      hslToHex({ h: (hsl.h + 120) % 360, s: hsl.s, l: hsl.l }),
      hslToHex({ h: (hsl.h + 240) % 360, s: hsl.s, l: hsl.l })
    ]
  }
}

function hexToHSL(hex) {
  let r = parseInt(hex.slice(1, 3), 16) / 255
  let g = parseInt(hex.slice(3, 5), 16) / 255
  let b = parseInt(hex.slice(5, 7), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h, s, l = (max + min) / 2

  if (max === min) {
    h = s = 0
  } else {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) }
}

function hslToHex({ h, s, l }) {
  s /= 100
  l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = n => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase()
}

function getColorDistance(color1, color2) {
  const r1 = parseInt(color1.slice(1, 3), 16)
  const g1 = parseInt(color1.slice(3, 5), 16)
  const b1 = parseInt(color1.slice(5, 7), 16)
  const r2 = parseInt(color2.slice(1, 3), 16)
  const g2 = parseInt(color2.slice(3, 5), 16)
  const b2 = parseInt(color2.slice(5, 7), 16)
  
  return Math.sqrt(Math.pow(r1 - r2, 2) + Math.pow(g1 - g2, 2) + Math.pow(b1 - b2, 2))
}

export function getRecommendedPalettes(selectedColor = null, tag = null) {
  let palettes = [...TRADITIONAL_PALETTES]
  
  if (tag) {
    palettes = palettes.filter(p => p.tags.some(t => t.includes(tag) || tag.includes(t)))
  }
  
  if (selectedColor) {
    palettes = palettes.map(palette => ({
      ...palette,
      similarity: Math.min(...palette.colors.map(c => getColorDistance(c, selectedColor)))
    })).sort((a, b) => a.similarity - b.similarity)
  }
  
  return palettes
}

export function getHarmonyColors(baseColor) {
  return {
    complementary: COLOR_HARMONY_RULES.complementary(baseColor),
    analogous: COLOR_HARMONY_RULES.analogous(baseColor),
    triadic: COLOR_HARMONY_RULES.triadic(baseColor)
  }
}

export function generateGradient(colors, direction = 'horizontal') {
  const angle = direction === 'horizontal' ? '90deg' : '180deg'
  return `linear-gradient(${angle}, ${colors.join(', ')})`
}

export function getPaletteByName(name) {
  return TRADITIONAL_PALETTES.find(p => p.name === name)
}

export default {
  getRecommendedPalettes,
  getHarmonyColors,
  generateGradient,
  getPaletteByName
}
