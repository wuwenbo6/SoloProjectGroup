const COLOR_PALETTES = {
  sheng: {
    name: '生角色系',
    description: '典雅端庄，以淡雅色调为主',
    palettes: [
      { name: '儒雅小生', colors: ['#E8D4B8', '#C4A574', '#8B6914', '#4A3728', '#F5E6D3'] },
      { name: '威武老生', colors: ['#8B4513', '#CD853F', '#DAA520', '#2F1810', '#F4A460'] },
      { name: '清秀武生', colors: ['#4682B4', '#1E90FF', '#0066CC', '#87CEEB', '#B0C4DE'] }
    ]
  },
  dan: {
    name: '旦角色系',
    description: '柔美婉约，以粉嫩精致色调为主',
    palettes: [
      { name: '闺阁青衣', colors: ['#87CEEB', '#B0E0E6', '#4682B4', '#E6E6FA', '#98D8C8'] },
      { name: '娇媚花旦', colors: ['#FFB6C1', '#FF69B4', '#DB7093', '#FFF0F5', '#FFE4E1'] },
      { name: '华贵旦角', colors: ['#DAA520', '#FFD700', '#B8860B', '#FFF8DC', '#F0E68C'] }
    ]
  },
  jing: {
    name: '净角色系',
    description: '浓墨重彩，对比强烈，彰显性格',
    palettes: [
      { name: '忠义红脸', colors: ['#DC143C', '#8B0000', '#FF6347', '#1A1A1A', '#F5F5F5'] },
      { name: '刚直黑脸', colors: ['#1A1A1A', '#2F2F2F', '#F5F5F5', '#B8860B', '#8B4513'] },
      { name: '勇猛紫脸', colors: ['#800080', '#9932CC', '#DDA0DD', '#FFD700', '#1A1A1A'] },
      { name: '奸诈白脸', colors: ['#F5F5F5', '#FFFFFF', '#1A1A1A', '#2F4F4F', '#C0C0C0'] },
      { name: '神异金脸', colors: ['#FFD700', '#DAA520', '#B8860B', '#1A1A1A', '#CD853F'] }
    ]
  },
  mo: {
    name: '末角色系',
    description: '沉稳老练，以深色调为主',
    palettes: [
      { name: '沧桑老者', colors: ['#696969', '#808080', '#A9A9A9', '#2F4F4F', '#D3D3D3'] },
      { name: '忠厚长者', colors: ['#8B4513', '#A0522D', '#CD853F', '#DEB887', '#F5DEB3'] }
    ]
  },
  chou: {
    name: '丑角色系',
    description: '诙谐幽默，色彩夸张对比',
    palettes: [
      { name: '滑稽小丑', colors: ['#FFFFFF', '#FF6347', '#1A1A1A', '#FFD700', '#32CD32'] },
      { name: '武丑俊扮', colors: ['#FF4500', '#FFD700', '#1E90FF', '#32CD32', '#1A1A1A'] }
    ]
  }
};

const COLOR_THEORY = {
  complementary: {
    name: '互补色',
    description: '色轮上相对的颜色，对比强烈，视觉冲击力大'
  },
  analogous: {
    name: '邻近色',
    description: '色轮上相邻的颜色，和谐统一，自然协调'
  },
  triadic: {
    name: '三角色',
    description: '色轮上等距的三种颜色，平衡而富有活力'
  },
  splitComplementary: {
    name: '分裂互补',
    description: '互补色变体，对比柔和，更易搭配'
  },
  monochromatic: {
    name: '单色渐变',
    description: '同一色相的不同明度变化，简洁高雅'
  }
};

