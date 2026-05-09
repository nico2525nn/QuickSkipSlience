import { StateEnvironment } from "@vantezzen/plasmo-state"
import browser from "webextension-polyfill"

import { isMv3 } from "~shared/platform"
import { AnalyserType, TabState } from "~shared/state"
import getState from "~shared/state"

import debug from "../shared/debug"
import SilenceSkipper from "../shared/lib/SilenceSkipper"

export type BackgroundTabReference = {
  tabId: number
  state: TabState
  silenceSkipper?: SilenceSkipper
}

export default class BackgroundManager {
  private tabReferences: {
    [tabId: number]: BackgroundTabReference | undefined
  } = {}

  constructor() {
    this.attachToTabsRequestingActivation()
    this.provideTabIdApi()
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
        if (isMv3) {
          return this.handleMv3Activation(sender.tab!.id!)
        } else {
          this.attachToTab(sender.tab!.id!)
        }
      }
    })
  }

  /**
   * MV3: バックグラウンドでtabCaptureのストリームIDを取得し、
   * コンテンツスクリプトに送信する
   */
  private async handleMv3Activation(tabId: number) {
    debug("MV3: Handling activation for tab", tabId)
    try {
      const streamId = await new Promise<string>((resolve, reject) => {
        chrome.tabCapture.getMediaStreamId(
          { consumerTabId: tabId },
          (capturedStreamId: string) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError)
            } else {
              resolve(capturedStreamId)
            }
          }
        )
      })
      debug("MV3: Got stream ID, sending to content script")
      await browser.tabs.sendMessage(tabId, {
        command: "tabCapture-stream-id",
        streamId
      })
      this.attachToTab(tabId)
    } catch (e) {
      debug("MV3: Failed to get stream ID", e)
    }
  }

  private attachToTab(tabId: number) {
    if (this.tabReferences[tabId]) {
      debug(`Already attached to tab ${tabId}`)
      return
    }

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
    this.tabReferences[tabId]?.state.destroy()
    this.tabReferences[tabId] = undefined
  }

  private setupTabReferenceForTabId(tabId: number) {
    const state = getState(StateEnvironment.Background, tabId)
    this.tabReferences[tabId] = {
      tabId,
      state
    }

    this.tabReferences[tabId]!.state.addListener("change", (key) => {
      if (key !== "*") return
      // MV3ではSilenceSkipperはコンテンツスクリプト側で管理されるため、
      // バックグラウンドでの作成/破棄はMV2のみ
      if (!isMv3) {
        this.createOrDestroySkipperForTab(tabId)
      }
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
      debug("Creating silence skipper for tab", tabId)
      this.tabReferences[tabId]!.silenceSkipper = new SilenceSkipper(state)
    }

    if (
      hasSkipper &&
      (!isEnabled || state.current.analyserType !== AnalyserType.tabCapture)
    ) {
      debug("Destroying silence skipper for tab", tabId)
      this.tabReferences[tabId]!.silenceSkipper?.destroy()
      this.tabReferences[tabId]!.silenceSkipper = undefined
    }

    console.log("Config updated for tab", tabId)
  }


}
