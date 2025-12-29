import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'en' | 'ru'; // Add more as needed

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    settings: 'Settings',
    my_uid: 'My UID',
    language: 'Language',
    contact_support: 'Contact Support',
    legal_info: 'Legal Information',
    terms_conditions: 'Terms & Conditions',
    privacy_policy: 'Privacy Policy',
    acceptable_use: 'Acceptable Use Policy',
    copied: 'Copied to clipboard!',
    close: 'Close',
    english: 'English',
    russian: 'Russian'
  },
  ru: {
    settings: 'Настройки',
    my_uid: 'Мой UID',
    language: 'Язык',
    contact_support: 'Поддержка',
    legal_info: 'Юридическая информация',
    terms_conditions: 'Условия и положения',
    privacy_policy: 'Политика конфиденциальности',
    acceptable_use: 'Правила использования',
    copied: 'Скопировано!',
    close: 'Закрыть',
    english: 'Английский',
    russian: 'Русский'
  }
};

export const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('app_language');
    return (saved as Language) || 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('app_language', lang);
  };

  const t = (key: string) => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
};
