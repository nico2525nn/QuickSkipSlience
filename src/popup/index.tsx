import { StateEnvironment } from "@vantezzen/plasmo-state"
import "fontsource-poppins"
import "fontsource-poppins/600.css"
import React, { Component } from "react"
import browser from "webextension-polyfill"

import getState, { TabState } from "~shared/state"

import LocalPlayerInfo from "../shared/components/localPlayerInfo"
import VUMeter from "../shared/components/vuMeter"
import "./Popup.scss"
import Footer from "./components/Footer"
import SettingsForm from "./components/SettingsForm"
import Header from "./components/header"
import "./index.scss"

class Popup extends Component {
  tabState?: TabState
  isComponentMounted = false

  state = {
    isLocalPlayer: false,
    isSecureContext: true
  }

  constructor(props: object) {
    super(props)

    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      if (tabs[0] && tabs[0].id) {
        this.setupConfigProvider(tabs[0].id!)
        const url = new URL(tabs[0].url!)

        if (url.protocol === "file:") {
          this.setState({ isLocalPlayer: true })
        }

        if (
          url.protocol === "http:" &&
          url.hostname !== "localhost" &&
          url.hostname !== "127.0.0.1"
        ) {
          this.setState({ isSecureContext: false })
        }
      }
    })
  }

  private setupConfigProvider(tabId: number) {
    this.tabState = getState(StateEnvironment.Popup, tabId)
    this.forceUpdate()
    this.tabState.addListener("change", () => {
      if (this.isComponentMounted) this.forceUpdate()
    })
  }

  componentDidMount() {
    this.isComponentMounted = true
  }

  componentWillUnmount() {
    this.isComponentMounted = false
  }

  render() {
    if (!this.tabState) return null

    const grayOutWhenDisabled = {
      opacity: this.tabState?.current?.enabled ? 1 : 0.3,
      transition: "all 0.3s"
    }

    return (
      <div>
        <div className="App">
          {this.state.isLocalPlayer ? (
            <LocalPlayerInfo />
          ) : (
            <>
              <Header />
              <div style={grayOutWhenDisabled}>
                <VUMeter config={this.tabState} />
              </div>
              <SettingsForm
                config={this.tabState}
                isSecureContext={this.state.isSecureContext}
              />
            </>
          )}
        </div>
        <Footer />
      </div>
    )
  }
}

export default Popup
