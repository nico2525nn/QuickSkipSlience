import { describe, expect, test } from "vitest"

import { downsampleTo16kPcm } from "./TenVadDetector"

describe("downsampleTo16kPcm", () => {
  test("creates a 16 kHz TEN VAD frame", () => {
    const input = new Float32Array(2048)
    input[0] = -1
    input[3] = 0.5

    const frame = downsampleTo16kPcm(input, 48000)

    expect(frame).toHaveLength(256)
    expect(frame[0]).toBe(-32768)
    expect(frame[1]).toBe(16383)
  })

  test("clips samples to int16 range", () => {
    const input = new Float32Array([2, -2])

    const frame = downsampleTo16kPcm(input, 16000, 2)

    expect(frame[0]).toBe(32767)
    expect(frame[1]).toBe(-32768)
  })
})
