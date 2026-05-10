import React from "react"

import __ from "../../shared/i18n"

function Footer() {
  return (
    <div className="plugin-info">
      {__("forkedFrom")}{" "}
      <a href="https://github.com/vantezzen/skip-silence" target="_blank" className="yellow">
        skip-silence
      </a>
      <br />
      <a href="https://github.com/nanato12/QuickSkipSlience" target="_blank">
        {__("viewOnGitHub")}
      </a>
    </div>
  )
}

export default Footer
