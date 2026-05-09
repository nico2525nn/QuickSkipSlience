export const isChromium = navigator.userAgent.includes("Chrome")
export const isMv3 = process.env.PLASMO_MANIFEST_VERSION === "mv3"
export const supportsTabCapture = isChromium
