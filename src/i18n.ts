import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';

i18n
  // 检测用户语言
  .use(Backend)
  // 检测用户语言
  .use(LanguageDetector)
  // 将 i18n 实例传递给 react-i18next
  .use(initReactI18next)
  // 初始化 i18next
  .init({
    // 默认语言
    fallbackLng: 'zh-CN',
    // 调试模式
    debug: process.env.NODE_ENV === 'development',
    // 是否在初始化时加载默认语言
    load: 'languageOnly',
    // 语言文件命名空间
    ns: ['common'],
    defaultNS: 'common',
    // 语言文件路径
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    // 配置语言检测
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
    // 配置语言切换
    interpolation: {
      escapeValue: false, // 不需要转义
    },
  });

export default i18n;
