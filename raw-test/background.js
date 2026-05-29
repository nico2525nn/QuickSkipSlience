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
  chrome.storage.local.get({ logs: [] }, ({ logs }) => {
    logs.push({ at: new Date().toISOString(), context: "background", level, message });
    chrome.storage.local.set({ logs: logs.slice(-300) });
  });
}

log("log", "Background loaded");

const OFFSCREEN_DOCUMENT_PATH = "offscreen.html";

let creatingOffscreenDocument;

async function sendToOffscreen(message) {
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      const response = await chrome.runtime.sendMessage(message);
      log("log", "sendToOffscreen response:", response || null);
      return response;
    } catch (e) {
      log("warn", `sendToOffscreen attempt ${attempt} failed:`, e.message);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  throw new Error("Offscreen document did not accept runtime message");
}

async function ensureOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH);
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [offscreenUrl]
  });

  if (existingContexts.length > 0) {
    log("log", "Offscreen document already exists");
    return;
  }

  if (!creatingOffscreenDocument) {
    log("log", "Creating offscreen document");
    creatingOffscreenDocument = chrome.offscreen.createDocument({
      url: OFFSCREEN_DOCUMENT_PATH,
      reasons: ["USER_MEDIA"],
      justification: "Analyze tab audio from chrome.tabCapture with Web Audio"
    });
  }

  await creatingOffscreenDocument;
  creatingOffscreenDocument = undefined;
  log("log", "Offscreen document ready");
}

chrome.action.onClicked.addListener(async (tab) => {
  log("log", "Action clicked, tabId:", tab.id);

  try {
    await ensureOffscreenDocument();

    const streamId = await chrome.tabCapture.getMediaStreamId({
      targetTabId: tab.id
    });
    log("log", "Got streamId:", streamId?.slice(0, 20) + "...");

    await sendToOffscreen({
      target: "offscreen",
      command: "tabCapture-stream-id",
      streamId,
      tabId: tab.id
    });
  } catch (e) {
    log("error", "start capture error:", e.message, e);
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.command === "request-activation") {
    const tabId = request.tabId || sender.tab?.id;
    log("log", "request-activation, tabId:", tabId);
    if (!tabId) return;

    (async () => {
      try {
        await ensureOffscreenDocument();
        const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
        log("log", "Got streamId:", streamId?.slice(0, 20) + "...");
        await sendToOffscreen({
          target: "offscreen",
          command: "tabCapture-stream-id",
          streamId,
          tabId
        });
        sendResponse({ ok: true });
      } catch (e) {
        log("error", "request-activation error:", e.message, e);
        sendResponse({ ok: false, error: e.message });
      }
    })();
    return true;
  }
});
