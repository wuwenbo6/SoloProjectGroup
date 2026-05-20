const Router = require('koa-router')
const { Op } = require('sequelize')
const { OperationLog } = require('../models')
const logger = require('../utils/logger')

const router = new Router({ prefix: '/api/dictionary' })

const characterDatabase = {
  '碑': { pinyin: 'bēi', radical: '石', strokes: 13, meaning: '刻上文字纪念事业、功勋或作为标记的石头', variants: ['埤', '悲'], usage: ['碑刻', '碑文', '纪念碑'], category: '常用' },
  '铭': { pinyin: 'míng', radical: '钅', strokes: 11, meaning: '铸、刻或写在器物上记述生平、事迹或警诫自己的文字', variants: ['名', '鸣'], usage: ['铭文', '铭刻', '墓志铭'], category: '常用' },
  '篆': { pinyin: 'zhuàn', radical: '竹', strokes: 15, meaning: '汉字的一种书体，大篆、小篆的统称', variants: ['瑑'], usage: ['篆书', '篆刻', '小篆'], category: '书体' },
  '隶': { pinyin: 'lì', radical: '隶', strokes: 8, meaning: '隶书，汉字的一种字体，由篆书简化演变而成', variants: ['隷'], usage: ['隶书', '汉隶', '古隶'], category: '书体' },
  '拓': { pinyin: 'tà', radical: '扌', strokes: 8, meaning: '把碑刻、铜器等文物的形状和上面的文字、图像印下来', variants: ['搨'], usage: ['拓片', '拓本', '捶拓'], category: '技术' },
  '碣': { pinyin: 'jié', radical: '石', strokes: 14, meaning: '圆顶的石碑', variants: ['楬'], usage: ['碑碣', '石碣'], category: '器物' },
  '墓志': { pinyin: 'mù zhì', radical: '土', strokes: 11, meaning: '放在墓里刻有死者生平事迹的石刻', variants: [], usage: ['墓志铭', '墓志文'], category: '器物' },
  '盖': { pinyin: 'gài', radical: '皿', strokes: 11, meaning: '器物上部有遮蔽作用的东西，也指碑盖', variants: ['蓋'], usage: ['碑盖', '盖印'], category: '器物' },
  '阙': { pinyin: 'què', radical: '门', strokes: 13, meaning: '古代宫殿、祠庙、陵墓前两边高台上的楼观', variants: ['阙'], usage: ['宫阙', '墓阙', '石阙'], category: '建筑' },
  '龛': { pinyin: 'kān', radical: '龙', strokes: 11, meaning: '供奉佛像、神位等的小阁子', variants: ['龕'], usage: ['佛龛', '石龛'], category: '建筑' },
  '祀': { pinyin: 'sì', radical: '礻', strokes: 7, meaning: '祭祀', variants: ['巳'], usage: ['祭祀', '祀典'], category: '礼制' },
  '祠': { pinyin: 'cí', radical: '礻', strokes: 9, meaning: '祠堂，供奉祖宗、鬼神或有功德的人的房屋', variants: [], usage: ['祠堂', '先贤祠'], category: '建筑' },
  '鼎': { pinyin: 'dǐng', radical: '鼎', strokes: 12, meaning: '古代烹煮用的器物，一般是三足两耳，也指重要的礼器', variants: [], usage: ['青铜鼎', '毛公鼎', '鼎文'], category: '礼器' },
  '钟': { pinyin: 'zhōng', radical: '钅', strokes: 9, meaning: '古代乐器，也指钟鼎文', variants: ['鐘'], usage: ['编钟', '钟鼎文'], category: '礼器' },
  '尊': { pinyin: 'zūn', radical: '寸', strokes: 12, meaning: '古代酒器，后作樽', variants: ['樽'], usage: ['四羊方尊', '尊彝'], category: '礼器' },
  '簋': { pinyin: 'guǐ', radical: '竹', strokes: 17, meaning: '古代盛食物的器具', variants: [], usage: ['青铜簋', '利簋'], category: '礼器' },
  '爵': { pinyin: 'jué', radical: '爪', strokes: 17, meaning: '古代饮酒的器皿，有三条腿', variants: [], usage: ['青铜爵', '爵杯'], category: '礼器' },
  '斝': { pinyin: 'jiǎ', radical: '斗', strokes: 12, meaning: '古代温酒的铜制器具，形状像爵，有三足，两柱', variants: [], usage: ['铜斝', '青铜斝'], category: '礼器' },
  '戈': { pinyin: 'gē', radical: '戈', strokes: 4, meaning: '古代的一种兵器，横刃，用青铜或铁制成', variants: [], usage: ['青铜戈', '戈兵'], category: '兵器' },
  '剑': { pinyin: 'jiàn', radical: '刂', strokes: 9, meaning: '古代兵器，长条形，一端尖，两边有刃', variants: ['劍'], usage: ['青铜剑', '宝剑'], category: '兵器' },
  '玺': { pinyin: 'xǐ', radical: '玉', strokes: 10, meaning: '印，秦以后专指帝王的印', variants: ['鉨', '鈢'], usage: ['玉玺', '印玺'], category: '玺印' },
  '印': { pinyin: 'yìn', radical: '卩', strokes: 5, meaning: '印章，印信', variants: [], usage: ['印章', '铜印', '印文'], category: '玺印' },
  '瓦': { pinyin: 'wǎ', radical: '瓦', strokes: 4, meaning: '陶瓦，也指瓦当', variants: [], usage: ['瓦当', '板瓦'], category: '建筑' },
  '当': { pinyin: 'dāng', radical: '彐', strokes: 6, meaning: '瓦当，古代屋檐头筒瓦的前端', variants: ['當'], usage: ['瓦当'], category: '建筑' },
  '砖': { pinyin: 'zhuān', radical: '石', strokes: 9, meaning: '用土坯烧制而成的建筑材料，也指画像砖', variants: ['磚'], usage: ['画像砖', '古砖'], category: '建筑' },
  '简': { pinyin: 'jiǎn', radical: '竹', strokes: 13, meaning: '古代用来写字的竹片', variants: ['簡'], usage: ['竹简', '简牍'], category: '文书' },
  '牍': { pinyin: 'dú', radical: '片', strokes: 12, meaning: '古代写字用的木片', variants: [], usage: ['木牍', '简牍'], category: '文书' },
  '帛': { pinyin: 'bó', radical: '巾', strokes: 8, meaning: '丝织物的总称，也指帛书', variants: [], usage: ['帛书', '绢帛'], category: '文书' },
  '契': { pinyin: 'qì', radical: '大', strokes: 9, meaning: '契约，也指甲骨文的契刻', variants: ['栔'], usage: ['契刻', '甲骨契文'], category: '文字' },
  '卜': { pinyin: 'bǔ', radical: '卜', strokes: 2, meaning: '占卜，古人用火灼龟甲，根据裂纹推测吉凶', variants: [], usage: ['占卜', '卜辞', '甲骨卜辞'], category: '礼制' },
  '贞': { pinyin: 'zhēn', radical: '贝', strokes: 6, meaning: '占卜，问卦', variants: ['貞'], usage: ['贞人', '贞问'], category: '礼制' },
  '甲骨': { pinyin: 'jiǎ gǔ', radical: '丨', strokes: 5, meaning: '龟甲和兽骨，商代用于占卜', variants: [], usage: ['甲骨文', '甲骨卜辞'], category: '文字' },
  '金文': { pinyin: 'jīn wén', radical: '金', strokes: 8, meaning: '古代铜器上的文字，也叫钟鼎文', variants: [], usage: ['殷周金文', '青铜器铭文'], category: '文字' },
  '籀': { pinyin: 'zhòu', radical: '竹', strokes: 19, meaning: '籀文，古代一种字体，即大篆', variants: [], usage: ['籀文', '大篆'], category: '书体' },
  '斯': { pinyin: 'sī', radical: '斤', strokes: 12, meaning: '小篆创始人李斯，也作指示代词', variants: [], usage: ['李斯小篆'], category: '书体' },
  '邈': { pinyin: 'miǎo', radical: '辶', strokes: 17, meaning: '程邈，隶书的整理者', variants: [], usage: ['程邈作隶'], category: '书体' },
  '邕': { pinyin: 'yōng', radical: '邑', strokes: 10, meaning: '蔡邕，东汉书法家，创飞白书', variants: [], usage: ['蔡邕', '飞白体'], category: '书家' },
  '羲': { pinyin: 'xī', radical: '羊', strokes: 16, meaning: '王羲之，东晋书法家，书圣', variants: [], usage: ['王羲之', '王羲之行书'], category: '书家' },
  '献': { pinyin: 'xiàn', radical: '犬', strokes: 13, meaning: '王献之，东晋书法家，王羲之之子', variants: ['獻'], usage: ['王献之', '二王'], category: '书家' }
}

