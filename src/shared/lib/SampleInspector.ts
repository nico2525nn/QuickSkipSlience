import debug from "../debug"
import type SilenceSkipper from "./SilenceSkipper"
import { attachSkipper } from "./Utils"

export default class SampleInspector {
  skipper: SilenceSkipper

  samplesUnderThreshold = 0
  isInspectionRunning = false
  _samplePosition = 0
  _lastSentVolumeInfo = 0
  private silenceStartedAt = 0

  constructor(skipper: SilenceSkipper) {
    this.skipper = skipper
  }

  getCurrentSamples() {
    if (!this.skipper.analyser || !this.skipper.audioFrequencies) {
      debug("SilenceSkipper: Can't calculate volume as we are not attached")
      return undefined
    }

    this.skipper.analyser.getFloatTimeDomainData(this.skipper.audioFrequencies)
    return this.skipper.audioFrequencies
  }

  calculateVolume(samples: Float32Array | undefined) {
    if (!samples) {
      return 100
    }

    let peakInstantaneousPower = 0
    for (let i = 0; i < samples.length; i++) {
      const power = Math.abs(samples[i])
      peakInstantaneousPower = Math.max(power, peakInstantaneousPower)
    }
    const volume = 500 * peakInstantaneousPower

    return volume
  }

  async inspectSample() {
    this.isInspectionRunning = true

    try {
      if (!this.skipper.isAttached) await attachSkipper(this.skipper)
    } catch (error) {
      debug("SilenceSkipper: Disabling after attach error", error)
      this.skipper.config.current.enabled = false
      this.stopInspection()
      return
    }

    this._samplePosition = (this._samplePosition + 1) % 50

    const samples = this.getCurrentSamples()
    const volume = this.calculateVolume(samples)
    const useDynamicThreshold =
      this.skipper.config.current.dynamic_silence_threshold

    if (useDynamicThreshold && volume > 0) {
      this.addCurrentSampleToDynamicThreshold(volume)
    }

    const threshold = useDynamicThreshold
      ? this.skipper.dynamicThresholdCalculator.threshold
      : this.skipper.config.current.silence_threshold

    const vadResult =
      samples && this.skipper.audioContext
        ? await this.skipper.vadDetector.detect(
            samples,
            this.skipper.audioContext.sampleRate
          )
        : { available: false, isSpeech: false, probability: 0 }

    this.updateSpeedBasedOnSampleResult(
      volume,
      threshold,
      vadResult.available && vadResult.isSpeech
    )
    this.sendVolumeInfoToPopup(volume)
    this.prepareNextInspection()
  }

  private prepareNextInspection() {
    if (this.skipper.config.current.enabled && !this.skipper.isDestroyed) {
      setTimeout(() => this.inspectSample(), 25)
    } else {
      this.stopInspection()
    }
  }

  private stopInspection() {
    this.isInspectionRunning = false

    if (this.skipper.isSpedUp) {
      this.skipper.isSpedUp = false
      this.samplesUnderThreshold = 0
      this.silenceStartedAt = 0
    }
    this.skipper._sendCommand("slowDown")
    this.skipper.speedController.setPlaybackRate(1)

    this.skipper._sendCommand("volume", {
      data: 0
    })
  }

  private sendVolumeInfoToPopup(volume: number) {
    this.skipper.samplesSinceLastVolumeMessage++
    if (this.skipper.samplesSinceLastVolumeMessage >= 3) {
      if (this._lastSentVolumeInfo !== volume) {
        debug("SampleInspector: Sending volume information to popup")
        try {
          this.skipper._sendCommand("volume", {
            data: volume
          })
        } catch (e) {}

        this._lastSentVolumeInfo = volume
      }
      this.skipper.samplesSinceLastVolumeMessage = 0
    }
  }

  private updateSpeedBasedOnSampleResult(
    volume: number,
    threshold: any,
    isSpeech: boolean
  ) {
    const requiredSilenceMs =
      (this.skipper.config.current.silence_duration_seconds || 3) * 1000
    const isSilent = volume < threshold && !isSpeech

    if (isSilent && !this.skipper.isSpedUp) {
      this.samplesUnderThreshold += 1
      if (!this.silenceStartedAt) {
        this.silenceStartedAt = performance.now()
      }

      if (performance.now() - this.silenceStartedAt >= requiredSilenceMs) {
        this.skipper.speedController.speedUp()
      }
    } else if (!isSilent && this.skipper.isSpedUp) {
      this.skipper.speedController.slowDown()
      this.silenceStartedAt = 0
    } else if (!isSilent) {
      this.samplesUnderThreshold = 0
      this.silenceStartedAt = 0
    }
  }

  private addCurrentSampleToDynamicThreshold(volume: number) {
    this.skipper.dynamicThresholdCalculator.previousSamples.push(volume)

    if (this._samplePosition === 0) {
      this.skipper.dynamicThresholdCalculator.calculate()
    }
  }
}
