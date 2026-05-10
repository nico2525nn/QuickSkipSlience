import createVADModule from "./vendor/ten_vad"

type TenVadModule = {
  HEAP16: Int16Array
  HEAP32: Int32Array
  HEAPF32: Float32Array
  _malloc(size: number): number
  _free(ptr: number): void
  _ten_vad_create(
    vadHandlePtr: number,
    hopSize: number,
    threshold: number
  ): number
  _ten_vad_process(
    vadHandle: number,
    audioPtr: number,
    audioSize: number,
    probPtr: number,
    flagPtr: number
  ): number
  _ten_vad_destroy(vadHandlePtr: number): void
}

export type TenVadResult = {
  available: boolean
  isSpeech: boolean
  probability: number
}

const TEN_VAD_SAMPLE_RATE = 16000
const TEN_VAD_HOP_SIZE = 256
const TEN_VAD_THRESHOLD = 0.5

export function downsampleTo16kPcm(
  samples: Float32Array,
  inputSampleRate: number,
  frameSize = TEN_VAD_HOP_SIZE
) {
  const pcm = new Int16Array(frameSize)
  const ratio = inputSampleRate / TEN_VAD_SAMPLE_RATE

  for (let i = 0; i < frameSize; i++) {
    const sourceIndex = Math.min(
      samples.length - 1,
      Math.floor(i * ratio)
    )
    const clamped = Math.max(-1, Math.min(1, samples[sourceIndex] || 0))
    pcm[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff
  }

  return pcm
}

export default class TenVadDetector {
  private vad?: TenVadModule
  private vadHandlePtr = 0
  private vadHandle = 0
  private audioPtr = 0
  private probPtr = 0
  private flagPtr = 0
  private initPromise?: Promise<void>
  private failed = false

  get isAvailable() {
    return !!this.vad && !this.failed
  }

  async init() {
    if (this.failed || this.vad) return
    if (!this.initPromise) {
      this.initPromise = this.load()
    }
    await this.initPromise
  }

  private async load() {
    try {
      const wasmUrl = chrome.runtime.getURL("assets/external/ten_vad.wasm")
      const wasmBinary = new Uint8Array(await (await fetch(wasmUrl)).arrayBuffer())
      const vad = (await createVADModule({
        wasmBinary,
        noInitialRun: false,
        noExitRuntime: true
      })) as TenVadModule

      this.vadHandlePtr = vad._malloc(4)
      const result = vad._ten_vad_create(
        this.vadHandlePtr,
        TEN_VAD_HOP_SIZE,
        TEN_VAD_THRESHOLD
      )
      if (result !== 0) {
        throw new Error(`TEN VAD initialization failed: ${result}`)
      }

      this.vad = vad
      this.vadHandle = vad.HEAP32[this.vadHandlePtr >> 2]
      this.audioPtr = vad._malloc(TEN_VAD_HOP_SIZE * 2)
      this.probPtr = vad._malloc(4)
      this.flagPtr = vad._malloc(4)
    } catch (error) {
      this.failed = true
      throw error
    }
  }

  async detect(
    samples: Float32Array,
    inputSampleRate: number
  ): Promise<TenVadResult> {
    try {
      await this.init()
    } catch {
      return { available: false, isSpeech: false, probability: 0 }
    }

    if (!this.vad) {
      return { available: false, isSpeech: false, probability: 0 }
    }

    try {
      const pcm = downsampleTo16kPcm(samples, inputSampleRate)
      this.vad.HEAP16.set(pcm, this.audioPtr >> 1)

      const result = this.vad._ten_vad_process(
        this.vadHandle,
        this.audioPtr,
        TEN_VAD_HOP_SIZE,
        this.probPtr,
        this.flagPtr
      )

      if (result !== 0) {
        return { available: false, isSpeech: false, probability: 0 }
      }
    } catch {
      return { available: false, isSpeech: false, probability: 0 }
    }

    return {
      available: true,
      isSpeech: this.vad.HEAP32[this.flagPtr >> 2] === 1,
      probability: this.vad.HEAPF32[this.probPtr >> 2]
    }
  }

  destroy() {
    if (!this.vad) return

    if (this.audioPtr) this.vad._free(this.audioPtr)
    if (this.probPtr) this.vad._free(this.probPtr)
    if (this.flagPtr) this.vad._free(this.flagPtr)
    if (this.vadHandlePtr) {
      this.vad._ten_vad_destroy(this.vadHandlePtr)
      this.vad._free(this.vadHandlePtr)
    }

    this.vad = undefined
    this.vadHandlePtr = 0
    this.vadHandle = 0
    this.audioPtr = 0
    this.probPtr = 0
    this.flagPtr = 0
  }
}
