import { createI18n } from 'vue-i18n'

const messages = {
  'zh-CN': {
    common: {
      confirm: '确认',
      cancel: '取消',
      save: '保存',
      delete: '删除',
      edit: '编辑',
      add: '添加',
      search: '搜索',
      loading: '加载中...',
      success: '操作成功',
      error: '操作失败',
      noData: '暂无数据'
    },
    nav: {
      home: '首页',
      progress: '学习进度',
      report: '学习报表',
      teaching: '教学管理'
    },
    auth: {
      login: '登录',
      register: '注册',
      logout: '退出登录',
      username: '用户名',
      password: '密码',
      email: '邮箱',
      realName: '真实姓名',
      welcome: '欢迎'
    },
    furniture: {
      title: '家具列表',
      detail: '查看详情',
      startLearn: '开始学习',
      continueLearn: '继续学习',
      review: '复习',
      category: '分类',
      difficulty: '难度'
    },
    learning: {
      title: '拆解教学',
      step: '步骤',
      totalSteps: '总步骤',
      videoGuide: '视频讲解',
      operationGuide: '操作指南',
      attentionPoints: '注意事项',
      estimatedTime: '预计用时',
      prevStep: '上一步',
      nextStep: '下一步'
    },
    progress: {
      title: '学习进度',
      totalCourses: '总课程数',
      completed: '已完成',
      learning: '学习中',
      totalTime: '总学习时长',
      completionRate: '完成度',
      timeTrend: '学习时间趋势',
      difficultyDist: '难度分布',
      detail: '课程进度详情',
      filter: '筛选状态',
      filterAll: '全部',
      filterCompleted: '已完成',
      filterLearning: '学习中',
      filterNotStarted: '未开始'
    },
    stepManage: {
      title: '教学步骤管理',
      selectFurniture: '选择家具',
      newStep: '新增步骤',
      stepNumber: '步骤序号',
      stepTitle: '步骤标题',
      stepDesc: '步骤描述',
      videoUrl: '视频地址',
      imageUrl: '图片地址',
      targetPart: '目标部件ID',
      uploadVideo: '上传视频',
      hasVideo: '已上传',
      noVideo: '未上传'
    },
    mortise: {
      type: '榫卯类型',
      assemblyTip: '组装提示',
      description: '部件描述'
    }
  },
  'en-US': {
    common: {
      confirm: 'Confirm',
      cancel: 'Cancel',
      save: 'Save',
      delete: 'Delete',
      edit: 'Edit',
      add: 'Add',
      search: 'Search',
      loading: 'Loading...',
      success: 'Success',
      error: 'Error',
      noData: 'No Data'
    },
    nav: {
      home: 'Home',
      progress: 'Progress',
      report: 'Report',
      teaching: 'Teaching'
    },
    auth: {
      login: 'Login',
      register: 'Register',
      logout: 'Logout',
      username: 'Username',
      password: 'Password',
      email: 'Email',
      realName: 'Real Name',
      welcome: 'Welcome'
    },
    furniture: {
      title: 'Furniture List',
      detail: 'View Detail',
      startLearn: 'Start Learning',
      continueLearn: 'Continue Learning',
      review: 'Review',
      category: 'Category',
      difficulty: 'Difficulty'
    },
    learning: {
      title: 'Disassembly Teaching',
      step: 'Step',
      totalSteps: 'Total Steps',
      videoGuide: 'Video Guide',
      operationGuide: 'Operation Guide',
      attentionPoints: 'Attention Points',
      estimatedTime: 'Estimated Time',
      prevStep: 'Previous',
      nextStep: 'Next'
    },
    progress: {
      title: 'Learning Progress',
      totalCourses: 'Total Courses',
      completed: 'Completed',
      learning: 'Learning',
      totalTime: 'Total Time',
      completionRate: 'Completion Rate',
      timeTrend: 'Time Trend',
      difficultyDist: 'Difficulty Distribution',
      detail: 'Course Details',
      filter: 'Filter Status',
      filterAll: 'All',
      filterCompleted: 'Completed',
      filterLearning: 'Learning',
      filterNotStarted: 'Not Started'
    },
    stepManage: {
      title: 'Teaching Step Management',
      selectFurniture: 'Select Furniture',
      newStep: 'New Step',
      stepNumber: 'Step Number',
      stepTitle: 'Step Title',
      stepDesc: 'Step Description',
      videoUrl: 'Video URL',
      imageUrl: 'Image URL',
      targetPart: 'Target Part ID',
      uploadVideo: 'Upload Video',
      hasVideo: 'Uploaded',
      noVideo: 'Not Uploaded'
    },
    mortise: {
      type: 'Mortise Type',
      assemblyTip: 'Assembly Tip',
      description: 'Description'
    }
  },
  'ja-JP': {
    common: {
      confirm: '確認',
      cancel: 'キャンセル',
      save: '保存',
      delete: '削除',
      edit: '編集',
      add: '追加',
      search: '検索',
      loading: '読み込み中...',
      success: '成功',
      error: 'エラー',
      noData: 'データなし'
    },
    nav: {
      home: 'ホーム',
      progress: '進捗',
      report: 'レポート',
      teaching: '教育管理'
    },
    auth: {
      login: 'ログイン',
      register: '登録',
      logout: 'ログアウト',
      username: 'ユーザー名',
      password: 'パスワード',
      email: 'メール',
      realName: '本名',
      welcome: 'ようこそ'
    },
    furniture: {
      title: '家具リスト',
      detail: '詳細を見る',
      startLearn: '学習開始',
      continueLearn: '学習を続ける',
      review: '復習',
      category: 'カテゴリー',
      difficulty: '難易度'
    },
    learning: {
      title: '分解教育',
      step: 'ステップ',
      totalSteps: '総ステップ数',
      videoGuide: 'ビデオガイド',
      operationGuide: '操作ガイド',
      attentionPoints: '注意点',
      estimatedTime: '予定時間',
      prevStep: '前へ',
      nextStep: '次へ'
    },
    progress: {
      title: '学習進捗',
      totalCourses: '総コース数',
      completed: '完了',
      learning: '学習中',
      totalTime: '総学習時間',
      completionRate: '完了率',
      timeTrend: '時間トレンド',
      difficultyDist: '難易度分布',
      detail: 'コース詳細',
      filter: 'ステータスフィルター',
      filterAll: 'すべて',
      filterCompleted: '完了',
      filterLearning: '学習中',
      filterNotStarted: '未開始'
    },
    stepManage: {
      title: '教育ステップ管理',
      selectFurniture: '家具を選択',
      newStep: '新規ステップ',
      stepNumber: 'ステップ番号',
      stepTitle: 'ステップタイトル',
      stepDesc: 'ステップ説明',
      videoUrl: 'ビデオURL',
      imageUrl: '画像URL',
      targetPart: '対象パーツID',
      uploadVideo: 'ビデオをアップロード',
      hasVideo: 'アップロード済み',
      noVideo: '未アップロード'
    },
    mortise: {
      type: 'ほぞタイプ',
      assemblyTip: '組立ティップ',
      description: '説明'
    }
  }
}

const i18n = createI18n({
  legacy: false,
  locale: localStorage.getItem('language') || 'zh-CN',
  fallbackLocale: 'zh-CN',
  messages
})

export default i18n
