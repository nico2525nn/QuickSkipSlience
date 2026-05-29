const LOG_PREFIX = "[SkipSilenceTabCapture]";

let currentStream;
let currentAudioContext;
let readTimer;
let currentTabId;

function log(level, ...args) {
  console[level](LOG_PREFIX, ...args);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.target !== "tab-capture-offscreen") return;

  if (request.command === "start") {
    sendResponse({ ok: true });
    startCapture(request.streamId, request.tabId).catch((error) => {
      log("error", "startCapture failed", error.message, error.name, error);
      chrome.runtime.sendMessage({
        command: "tab-capture-error",
        tabId: request.tabId,
        error: `${error.name}: ${error.message}`
      });
    });
    return false;
  }

  if (request.command === "stop") {
    stopCapture();
    sendResponse({ ok: true });
    return false;
  }
});

async function startCapture(streamId, tabId) {
  stopCapture();
  currentTabId = tabId;
  log("log", "starting capture", tabId);

  currentStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId
      }
    },
    video: false
  });

  const tracks = currentStream.getAudioTracks();
  log("log", "getUserMedia success, audio tracks", tracks.length);
  tracks.forEach((track, index) => {
    log(
      "log",
      `track ${index}: enabled=${track.enabled} muted=${track.muted} readyState=${track.readyState}`,
      track.getSettings()
    );
  });

  currentAudioContext = new AudioContext();
  if (currentAudioContext.state !== "running") {
    await currentAudioContext.resume();
  }

  const source = currentAudioContext.createMediaStreamSource(currentStream);
  const analyser = currentAudioContext.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);

  const monitorGain = currentAudioContext.createGain();
  monitorGain.gain.value = 1;
  source.connect(monitorGain);
  monitorGain.connect(currentAudioContext.destination);

  const buffer = new Float32Array(analyser.fftSize);
  let count = 0;

  const read = () => {
    if (!currentAudioContext || currentAudioContext.state === "closed") return;

    analyser.getFloatTimeDomainData(buffer);
    let peak = 0;
    let sumSq = 0;

    for (const value of buffer) {
      const abs = Math.abs(value);
      if (abs > peak) peak = abs;
      sumSq += value * value;
    }

    const rms = Math.sqrt(sumSq / buffer.length);
    const volume = rms * 5000;
    count++;

    if (count <= 10 || count % 40 === 0) {
      log(
        "log",
        `#${count}: peak=${peak.toExponential(2)} rms=${rms.toExponential(2)} vol=${volume.toFixed(1)}`
      );
    }

    chrome.runtime.sendMessage({
      command: "tab-capture-volume",
      tabId: currentTabId,
      volume
    });

    readTimer = setTimeout(read, 25);
  };

  readTimer = setTimeout(read, 25);
}

function stopCapture() {
  if (readTimer) {
    clearTimeout(readTimer);
    readTimer = undefined;
  }

  if (currentStream) {
    currentStream.getTracks().forEach((track) => track.stop());
    currentStream = undefined;
  }

  if (currentAudioContext && currentAudioContext.state !== "closed") {
    currentAudioContext.close().catch(() => {});
  }
  currentAudioContext = undefined;
  currentTabId = undefined;
}
