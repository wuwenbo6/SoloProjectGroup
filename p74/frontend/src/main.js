import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import en from 'element-plus/es/locale/lang/en'
import App from './App.vue'
import router from './router'
import i18n from './locales'

const app = createApp(App)

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

const locale = localStorage.getItem('locale') || 'zh-CN'
const elementLocale = locale === 'zh-CN' ? zhCn : en

app.use(createPinia())
app.use(router)
app.use(ElementPlus, { locale: elementLocale })
app.use(i18n)

app.mount('#app')
