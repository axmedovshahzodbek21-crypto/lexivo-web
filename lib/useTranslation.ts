'use client';
import { useState, useEffect } from 'react';
import { getUILanguage } from './storage';
import { translations, type Translations } from './i18n';

function getLang(): 'en' | 'uz' {
  return getUILanguage();
}

export function useTranslation(): Translations {
  const [t, setT] = useState<Translations>(translations.en);

  useEffect(() => {
    const update = () => setT(translations[getLang()] ?? translations.en);
    update();
    window.addEventListener('lexivo-lang-change', update);
    window.addEventListener('lexivo-sync', update);
    return () => {
      window.removeEventListener('lexivo-lang-change', update);
      window.removeEventListener('lexivo-sync', update);
    };
  }, []);

  return t;
}