router.get('/search', async (ctx) => {
  const { keyword, radical, category, page = 1, pageSize = 20 } = ctx.query

  try {
    let results = Object.entries(characterDatabase).map(([char, data]) => ({
      character: char,
      ...data
    }))

    if (keyword) {
      const kw = keyword.toLowerCase()
      results = results.filter(item =>
        item.character.includes(kw) ||
        item.pinyin.toLowerCase().includes(kw) ||
        item.meaning.includes(kw) ||
        item.usage.some(u => u.includes(kw))
      )
    }

    if (radical) {
      results = results.filter(item => item.radical === radical)
    }

    if (category) {
      results = results.filter(item => item.category === category)
    }

    const total = results.length
    const startIndex = (page - 1) * pageSize
    const paginatedResults = results.slice(startIndex, startIndex + parseInt(pageSize))

    ctx.body = {
      results: paginatedResults,
      total,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    }
  } catch (err) {
    logger.error('查询字典失败:', err)
    ctx.status = 500
    ctx.body = { error: '查询失败: ' + err.message }
  }
})

router.get('/character/:char', async (ctx) => {
  const { char } = ctx.params

  try {
    const data = characterDatabase[char]
    if (!data) {
      ctx.status = 404
      ctx.body = { error: '未找到该字的释义' }
      return
    }

    const relatedCharacters = Object.entries(characterDatabase)
      .filter(([c, d]) => d.radical === data.radical && c !== char)
      .slice(0, 5)
      .map(([c, d]) => ({ character: c, pinyin: d.pinyin, meaning: d.meaning }))

    ctx.body = {
      character: char,
      ...data,
      relatedCharacters
    }

    await OperationLog.create({
      userId: ctx.state.user.id,
      action: 'lookup_character',
      module: 'dictionary',
      description: `查询金石文字: ${char}`
    })
  } catch (err) {
    logger.error('查询字符失败:', err)
    ctx.status = 500
    ctx.body = { error: '查询失败: ' + err.message }
  }
})

router.get('/radicals', async (ctx) => {
  try {
    const radicals = [...new Set(Object.values(characterDatabase).map(d => d.radical))]
    ctx.body = { radicals }
  } catch (err) {
    ctx.status = 500
    ctx.body = { error: '查询失败' }
  }
})

router.get('/categories', async (ctx) => {
  try {
    const categories = [...new Set(Object.values(characterDatabase).map(d => d.category))]
    ctx.body = { categories }
  } catch (err) {
    ctx.status = 500
    ctx.body = { error: '查询失败' }
  }
})

router.get('/suggest', async (ctx) => {
  const { prefix } = ctx.query
  if (!prefix) {
    ctx.body = { suggestions: [] }
    return
  }

  try {
    const suggestions = Object.entries(characterDatabase)
      .filter(([char, data]) =>
        char.startsWith(prefix) ||
        data.pinyin.toLowerCase().startsWith(prefix.toLowerCase())
      )
      .slice(0, 10)
      .map(([char, data]) => ({
        character: char,
        pinyin: data.pinyin,
        meaning: data.meaning
      }))

    ctx.body = { suggestions }
  } catch (err) {
    ctx.status = 500
    ctx.body = { error: '查询失败' }
  }
})

module.exports = router
