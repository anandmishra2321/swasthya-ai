import React from 'react';
import { Languages } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export const LanguageToggle: React.FC = () => {
  const { lang, setLang } = useLanguage();

  return (
    <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200 text-xs font-semibold">
      <button
        onClick={() => setLang('en')}
        className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
          lang === 'en'
            ? 'bg-white text-indigo-700 shadow-sm'
            : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        <span>EN</span>
      </button>
      <button
        onClick={() => setLang('hi')}
        className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
          lang === 'hi'
            ? 'bg-white text-indigo-700 shadow-sm font-medium'
            : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        <span>हिंदी</span>
      </button>
    </div>
  );
};
