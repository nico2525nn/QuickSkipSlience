import { StateEnvironment } from "@vantezzen/plasmo-state"
import React, { ChangeEvent } from "react"
import browser from "webextension-polyfill"

import type { StateKey, TabState } from "~shared/state"

import "./switch.scss"

interface SwitchProps {
  label: string | React.ReactNode
  name: StateKey
  config: TabState
  info?: React.ReactNode
}

const Switch = ({
  label,
  name,
  config,
  info
}: SwitchProps) => {
  return (
    <div className="switch bottom-border">
      <div className="label-container">
        <label htmlFor={name}>{label}</label>
        {info || null}
      </div>

      <div>
        {name === "enabled" && !config.current[name] && (
          <div className="switch-ping" />
        )}

        <input
          id={name}
          type="checkbox"
          className="switch"
          checked={config.current[name] as boolean}
          onChange={(evt) => {
            // @ts-ignore
            config.current[name] = evt.target.checked

            if (config.environment === StateEnvironment.Popup) {
              if (name === "enabled") {
                browser.tabs
                  .query({ active: true, currentWindow: true })
                  .then((tabs) => {
                    const tabId = tabs[0]?.id
                    if (!tabId) return
                    return browser.runtime.sendMessage({
                      command: evt.target.checked
                        ? "start-tab-capture"
                        : "stop-tab-capture",
                      tabId
                    })
                  })
                  .catch(() => {})
              }
            }

            if (name === "allow_analytics") {
              setTimeout(() => {
                window.location.reload()
              }, 250)
            }
          }}
        />
      </div>
    </div>
  )
}

export default Switch
