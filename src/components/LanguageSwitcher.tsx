import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supportedLngs, SupportedLanguage, languageNames } from '../i18n';

type LanguageOption = {
  code: SupportedLanguage;
  name: string;
};

const LanguageSwitcher: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguage>(i18n.language as SupportedLanguage);
  
  // 创建语言选项
  const languages: LanguageOption[] = supportedLngs.map(code => ({
    code,
    name: languageNames[code] || code
  }));

  // 监听语言变化
  useEffect(() => {
    const handleLanguageChanged = (lng: string) => {
      setCurrentLanguage(lng as SupportedLanguage);
    };

    i18n.on('languageChanged', handleLanguageChanged);
    return () => {
      i18n.off('languageChanged', handleLanguageChanged);
    };
  }, [i18n]);

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng).catch(console.error);
  };

  return (
    <div className="language-switcher">
      <select
        value={currentLanguage}
        onChange={(e) => changeLanguage(e.target.value)}
        className="language-select"
        aria-label={t('settings.language')}
        style={{
          padding: '4px 8px',
          borderRadius: '4px',
          border: '1px solid #ccc',
          backgroundColor: 'white',
          minWidth: '200px',
        }}
      >
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default LanguageSwitcher;
