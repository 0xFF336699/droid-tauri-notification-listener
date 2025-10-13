import { useTranslation as useI18nBase } from 'react-i18next';
import i18n from '../i18n';

export const useTranslation = () => {
  const { t } = useI18nBase();
  
  // 切换语言
  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng).catch(console.error);
  };

  // 获取当前语言
  const currentLanguage = i18n.language;

  return {
    t,
    i18n,
    changeLanguage,
    currentLanguage,
  };
};

export default useTranslation;
