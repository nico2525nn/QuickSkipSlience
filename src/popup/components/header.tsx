import icon from "data-base64:~../assets/icon512.png"
import React from "react"

import __, { getLanguage, setLanguage } from "../../shared/i18n"
import "./header.scss"

const Header = () => {
  const currentLang = getLanguage()

  return (
    <div className="header">
      <img src={icon} />
      <h1>{__("extensionName")}</h1>
      <button
        className="lang-toggle"
        onClick={() => {
          setLanguage(currentLang === "ja" ? "en" : "ja")
          window.location.reload()
        }}>
        {currentLang === "ja" ? "EN" : "JA"}
      </button>
    </div>
  )
}

export default Header
