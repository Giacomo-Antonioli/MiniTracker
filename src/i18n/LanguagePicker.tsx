import { useState } from 'react'
import { LANGUAGES, readLanguageChoice, setLanguageChoice, useT, type LanguageChoice } from '.'

/** Language select: Settings › Appearance and the welcome guide's first step. */
export function LanguagePicker() {
  const t = useT()
  const [choice, setChoice] = useState<LanguageChoice>(readLanguageChoice)
  return (
    <label className="flex items-center gap-3">
      {t('language.label')}
      <select
        className="input"
        value={choice}
        onChange={(e) => {
          const c = e.target.value as LanguageChoice
          setChoice(c)
          setLanguageChoice(c)
        }}
      >
        <option value="auto">{t('language.auto')}</option>
        {Object.entries(LANGUAGES).map(([id, name]) => (
          <option key={id} value={id}>{name}</option>
        ))}
      </select>
    </label>
  )
}
