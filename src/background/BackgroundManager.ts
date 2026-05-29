import { StateEnvironment } from "@vantezzen/plasmo-state"
import browser from "webextension-polyfill"

import { AnalyserType, TabState } from "~shared/state"
import getState from "~shared/state"

import debug from "../shared/debug"
import DynamicThresholdCalculator from "../shared/lib/DynamicThresholdCalculator"
import SilenceSkipper from "../shared/lib/SilenceSkipper"

export type BackgroundTabReference = {
  tabId: number
  state: TabState
  silenceSkipper?: SilenceSkipper
  tabCaptureController?: TabCaptureController
}

const OFFSCREEN_DOCUMENT_PATH = "assets/offscreen.html"

let creatingOffscreenDocument: Promise<void> | undefined

async function ensureOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)
  const existingContexts = await (chrome.runtime as any).getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [offscreenUrl]
  })

  if (existingContexts.length > 0) return

  if (!creatingOffscreenDocument) {
    creatingOffscreenDocument = (chrome as any).offscreen.createDocument({
      url: OFFSCREEN_DOCUMENT_PATH,
      reasons: ["USER_MEDIA"],
      justification: "Capture tab audio for silence detection"
    })
  }

  await creatingOffscreenDocument
  creatingOffscreenDocument = undefined
}

async function sendToOffscreen(message: Record<string, unknown>) {
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      return await chrome.runtime.sendMessage({
        target: "tab-capture-offscreen",
        ...message
      })
    } catch (error: any) {
      debug("Offscreen message failed", attempt, error?.message)
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }

  throw new Error("Offscreen document did not accept runtime message")
}

class TabCaptureController {
  private state: TabState
  private tabId: number
  private dynamicThresholdCalculator: DynamicThresholdCalculator
  private samplesUnderThreshold = 0
  private isSpedUp = false
  private samplePosition = 0
  private samplesSinceLastVolumeMessage = 0
  private lastSentVolumeInfo = 0

  constructor(tabId: number, state: TabState) {
    this.tabId = tabId
    this.state = state
    this.dynamicThresholdCalculator = new DynamicThresholdCalculator(state)
  }

  async start() {
    await ensureOffscreenDocument()

    const streamId = await (chrome.tabCapture as any).getMediaStreamId({
      targetTabId: this.tabId
    })

    debug("Starting offscreen tab capture", this.tabId)
    await sendToOffscreen({
      command: "start",
      tabId: this.tabId,
      streamId
    })
  }

  async stop() {
    await sendToOffscreen({
      command: "stop",
      tabId: this.tabId
    }).catch(() => {})

    this.slowDown()
    this.sendVolumeInfo(0)
  }

  handleVolume(volume: number) {
    if (!this.state.current.enabled) return

    this.samplePosition = (this.samplePosition + 1) % 50

    const useDynamicThreshold = this.state.current.dynamic_silence_threshold
    if (useDynamicThreshold && volume > 0) {
      this.dynamicThresholdCalculator.previousSamples.push(volume)
      if (this.samplePosition === 0) {
        this.dynamicThresholdCalculator.calculate()
      }
    }

    const threshold = useDynamicThreshold
      ? this.dynamicThresholdCalculator.threshold
      : this.state.current.silence_threshold

    this.updateSpeedBasedOnVolume(
      volume,
      threshold,
      this.state.current.samples_threshold
    )
    this.sendVolumeInfo(volume)
  }

  private updateSpeedBasedOnVolume(
    volume: number,
    threshold: number,
    sampleThreshold: number
  ) {
    if (volume < threshold && !this.isSpedUp) {
      this.samplesUnderThreshold += 1

      if (this.samplesUnderThreshold >= sampleThreshold) {
        this.speedUp()
      }
    } else if (volume > threshold && this.isSpedUp) {
      this.slowDown()
    }
  }

  private sendVolumeInfo(volume: number) {
    this.samplesSinceLastVolumeMessage++
    if (this.samplesSinceLastVolumeMessage < 3) return

    if (this.lastSentVolumeInfo !== volume) {
      browser.runtime.sendMessage({ command: "volume", data: volume }).catch(() => {})
      this.lastSentVolumeInfo = volume
    }
    this.samplesSinceLastVolumeMessage = 0
  }

  private speedUp() {
    debug("TabCaptureController: speedUp", this.tabId)
    this.isSpedUp = true
    browser.runtime.sendMessage({ command: "speedUp" }).catch(() => {})
    this.state.current.media_speed = this.state.current.silence_speed
  }

  private slowDown() {
    debug("TabCaptureController: slowDown", this.tabId)
    this.isSpedUp = false
    this.samplesUnderThreshold = 0
    browser.runtime.sendMessage({ command: "slowDown" }).catch(() => {})
    this.state.current.media_speed = this.state.current.playback_speed
  }
}

