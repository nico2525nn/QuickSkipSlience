import enMessages from "../../locales/en/messages.json"
import jaMessages from "../../locales/ja/messages.json"

type Messages = { [key: string]: { message: string } }

const localeData: { [lang: string]: Messages } = {
  en: enMessages as Messages,
  ja: jaMessages as Messages
}

let currentLang = localStorage.getItem("skip-silence-lang") || "ja"

export function getLanguage(): string {
  return currentLang
}

export function setLanguage(lang: string) {
  currentLang = lang
  localStorage.setItem("skip-silence-lang", lang)
}

type ReplacementStrings = {
  [key: string]: string
}

export default function __(
  name: string,
  replacements?: ReplacementStrings
): string {
  const messages = localeData[currentLang] || localeData["en"]
  let message = messages[name]?.message || name

  if (replacements) {
    for (const key in replacements) {
      message = message.replace(`:${key}`, replacements[key])
    }
  }

  return message
}
