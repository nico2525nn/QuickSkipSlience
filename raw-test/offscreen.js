const LOG_PREFIX = "[TabCaptureTest]";

function log(level, ...args) {
  const message = args
    .map((arg) => {
      if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
      if (typeof arg === "string") return arg;
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(" ");
  console[level](`${LOG_PREFIX} ${message}`);
}

log("log", "Offscreen document loaded");

let currentStream;
let currentAudioContext;
let readTimer;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.target !== "offscreen") return;

  if (request.command === "tabCapture-stream-id") {
    log(
      "log",
      "Offscreen received streamId:",
      request.streamId?.slice(0, 20) + "...",
      "tabId:",
      request.tabId
    );
    startCapture(request.streamId).catch((e) => {
      log("error", "Offscreen startCapture FAILED:", e.message, e.name, e);
    });
    sendResponse({ ok: true });
    return false;
  }
});

async function startCapture(streamId) {
  stopPreviousCapture();

  log("log", "Offscreen startCapture called");

  currentStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId
      }
    },
    video: false
  });
  log("log", "getUserMedia SUCCESS");

  const tracks = currentStream.getAudioTracks();
  log("log", "Audio tracks:", tracks.length);
  tracks.forEach((track, i) => {
    log(
      "log",
      `[TabCaptureTest] Track ${i}: enabled=${track.enabled} muted=${track.muted} readyState=${track.readyState}`,
      JSON.stringify(track.getSettings())
    );
  });

  if (tracks.length === 0) {
    log("error", "No audio tracks");
    return;
  }

  currentAudioContext = new AudioContext();
  log("log", "AudioContext state:", currentAudioContext.state);

  if (currentAudioContext.state !== "running") {
    await currentAudioContext.resume();
    log("log", "AudioContext resumed:", currentAudioContext.state);
  }

  const source = currentAudioContext.createMediaStreamSource(currentStream);
  const analyser = currentAudioContext.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);

  const monitorGain = currentAudioContext.createGain();
  monitorGain.gain.value = 1;
  source.connect(monitorGain);
  monitorGain.connect(currentAudioContext.destination);

  log("log", "Audio pipeline ready");

  const buf = new Float32Array(analyser.fftSize);
  let count = 0;

  const read = async () => {
    count++;

    if (!currentAudioContext || currentAudioContext.state === "closed") return;

    if (currentAudioContext.state !== "running") {
      log("log", "AudioContext not running:", currentAudioContext.state);
      try {
        await currentAudioContext.resume();
      } catch (e) {
        log("warn", "AudioContext resume retry failed:", e.message);
      }
      readTimer = setTimeout(read, 100);
      return;
    }

    analyser.getFloatTimeDomainData(buf);
    let peak = 0;
    let sumSq = 0;
    for (const v of buf) {
      const abs = Math.abs(v);
      if (abs > peak) peak = abs;
      sumSq += v * v;
    }
    const rms = Math.sqrt(sumSq / buf.length);

    if (count <= 10 || count % 10 === 0) {
      log(
        "log",
        `[TabCaptureTest] #${count}: peak=${peak.toExponential(2)} rms=${rms.toExponential(2)} vol=${(rms * 5000).toFixed(1)}`
      );
    }

    readTimer = setTimeout(read, 100);
  };

  readTimer = setTimeout(read, 300);
}

function stopPreviousCapture() {
  if (readTimer) {
    clearTimeout(readTimer);
    readTimer = undefined;
  }

  if (currentStream) {
    for (const track of currentStream.getTracks()) {
      track.stop();
    }
    currentStream = undefined;
  }

  if (currentAudioContext && currentAudioContext.state !== "closed") {
    currentAudioContext.close().catch(() => {});
    currentAudioContext = undefined;
  }
}
