/**
 * Content Script
 * This script will be loaded into all pages
 */
import { StateEnvironment } from "@vantezzen/plasmo-state"
import cssText from "data-text:./lib/content.styles.css"
import debugging from "debug"
import type { PlasmoContentScript } from "plasmo"
import browser from "webextension-polyfill"

import getState, { AnalyserType } from "~shared/state"

import { isMv3, supportsTabCapture } from "../shared/platform"
import setupOnPageSkipperContent, {
  setupTabCaptureInContentScript
} from "./lib/browserSetup/onPage"
import setupBrowserContent from "./lib/browserSetup/shared"
import Bar from "./lib/command-bar/Bar"
import "./lib/content.styles.css"
import setupKeyboardShortcuts from "./lib/keyboardShortcuts"

const debug = debugging("skip-silence:contents:index")

export const config: PlasmoContentScript = {
  matches: ["<all_urls>"],
  all_frames: true
}

const state = getState(StateEnvironment.Content)

state.once("ready", () => {
  setupBrowserContent(state)
  if (state.current.analyserType !== AnalyserType.tabCapture) {
    debug("Using on-page analyser")
    setupOnPageSkipperContent(state)
  } else if (isMv3) {
    // MV3: tabCaptureはコンテンツスクリプトで処理（バックグラウンドからstreamIdを受け取る）
    debug("MV3: Using tabCapture in content script")
    setupMv3TabCaptureListener(state)
    browser.runtime.sendMessage({ command: "request-activation" })
  } else {
    // MV2: tabCaptureはバックグラウンドで処理
    debug("MV2: Delegating tabCapture to background")
    browser.runtime.sendMessage({ command: "request-activation" })
  }

  setupKeyboardShortcuts(state)
})

/**
 * MV3: バックグラウンドから送られてくるtabCaptureのstreamIdを待ち受ける
 */
function setupMv3TabCaptureListener(state: ReturnType<typeof getState>) {
  browser.runtime.onMessage.addListener((request) => {
    if (request.command === "tabCapture-stream-id" && request.streamId) {
      debug("MV3: Received tab capture stream ID from background")
      setupTabCaptureInContentScript(state, request.streamId)
    }
  })
}

export default () => {
  const config = state
  return <Bar config={config} />
}
export const getStyle = () => {
  const style = document.createElement("style")
  style.textContent = cssText
  return style
}
