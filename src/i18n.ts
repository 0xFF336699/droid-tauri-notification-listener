import i18n, { InitOptions } from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// 支持的语言列表
export const supportedLngs = [
  'en',
  'zh-CN',
  'zh-TW',
  'ja',
  'ko',
  'de',
  'fr',
  'es',
  'pt-BR',
  'pt-PT',
  'ru',
  'it',
  'nl',
  'tr',
  'ar',
  'hi',
  'th',
  'vi',
  'id',
  'pl',
  'uk',
  'el',
  'he',
  'sv',
  'no',
  'da'
] as const;

export type SupportedLanguage = typeof supportedLngs[number];

// 语言名称映射（使用各语言的原生名称）
export const languageNames: Record<SupportedLanguage, string> = {
  'en': 'English',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  'ja': '日本語',
  'ko': '한국어',
  'de': 'Deutsch',
  'fr': 'Français',
  'es': 'Español',
  'pt-BR': 'Português (Brasil)',
  'pt-PT': 'Português (Portugal)',
  'ru': 'Русский',
  'it': 'Italiano',
  'nl': 'Nederlands',
  'tr': 'Türkçe',
  'ar': 'العربية',
  'hi': 'हिन्दी',
  'th': 'ไทย',
  'vi': 'Tiếng Việt',
  'id': 'Bahasa Indonesia',
  'pl': 'Polski',
  'uk': 'Українська',
  'el': 'Ελληνικά',
  'he': 'עברית',
  'sv': 'Svenska',
  'no': 'Norsk',
  'da': 'Dansk'
};

type Resources = {
  [key in SupportedLanguage]: {
    translation: Record<string, any>;
  };
};

// 默认语言
export const fallbackLng = 'en';

// 导入翻译文件
const loadTranslations = async (): Promise<Resources> => {
  const resources: Resources = {} as Resources;
  
  for (const lng of supportedLngs) {
    try {
      // 使用动态导入加载翻译文件
      const module = await import(`./locales/${lng}/translation.json`);
      resources[lng as SupportedLanguage] = {
        translation: module.default || module
      };
    } catch (error) {
      console.error(`Failed to load translations for ${lng}:`, error);
      // 如果加载失败，使用空对象，这样会回退到默认语言
      resources[lng as SupportedLanguage] = {
        translation: {}
      };
    }
  }
  
  return resources;
};

// 初始化i18n
export const initI18n = async () => {
  const resources = await loadTranslations();
  
  // 添加语言切换监听器
  i18n.on('languageChanged', (lng: string) => {
    console.log('Language changed to:', lng);
    localStorage.setItem('i18nextLng', lng);
  });

  // 获取浏览器语言并尝试匹配支持的语言
  const getBrowserLanguage = (): string | undefined => {
    const browserLang = navigator.language || (navigator as any).userLanguage;
    if (!browserLang) return undefined;
    
    // 完全匹配
    if (supportedLngs.includes(browserLang as SupportedLanguage)) {
      return browserLang;
    }
    
    // 尝试匹配主语言代码（例如：zh-CN -> zh）
    const mainLang = browserLang.split('-')[0];
    const matchedLang = supportedLngs.find(lang => lang.startsWith(mainLang));
    if (matchedLang) return matchedLang;
    
    return undefined;
  };

  const savedLanguage = localStorage.getItem('i18nextLng');
  const browserLanguage = getBrowserLanguage();
  const defaultLanguage = (savedLanguage || browserLanguage || fallbackLng) as SupportedLanguage;

  // 准备i18n配置
  const i18nConfig: InitOptions = {
    fallbackLng,
    lng: defaultLanguage,
    resources: resources as any, // 使用类型断言解决类型问题
    supportedLngs: [...supportedLngs],
    debug: process.env.NODE_ENV === 'development',
    ns: ['translation'],
    defaultNS: 'translation',
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
    saveMissing: process.env.NODE_ENV === 'development',
    saveMissingTo: 'all' as const, // 明确指定为字面量类型
    parseMissingKeyHandler: (key: string) => {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Missing translation:', key);
      }
      return key;
    },
    initImmediate: false, // 确保在初始化时加载所有翻译
  };

  // 初始化i18n
  await i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init(i18nConfig);
  
  // 确保选择的语言是受支持的
  const currentLang = i18n.language as SupportedLanguage;
  if (currentLang && !supportedLngs.includes(currentLang)) {
    await i18n.changeLanguage(fallbackLng);
  }
  
  return i18n;
};

export const changeLanguage = (lng: string) => i18n.changeLanguage(lng);
export const getCurrentLanguage = (): string => i18n.language;

export default i18n;