function hexToHsl(hex) {
  let r = parseInt(hex.slice(1, 3), 16) / 255;
  let g = parseInt(hex.slice(3, 5), 16) / 255;
  let b = parseInt(hex.slice(5, 7), 16) / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToHex(h, s, l) {
  h /= 360;
  s /= 100;
  l /= 100;
  
  let r, g, b;
  
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  
  const toHex = x => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function getComplementary(color) {
  const hsl = hexToHsl(color);
  return hslToHex((hsl.h + 180) % 360, hsl.s, hsl.l);
}

function getAnalogous(color, count = 2) {
  const hsl = hexToHsl(color);
  const colors = [];
  const angle = 30;
  for (let i = -Math.floor(count/2); i <= Math.floor(count/2); i++) {
    if (i !== 0) {
      colors.push(hslToHex((hsl.h + i * angle + 360) % 360, hsl.s, hsl.l));
    }
  }
  return colors;
}

function getTriadic(color) {
  const hsl = hexToHsl(color);
  return [
    hslToHex((hsl.h + 120) % 360, hsl.s, hsl.l),
    hslToHex((hsl.h + 240) % 360, hsl.s, hsl.l)
  ];
}

function getSplitComplementary(color) {
  const hsl = hexToHsl(color);
  return [
    hslToHex((hsl.h + 150) % 360, hsl.s, hsl.l),
    hslToHex((hsl.h + 210) % 360, hsl.s, hsl.l)
  ];
}

function getMonochromatic(color, count = 4) {
  const hsl = hexToHsl(color);
  const colors = [];
  const step = 80 / (count + 1);
  for (let i = 1; i <= count; i++) {
    const newL = Math.max(10, Math.min(90, hsl.l - 40 + i * step));
    colors.push(hslToHex(hsl.h, hsl.s, newL));
  }
  return colors;
}

function generateRecommendations(baseColors, category = 'jing') {
  if (!baseColors || baseColors.length === 0) {
    const categoryData = COLOR_PALETTES[category] || COLOR_PALETTES.jing;
    return {
      type: 'preset',
      category: categoryData.name,
      palettes: categoryData.palettes
    };
  }
  
  const primaryColor = baseColors[0].hex || baseColors[0];
  const hsl = hexToHsl(primaryColor);
  
  const recommendations = [];
  
  recommendations.push({
    name: '互补色搭配',
    theory: 'complementary',
    description: COLOR_THEORY.complementary.description,
    colors: [primaryColor, getComplementary(primaryColor)],
    suitability: calculateSuitability(hsl, category)
  });
  
  recommendations.push({
    name: '邻近色搭配',
    theory: 'analogous',
    description: COLOR_THEORY.analogous.description,
    colors: [primaryColor, ...getAnalogous(primaryColor, 2)],
    suitability: calculateSuitability(hsl, category)
  });
  
  recommendations.push({
    name: '三角色搭配',
    theory: 'triadic',
    description: COLOR_THEORY.triadic.description,
    colors: [primaryColor, ...getTriadic(primaryColor)],
    suitability: calculateSuitability(hsl, category)
  });
  
  recommendations.push({
    name: '分裂互补搭配',
    theory: 'splitComplementary',
    description: COLOR_THEORY.splitComplementary.description,
    colors: [primaryColor, ...getSplitComplementary(primaryColor)],
    suitability: calculateSuitability(hsl, category)
  });
  
  recommendations.push({
    name: '单色渐变搭配',
    theory: 'monochromatic',
    description: COLOR_THEORY.monochromatic.description,
    colors: [primaryColor, ...getMonochromatic(primaryColor, 4)],
    suitability: calculateSuitability(hsl, category) * 0.9
  });
  
  recommendations.sort((a, b) => b.suitability - a.suitability);
  
  const categoryData = COLOR_PALETTES[category] || COLOR_PALETTES.jing;
  
  return {
    type: 'generated',
    category: categoryData.name,
    recommendations: recommendations.slice(0, 4),
    presetPalettes: categoryData.palettes,
    baseColor: primaryColor,
    colorAnalysis: analyzeColorProperties(primaryColor)
  };
}

function calculateSuitability(hsl, category) {
  let score = 0.5;
  
  switch(category) {
    case 'jing':
      if (hsl.s > 60) score += 0.3;
      if (hsl.h < 30 || hsl.h > 330) score += 0.2;
      if (hsl.h >= 200 && hsl.h <= 280) score += 0.15;
      break;
    case 'dan':
      if (hsl.s < 70) score += 0.2;
      if (hsl.l > 50) score += 0.2;
      if ((hsl.h >= 330 || hsl.h <= 30) || (hsl.h >= 180 && hsl.h <= 260)) score += 0.15;
      break;
    case 'chou':
      if (hsl.s > 70) score += 0.25;
      score += 0.25;
      break;
    case 'sheng':
      if (hsl.s < 60) score += 0.2;
      if (hsl.h >= 30 && hsl.h <= 60) score += 0.2;
      break;
    case 'mo':
      if (hsl.s < 40) score += 0.3;
      if (hsl.l < 50) score += 0.2;
      break;
  }
  
  return Math.min(score, 1);
}

function analyzeColorProperties(hex) {
  const hsl = hexToHsl(hex);
  
  let warmCold = hsl.h < 30 || hsl.h > 330 ? 'warm' :
                  hsl.h >= 90 && hsl.h <= 270 ? 'cold' : 'neutral';
  
  let intensity = hsl.s > 70 ? 'high' : hsl.s > 40 ? 'medium' : 'low';
  
  let personality = [];
  
  if (hsl.h < 30 || hsl.h > 330) {
    personality.push('热情', '忠义', '勇敢');
  } else if (hsl.h >= 100 && hsl.h <= 140) {
    personality.push('鲁莽', '暴躁', '勇猛');
  } else if (hsl.h >= 200 && hsl.h <= 280) {
    personality.push('刚直', '果断', '勇猛');
  } else if (hsl.h >= 40 && hsl.h <= 80) {
    personality.push('神异', '威猛', '金面');
  } else if (hsl.s < 20 && hsl.l > 80) {
    personality.push('奸诈', '多疑', '白面');
  }
  
  if (hsl.s > 60) personality.push('性格鲜明');
  if (hsl.l < 30) personality.push('深沉');
  if (hsl.l > 70) personality.push('明快');
  
  return {
    hsl,
    warmCold,
    intensity,
    personality: [...new Set(personality)],
    suggestedCategories: suggestCategories(hsl)
  };
}

function suggestCategories(hsl) {
  const suggestions = [];
  
  if ((hsl.h < 30 || hsl.h > 330) && hsl.s > 50) {
    suggestions.push({ category: 'jing', confidence: 0.9, reason: '红色系适合净角红脸' });
  }
  if (hsl.s < 50 && hsl.l > 50) {
    suggestions.push({ category: 'dan', confidence: 0.75, reason: '柔和色调适合旦角' });
  }
  if (hsl.l < 30 || (hsl.s < 30 && hsl.l < 50)) {
    suggestions.push({ category: 'jing', confidence: 0.7, reason: '深色适合净角黑脸' });
  }
  if (hsl.s > 70) {
    suggestions.push({ category: 'chou', confidence: 0.65, reason: '高饱和度适合丑角夸张表现' });
  }
  
  return suggestions.sort((a, b) => b.confidence - a.confidence);
}

function getUsageGuidance(colors, category) {
  const guidance = {
    faceBase: '',
    outline: '',
    eyebrow: '',
    eyes: '',
    mouth: '',
    decorative: ''
  };
  
  const sortedByLuminance = [...colors].sort((a, b) => {
    const hslA = hexToHsl(a);
    const hslB = hexToHsl(b);
    return hslB.l - hslA.l;
  });
  
  switch(category) {
    case 'jing':
      guidance.faceBase = `${sortedByLuminance[0]} - 面部主色，大面积涂抹`;
      guidance.outline = `${sortedByLuminance[sortedByLuminance.length - 1]} - 勾勒轮廓，增强立体感`;
      guidance.eyebrow = '黑色或深色，强调眉形变化';
      guidance.eyes = '凤眼或豹眼造型，眼神要有力';
      guidance.mouth = '嘴部线条要夸张，显示性格';
      guidance.decorative = `${sortedByLuminance[1] || '#FFD700'} - 装饰纹样，增加华丽感`;
      break;
    case 'dan':
      guidance.faceBase = `${sortedByLuminance[0] || '#FFE4E1'} - 粉嫩底色，薄涂晕染`;
      guidance.outline = `${sortedByLuminance[sortedByLuminance.length - 1] || '#8B4513'} - 细眉淡描`;
      guidance.eyebrow = '柳叶眉，纤细柔美';
      guidance.eyes = '丹凤眼，眼神含情';
      guidance.mouth = '樱桃小口，点染精致';
      guidance.decorative = `${sortedByLuminance[1] || '#FFB6C1'} - 花钿装饰，点缀额头`;
      break;
    case 'sheng':
      guidance.faceBase = `${sortedByLuminance[0] || '#F5DEB3'} - 自然肤色，略施粉黛`;
      guidance.outline = '淡色勾勒，保持清秀';
      guidance.eyebrow = '剑眉或卧蚕眉，英气逼人';
      guidance.eyes = '俊目，神采奕奕';
      guidance.mouth = '唇形端正，颜色适中';
      guidance.decorative = '简洁为主，突显儒雅气质';
      break;
    case 'chou':
      guidance.faceBase = '白色鼻梁方块，周围正常肤色';
      guidance.outline = '夸张的线条变形';
      guidance.eyebrow = '八字眉或滑稽眉形';
      guidance.eyes = '鼠眼或三角眼造型';
      guidance.mouth = '歪嘴或其他夸张造型';
      guidance.decorative = '夸张的纹样，突出喜剧效果';
      break;
  }
  
  return guidance;
}

function getSimilarPatternColors(patternColors, allColors, limit = 5) {
  const results = [];
  
  for (const colorSet of allColors) {
    let similarity = 0;
    for (const pColor of patternColors) {
      const pHex = pColor.hex || pColor;
      const pHsl = hexToHsl(pHex);
      
      for (const cColor of colorSet) {
        const cHex = cColor.hex || cColor;
        const cHsl = hexToHsl(cHex);
        
        const hDiff = Math.abs(pHsl.h - cHsl.h);
        const hSimilarity = 1 - Math.min(hDiff, 360 - hDiff) / 180;
        const sSimilarity = 1 - Math.abs(pHsl.s - cHsl.s) / 100;
        const lSimilarity = 1 - Math.abs(pHsl.l - cHsl.l) / 100;
        
        const colorSim = (hSimilarity * 0.5 + sSimilarity * 0.3 + lSimilarity * 0.2);
        similarity = Math.max(similarity, colorSim);
      }
    }
    
    results.push({
      colors: colorSet,
      similarity
    });
  }
  
  return results
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

module.exports = {
  generateRecommendations,
  getComplementary,
  getAnalogous,
  getTriadic,
  getSplitComplementary,
  getMonochromatic,
  hexToHsl,
  hslToHex,
  analyzeColorProperties,
  getUsageGuidance,
  getSimilarPatternColors,
  COLOR_PALETTES,
  COLOR_THEORY
};