export default class BackgroundManager {
  private tabReferences: {
    [tabId: number]: BackgroundTabReference | undefined
  } = {}

  constructor() {
    this.attachToTabsRequestingActivation()
    this.provideTabIdApi()
    this.listenForTabCaptureControlMessages()
  }

  private provideTabIdApi() {
    browser.runtime.onMessage.addListener((request, sender) => {
      if (request.command === "get-tab-id") {
        return Promise.resolve(sender.tab?.id)
      }
    })
  }

  private attachToTabsRequestingActivation() {
    browser.runtime.onMessage.addListener((request, sender) => {
      if (request.command === "request-activation") {
        this.attachToTab(sender.tab!.id!)
      }
    })
  }

  private listenForTabCaptureControlMessages() {
    browser.runtime.onMessage.addListener((request) => {
      if (request.command === "start-tab-capture") {
        this.attachToTab(request.tabId)
        return this.startTabCapture(request.tabId)
      }

      if (request.command === "stop-tab-capture") {
        return this.stopTabCapture(request.tabId)
      }

      if (request.command === "tab-capture-volume") {
        this.tabReferences[request.tabId]?.tabCaptureController?.handleVolume(
          request.volume
        )
      }

      if (request.command === "tab-capture-error") {
        debug("Tab capture error", request.tabId, request.error)
      }
    })
  }

  private attachToTab(tabId: number) {
    if (this.tabReferences[tabId]) {
      debug(`Already attached to tab ${tabId}`)
      return
    }

    // this.enableBrowserActionForTab(tabId)
    this.setupTabReferenceForTabId(tabId)
    this.listenForTabRemovedEvent(tabId)
  }

  private listenForTabRemovedEvent(tabId: number) {
    const tabRemovedListener = (removedTabId: number) => {
      if (removedTabId === tabId) {
        debug(`Tab ${tabId} removed - detaching`)
        this.detachTab(tabId)
        browser.tabs.onRemoved.removeListener(tabRemovedListener)
      }
    }
    browser.tabs.onRemoved.addListener(tabRemovedListener)
  }

  private detachTab(tabId: number) {
    if (!this.tabReferences[tabId]) {
      debug(`Already detached from tab ${tabId}`)
      return
    }
    this.tabReferences[tabId]?.silenceSkipper?.destroy()
    this.tabReferences[tabId]?.tabCaptureController?.stop()
    this.tabReferences[tabId]?.state.destroy()
    this.tabReferences[tabId] = undefined
  }

  private async startTabCapture(tabId: number) {
    const tabReference = this.tabReferences[tabId]
    if (!tabReference) return

    if (tabReference.state.current.analyserType !== AnalyserType.tabCapture) {
      return
    }

    if (!tabReference.tabCaptureController) {
      tabReference.tabCaptureController = new TabCaptureController(
        tabId,
        tabReference.state
      )
    }

    await tabReference.tabCaptureController.start()
  }

  private async stopTabCapture(tabId: number) {
    const tabReference = this.tabReferences[tabId]
    if (!tabReference?.tabCaptureController) return

    await tabReference.tabCaptureController.stop()
    tabReference.tabCaptureController = undefined
  }

  private setupTabReferenceForTabId(tabId: number) {
    const state = getState(StateEnvironment.Background, tabId)
    this.tabReferences[tabId] = {
      tabId,
      state
    }

    this.tabReferences[tabId]!.state.addListener("change", (key) => {
      if (key !== "*") return
      this.createOrDestroySkipperForTab(tabId)
    })
  }

  private createOrDestroySkipperForTab(tabId: number) {
    if (!this.tabReferences[tabId]) return

    const state = this.tabReferences[tabId]!.state
    const hasSkipper = this.tabReferences[tabId]!.silenceSkipper !== undefined
    const isEnabled = state.current.enabled

    if (
      isEnabled &&
      !hasSkipper &&
      state.current.analyserType === AnalyserType.tabCapture
    ) {
      debug("Waiting for popup gesture to start tab capture for tab", tabId)
    }

    if (
      hasSkipper &&
      (!isEnabled || state.current.analyserType !== AnalyserType.tabCapture)
    ) {
      debug("Destroying silence skipper for tab", tabId)
      this.tabReferences[tabId]!.silenceSkipper?.destroy()
      this.tabReferences[tabId]!.silenceSkipper = undefined
      this.stopTabCapture(tabId)
    }

    console.log("Config updated for tab", tabId)
  }

  private enableBrowserActionForTab(tabId: number) {
    debug("Enabling page action for tab", tabId)
    browser.pageAction.show(tabId)
    browser.pageAction.setIcon({
      tabId,
      path: "assets/img/icon-32.png"
    })
  }
}
