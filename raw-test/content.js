console.log("[TabCaptureTest] Content script loaded, top frame:", window === window.top);

if (window === window.top) {
  chrome.runtime.onMessage.addListener((request) => {
    if (request.command === "tabCapture-stream-id") {
      console.log("[TabCaptureTest] Received streamId:", request.streamId?.slice(0, 20) + "...");
      startCapture(request.streamId);
    }
  });

  console.log("[TabCaptureTest] Content script ready. Click extension icon to start capture.");
}

async function startCapture(streamId) {
  console.log("[TabCaptureTest] startCapture called");

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: streamId } },
      video: false
    });
    console.log("[TabCaptureTest] getUserMedia SUCCESS");
  } catch (e) {
    console.error("[TabCaptureTest] getUserMedia FAILED:", e.message, e.name);
    return;
  }

  const tracks = stream.getAudioTracks();
  console.log("[TabCaptureTest] Audio tracks:", tracks.length);
  tracks.forEach((t, i) => {
    console.log(`[TabCaptureTest] Track ${i}: enabled=${t.enabled}`, JSON.stringify(t.getSettings()));
  });

  if (tracks.length === 0) {
    console.error("[TabCaptureTest] No audio tracks");
    return;
  }

  console.log("[TabCaptureTest] Creating AudioContext...");
  const ctx = new AudioContext();
  console.log("[TabCaptureTest] AudioContext state:", ctx.state);

  if (ctx.state !== "running") {
    try { await ctx.resume(); console.log("[TabCaptureTest] Resume OK"); }
    catch (e) { console.log("[TabCaptureTest] Resume failed:", e.message); }

    setInterval(async () => {
      if (ctx.state === "running") return;
      try { await ctx.resume(); } catch {}
    }, 500);
  }

  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  source.connect(analyser);
  source.connect(ctx.destination);
  console.log("[TabCaptureTest] Audio pipeline ready");

  const buf = new Float32Array(analyser.fftSize);
  let count = 0;

  function read() {
    count++;
    if (ctx.state !== "running") {
      if (count % 5 === 1) console.log("[TabCaptureTest] AudioContext not running");
      setTimeout(read, 100);
      return;
    }

    analyser.getFloatTimeDomainData(buf);
    let peak = 0, sumSq = 0;
    for (const v of buf) {
      const a = Math.abs(v);
      peak = Math.max(peak, a);
      sumSq += v * v;
    }
    const rms = Math.sqrt(sumSq / buf.length);

    if (count <= 3 || count % 100 === 0) {
      console.log(`[TabCaptureTest] #${count}: peak=${peak.toExponential(2)} rms=${rms.toExponential(2)} vol=${(rms*5000).toFixed(1)}`);
    }

    setTimeout(read, 100);
  }

  setTimeout(read, 300);
}
