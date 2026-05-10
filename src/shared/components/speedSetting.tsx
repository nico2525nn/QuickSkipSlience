import React from "react"

import type { TabState } from "~shared/state"

import "./speedSetting.scss"

interface SpeedSettingProps {
  label: React.ReactNode
  name: "playback_speed" | "silence_speed"
  config: TabState
  info?: React.ReactNode
}

const SpeedSetting = ({ label, name, config, info }: SpeedSettingProps) => {
  const value = config.current[name] as number
  const min = 0.5
  const max = 16
  const step = 0.25

  return (
    <div className="speed-setting bottom-border">
      <div className="info-container">
        <div className="label-container">
          <label htmlFor={name}>{label}</label>
          {info || null}
        </div>
        <div className="speed-value">{value}x</div>
      </div>
      <input
        type="range"
        id={name}
        min={min}
        max={max}
        step={step}
        value={value}
        className="range-slider__range"
        onChange={(evt) => {
          config.current[name] = parseFloat(evt.target.value)
        }}
      />
    </div>
  )
}

export default SpeedSetting
