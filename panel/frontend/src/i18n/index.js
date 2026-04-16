import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import es from './es'
import ca from './ca'

i18n
  .use(initReactI18next)
  .init({
    resources: { es, ca },
    lng: localStorage.getItem('language') || 'es',
    fallbackLng: 'es',
    interpolation: { escapeValue: false },
  })

export default i18n
