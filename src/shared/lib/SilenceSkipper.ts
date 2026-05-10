import browser from "webextension-polyfill"

import type { TabState } from "~shared/state"
import type { MediaElement } from "~shared/types"

import debug from "../debug"
import DynamicThresholdCalculator from "./DynamicThresholdCalculator"
import SampleInspector from "./SampleInspector"
import SpeedController from "./SpeedController"
import TenVadDetector from "./TenVadDetector"

export default class SilenceSkipper {
  config: TabState
  element?: MediaElement

  isDestroyed = false
  isAttached = false
  isSpedUp = false
  samplesSinceLastVolumeMessage = 0
  wasEnabled = false

  audioContext: AudioContext | undefined
  analyser: AnalyserNode | undefined
  gain: GainNode | undefined
  source: MediaStreamAudioSourceNode | MediaElementAudioSourceNode | undefined
  audioFrequencies: Float32Array | undefined
  tabCaptureStream: MediaStream | null = null
  deviceMediaStream: MediaStream | null = null
  vadDetector: TenVadDetector

  dynamicThresholdCalculator: DynamicThresholdCalculator
  speedController: SpeedController
  sampleInspector: SampleInspector

  constructor(config: TabState, mediaElement?: MediaElement, preObtainedStream?: MediaStream) {
    this.config = config
    this.element = mediaElement
    if (preObtainedStream) {
      this.tabCaptureStream = preObtainedStream
    }

    this.dynamicThresholdCalculator = new DynamicThresholdCalculator(config)
    this.speedController = new SpeedController(this)
    this.sampleInspector = new SampleInspector(this)
    this.vadDetector = new TenVadDetector()

    this._onConfigUpdate = this._onConfigUpdate.bind(this)
    this.config.addListener("change", this._onConfigUpdate)

    this._onConfigUpdate("*")
  }

  async _onConfigUpdate(key: string) {
    if (key === "media_speed") return

    const isEnabled = this.config.current.enabled

    if (isEnabled) {
      debug("SilenceSkipper: Updating direct media config")
      this.updateDirectMediaConfig()
    } else if (this.wasEnabled) {
      debug("SilenceSkipper: Returning to normal playback")
      this.speedController.setPlaybackRate(1)
    }

    this.wasEnabled = isEnabled
  }

  private updateDirectMediaConfig() {
    if (!this.sampleInspector.isInspectionRunning) {
      debug("SilenceSkipper: Starting inspection for direct media element")
      this.sampleInspector.inspectSample()
    }

    const playbackSpeed = this.config.current.playback_speed
    const silenceSpeed = this.config.current.silence_speed
    const mediaSpeed = this.config.current.media_speed
    if (this.isSpedUp && mediaSpeed !== silenceSpeed) {
      this.speedController.setPlaybackRate(silenceSpeed)
    } else if (!this.isSpedUp && mediaSpeed !== playbackSpeed) {
      this.speedController.setPlaybackRate(playbackSpeed)
    }

    const muteSilence = this.config.current.mute_silence
    if (muteSilence && this.isSpedUp) {
      if (this.gain) {
        this.gain.gain.value = 0
      }
    } else if (this.gain) {
      this.gain.gain.value = 1
    }
  }

  _sendCommand(command: String, data: Object = {}) {
    browser.runtime.sendMessage({ command, ...data }).catch(() => { })
  }

  destroy() {
    this.isDestroyed = true
    this.analyser?.disconnect()
    this.source?.disconnect()
    this.gain?.disconnect()
    this.audioContext?.close()
    this.vadDetector.destroy()
    this.config.removeListener("change", this._onConfigUpdate)
    this.tabCaptureStream?.getTracks().forEach((track) => track.stop())
    this.deviceMediaStream?.getTracks().forEach((track) => track.stop())
  }
}
