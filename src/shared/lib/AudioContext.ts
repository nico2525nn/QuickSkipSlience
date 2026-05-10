/**
 * Create an audio context that is not suspended.
 * This will create a normal context. If the context is suspended,
 * it will make sure to require a user interaction to resume it.
 * 
 * @returns Audio Context
 */
export default function createAudioContextSecure(): Promise<AudioContext> {
  return new Promise((resolve, reject) => {

    const audioContext = new AudioContext();
    if (audioContext.state === 'suspended') {
      console.log('QuickSilence: AudioContext が一時停止中のため再開します');

      if (typeof document === 'undefined') {
        if (typeof chrome !== 'undefined' && chrome.offscreen) {
          chrome.offscreen.createDocument({
            url: 'offscreen.html',
            reasons: ['AUDIO_PLAYBACK'],
        justification: 'AudioContext を再開する'
          }).catch(() => {})
        }
        return
      }

      const resumeElement = document.createElement('div');
      resumeElement.setAttribute('style', 'position:absolute;z-index:999999;top:0;left:0;width:100vw;height:100vh;background-color:white;display:flex;justify-content:center;align-items:center;color: #212121;flex-direction: column;cursor:pointer;isolation: isolate;');
      resumeElement.innerHTML = `
        <h1>QuickSilence を開始するには操作が必要です</h1>
        <p>ブラウザーのセキュリティ制限により、音声解析の開始にはページ上での操作が必要です。</p>
        <p>ページ内の任意の場所をクリックしてください。</p>
      `;
      document.body.appendChild(resumeElement);
      resumeElement.addEventListener('click', async () => {
        await audioContext.resume();
        resumeElement.remove();
        resolve(audioContext);
      });
    } else {
      resolve(audioContext);
    }
  });
}
