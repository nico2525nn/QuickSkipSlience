import { StateEnvironment } from "@vantezzen/plasmo-state"
import React from "react"
import { CSSTransition } from "react-transition-group"

import type { TabState } from "~shared/state"

import speedSettings from "../speedSettings"
import "./speedSetting.scss"

interface SpeedSettingProps {
  label: String | React.ReactNode
  name: "playback_speed" | "silence_speed"
  config: TabState
  info?: React.ReactNode
}

type IsCustomKeys = "silence_speed_is_custom" | "playback_speed_is_custom"

const SpeedSetting = ({
  label,
  name,
  config,
  info
}: SpeedSettingProps) => {
  const value = config.current[name] as number
  const isCustomValue = config.current[`${name}_is_custom` as IsCustomKeys]
  const [isOpen, setIsOpen] = React.useState(false)
  const [tempValue, setTempValue] = React.useState<string | null>(null)

  let selector
  if (isCustomValue) {
    selector = (
      <div className="custom-value-container">
        <input
          type="number"
          value={tempValue ?? value}
          onChange={(evt) => {
            if (!/[0-9]$/.test(evt.target.value)) {
              setTempValue(evt.target.value)
            }

            config.current[name] = parseFloat(evt.target.value)
            setTempValue(null)
          }}
          step={0.1}
          min={0.06}
          max={16}
        />
        <button
          onClick={() => {
            config.current[`${name}_is_custom` as IsCustomKeys] = false

            let nearestSetting = 1
            for (const setting of speedSettings) {
              if (
                Math.abs(value - setting) < Math.abs(value - nearestSetting)
              ) {
                nearestSetting = setting
              }
            }

            config.current[name] = Number(nearestSetting)
          }}>
          Dropdown
        </button>
      </div>
    )
  } else {
    selector = (
      <div className="selector-container">
        {speedSettings.map((val) => (
          <button
            className={`value-option ${val === value ? "active" : ""}`}
            onClick={() => {
              config.current[name] = Number(val)
            }}
            key={val}>
            {val}x
          </button>
        ))}

        <button
          className="value-option value-custom"
          onClick={() => {
            config.current[`${name}_is_custom` as IsCustomKeys] = true
          }}>
          Custom
        </button>
      </div>
    )
  }

  return (
    <div className="speed-setting bottom-border">
      <div className="info-container">
        <div className="label-container">
          <label htmlFor={name}>{label}</label>
          {info || null}
        </div>

        <button className="current-speed" onClick={() => setIsOpen(!isOpen)}>
          {value}x
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="chevron-icon"
            style={{ transform: `rotate(${isOpen ? 180 : 0}deg)` }}>
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
      </div>

      <CSSTransition
        in={isOpen}
        timeout={300}
        classNames="opacity-transition"
        className="opacity-transition selector">
        <div>{selector}</div>
      </CSSTransition>
    </div>
  )
}

export default SpeedSetting
