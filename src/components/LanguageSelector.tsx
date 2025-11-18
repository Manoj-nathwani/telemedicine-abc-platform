import React from 'react';
import { Form } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import { CLINICIAN_LANGUAGES } from '../constants';

interface Language {
  code: string;
  name: string;
}

interface LanguageSelectorProps {
  languages?: Language[];
  className?: string;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ languages, className }) => {
  const { i18n } = useTranslation();

  // Use provided languages or default to clinician UI languages
  const availableLanguages = languages || CLINICIAN_LANGUAGES;

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    i18n.changeLanguage(event.target.value);
  };

  return (
    <Form.Select
      size="sm"
      value={i18n.language}
      onChange={handleChange}
      className={className}
    >
      {availableLanguages.map((lang: Language) => (
        <option key={lang.code} value={lang.code}>
          {lang.name}
        </option>
      ))}
    </Form.Select>
  );
}; 