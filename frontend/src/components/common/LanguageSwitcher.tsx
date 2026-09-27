import { useState, useEffect } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import type { Locale } from '../../lib/i18n';

export function LanguageSwitcher() {
  const { locale, setLocale, locales } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = () => setIsOpen(false);
    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isOpen]);

  const currentLabel =
    locales.find((l) => l.value === locale)?.label ?? 'English';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
      >
        <span>{currentLabel}</span>
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {isOpen && (
        <div className="absolute right-0 z-50 mt-1 w-40 rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
          {locales.map((l) => (
            <button
              key={l.value}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLocale(l.value);
                setIsOpen(false);
              }}
              className={`flex w-full items-center px-3 py-2 text-left text-sm ${
                l.value === locale
                  ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'
                  : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
              }`}
            >
              <span>{l.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default LanguageSwitcher;
