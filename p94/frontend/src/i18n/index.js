import { createI18n } from 'vue-i18n'

const messages = {
  'zh-CN': {
    common: {
      title: '皮影道具采集系统',
      save: '保存',
      cancel: '取消',
      delete: '删除',
      edit: '编辑',
      add: '新增',
      search: '搜索',
      reset: '重置',
      confirm: '确认',
      back: '返回',
      loading: '加载中...',
      success: '操作成功',
      error: '操作失败',
      noData: '暂无数据'
    },
    nav: {
      home: '首页',
      props: '道具展示',
      collection: '道具采集',
      crafts: '工艺说明',
      collaboration: '协同采集'
    },
    prop: {
      title: '皮影道具',
      name: '道具名称',
      category: '分类',
      description: '描述',
      material: '材质',
      size: '尺寸',
      origin: '来源地',
      upload: '上传道具',
      similar: '相似道具',
      image: '道具图片'
    },
    craft: {
      title: '工艺说明',
      steps: '制作步骤',
      step: '步骤',
      startDemo: '开始演示',
      prevStep: '上一步',
      nextStep: '下一步',
      finish: '完成',
      materials: '所需材料',
      tools: '所需工具',
      duration: '制作时长',
      difficulty: '难度',
      tips: '小贴士'
    },
    user: {
      login: '登录',
      logout: '退出',
      username: '用户名',
      password: '密码'
    }
  },
  'en-US': {
    common: {
      title: 'Shadow Puppet System',
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit',
      add: 'Add',
      search: 'Search',
      reset: 'Reset',
      confirm: 'Confirm',
      back: 'Back',
      loading: 'Loading...',
      success: 'Success',
      error: 'Error',
      noData: 'No Data'
    },
    nav: {
      home: 'Home',
      props: 'Props',
      collection: 'Collection',
      crafts: 'Crafts',
      collaboration: 'Collaboration'
    },
    prop: {
      title: 'Shadow Puppet',
      name: 'Prop Name',
      category: 'Category',
      description: 'Description',
      material: 'Material',
      size: 'Size',
      origin: 'Origin',
      upload: 'Upload Prop',
      similar: 'Similar Props',
      image: 'Prop Image'
    },
    craft: {
      title: 'Craft Techniques',
      steps: 'Production Steps',
      step: 'Step',
      startDemo: 'Start Demo',
      prevStep: 'Previous',
      nextStep: 'Next',
      finish: 'Finish',
      materials: 'Materials',
      tools: 'Tools',
      duration: 'Duration',
      difficulty: 'Difficulty',
      tips: 'Tips'
    },
    user: {
      login: 'Login',
      logout: 'Logout',
      username: 'Username',
      password: 'Password'
    }
  },
  'ja-JP': {
    common: {
      title: '影絵人形システム',
      save: '保存',
      cancel: 'キャンセル',
      delete: '削除',
      edit: '編集',
      add: '追加',
      search: '検索',
      reset: 'リセット',
      confirm: '確認',
      back: '戻る',
      loading: '読み込み中...',
      success: '成功',
      error: 'エラー',
      noData: 'データなし'
    },
    nav: {
      home: 'ホーム',
      props: '道具一覧',
      collection: '道具収集',
      crafts: '工芸説明',
      collaboration: '共同作業'
    },
    prop: {
      title: '影絵人形',
      name: '道具名',
      category: 'カテゴリ',
      description: '説明',
      material: '材質',
      size: 'サイズ',
      origin: '原産地',
      upload: 'アップロード',
      similar: '類似道具',
      image: '画像'
    },
    craft: {
      title: '工芸技術',
      steps: '制作手順',
      step: 'ステップ',
      startDemo: 'デモ開始',
      prevStep: '前へ',
      nextStep: '次へ',
      finish: '完了',
      materials: '必要材料',
      tools: '必要道具',
      duration: '所要時間',
      difficulty: '難易度',
      tips: 'コツ'
    },
    user: {
      login: 'ログイン',
      logout: 'ログアウト',
      username: 'ユーザー名',
      password: 'パスワード'
    }
  }
}

const i18n = createI18n({
  legacy: false,
  locale: localStorage.getItem('locale') || 'zh-CN',
  fallbackLocale: 'zh-CN',
  messages
})

export default i18n
