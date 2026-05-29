import React from "react"

import __ from "../../shared/i18n"

function Footer({ triggerIntro }: { triggerIntro: () => void }) {
  return (
    <div className="plugin-info">
      {__("developedBy")}{" "}
      <a
        href="https://github.com/vantezzen/skip-silence"
        target="_blank"
        className="yellow">
        vantezzen/skip-silence
      </a>
      <br />
      <a
        href="#"
        onClick={(e) => {
          e.preventDefault()
          triggerIntro()
        }}>
        {__("showTheTrainingScreenAgain")}
      </a>
    </div>
  )
}

export default Footer
