import browser from "webextension-polyfill"

import { isMv3 } from "~shared/platform"
import { AnalyserType, TabState } from "~shared/state"

import debug from "../../../shared/debug"
import SilenceSkipper from "../../../shared/lib/SilenceSkipper"
import { getTabCaptureStreamInContentScript } from "../../../shared/lib/Utils"
import type { MediaElement } from "../../../shared/types"
import inspectMediaElements from "../inspectMediaElements"

export default function setupOnPageSkipperContent(config: TabState) {
  const { analyserType } = config.current

  if (analyserType === AnalyserType.element) {
    inspectMediaElements((element: MediaElement) => {
      debug("Main: Attaching skipper to new element", element)

      browser.runtime.sendMessage({ command: "hasElement" })

      new SilenceSkipper(config, element)
    })
  } else if (analyserType === AnalyserType.displayMedia) {
    debug("Main: Using display media for capture")
    new SilenceSkipper(config)
  }
}

/**
 * MV3: tabCapture用のSilenceSkipperをコンテンツスクリプトでセットアップする
 * バックグラウンドから受け取ったstreamIdでMediaStreamを取得して処理する
 */
export async function setupTabCaptureInContentScript(
  config: TabState,
  streamId: string
) {
  debug("MV3: Setting up tab capture in content script")
  try {
    const stream = await getTabCaptureStreamInContentScript(streamId)
    debug("MV3: Got tab capture stream, creating SilenceSkipper")
    new SilenceSkipper(config, undefined, stream)
  } catch (e) {
    debug("MV3: Failed to setup tab capture in content script", e)
  }
}
