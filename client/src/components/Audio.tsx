import React, { useCallback, useEffect, useRef, useState } from 'react'
import styled from '@emotion/styled'

// @ts-ignore
window.AudioContext = window.AudioContext || window.webkitAudioContext

/* CONST */
const SMOOTHING = 0.5
const FFT_SIZE = 2048

// 引数で定めた範囲の数をランダムに返す。
const rand = (min: number, max: number) => Math.random() * (max - min) + min

class Loader {
  url: string
  onLoad: (buffer: AudioBuffer) => void
  audioCtx: AudioContext

  constructor(
    url: string,
    callback: (buffer: AudioBuffer) => void,
    audioCtx: AudioContext
  ) {
    this.url = url
    this.onLoad = callback
    this.audioCtx = audioCtx
  }

  loadBuffer() {
    const request = new XMLHttpRequest()
    request.open('GET', this.url, true)
    request.responseType = 'arraybuffer'

    request.onload = (event: ProgressEvent) => {
      this.audioCtx.decodeAudioData(
        request.response,
        (buffer) => {
          if (!buffer) {
            console.log('error')
            return
          }
          this.onLoad(buffer)
        },
        (error) => {
          console.log('decodeAudioData error')
        }
      )
    }

    request.onerror = () => {
      console.log('Loader: XHR error')
    }

    request.send()
  }
}

/**
 * ビジュアライザー
 */
class Visualizer {
  audioCtx: AudioContext
  ctx: CanvasRenderingContext2D
  numBars: number
  analyser: AnalyserNode
  freqs: Uint8Array
  times: Uint8Array
  source: AudioBufferSourceNode

  constructor(
    buffer: AudioBuffer,
    audioCtx: AudioContext,
    ctx: CanvasRenderingContext2D
  ) {
    this.audioCtx = audioCtx
    this.ctx = ctx
    this.numBars = 128
    this.analyser = audioCtx.createAnalyser()
    this.analyser.connect(audioCtx.destination)
    this.analyser.minDecibels = -140
    this.analyser.maxDecibels = 0
    this.freqs = new Uint8Array(this.analyser.frequencyBinCount)
    this.times = new Uint8Array(this.analyser.frequencyBinCount)
    this.source = audioCtx.createBufferSource()
    this.source.connect(this.analyser)
    this.source.buffer = buffer
    this.source.loop = true
  }

  play() {
    this.source.start(0)
    this.draw()
  }

  draw() {
    this.analyser.smoothingTimeConstant = SMOOTHING
    this.analyser.fftSize = FFT_SIZE
    this.analyser.getByteFrequencyData(this.freqs)
    this.ctx.globalCompositeOperation = 'destination-out'
    this.ctx.fillStyle = 'rgba(0, 0, 0, 1)'
    this.ctx.fillRect(0, 0, window.innerWidth, window.innerHeight)
    this.ctx.globalCompositeOperation = 'source-over'

    for (let index = 0; index < this.numBars; index += 1) {
      this.drawTop(index)
    }

    for (let index = 0; index < this.analyser.frequencyBinCount; index += 1) {
      this.drawBottom(index)
    }

    window.requestAnimationFrame(this.draw.bind(this))
  }

  drawTop(index: number) {
    const barWidth = window.innerWidth / 128 / 2
    const spacerWidth = barWidth * 2
    const height = this.freqs[index] - 160
    const hue = (index / 128) * 360

    this.ctx.fillStyle = 'hsl(' + hue + ', 100%, 50%)'

    if (height > 40) {
      this.ctx.fillRect(
        index * spacerWidth,
        window.innerHeight,
        barWidth,
        -height * 5
      )
    }
    if (height > 35) {
      this.ctx.fillRect(
        index * spacerWidth,
        window.innerHeight,
        barWidth,
        -height * 4
      )
    }
    if (height > 0) {
      this.ctx.fillRect(
        index * spacerWidth,
        window.innerHeight,
        barWidth,
        -height * 3
      )
    }
    if (height < 0) {
      this.ctx.fillRect(
        index * spacerWidth,
        window.innerHeight,
        barWidth,
        -rand(1, 5)
      )
    }
  }

  drawBottom(index: number) {
    const barWidth = window.innerWidth / this.analyser.frequencyBinCount
    const height = this.freqs[index]
    const hue = (index / this.analyser.frequencyBinCount) * 360

    this.ctx.fillStyle = 'hsl(' + hue + ', 100%, 50%)'
    this.ctx.fillRect(
      index * barWidth,
      window.innerHeight / 2,
      barWidth,
      -height
    )
  }
}

const Wrapper = styled.div`
  background: black;
`

const Button = styled.button`
  cursor: pointer;
  position: absolute;
  top: 10px;
  left: 10px;
  width: 200px;
  padding: 20px;
  text-align: center;
  border: 1px solid #fff;
  border-radius: 4px;
`

export const Audio: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null)
  const [visualizer, setVisualizer] = useState<Visualizer>()
  const [audioCtx, setAudioCtx] = useState<AudioContext>()

  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.width = window.innerWidth
      canvasRef.current.height = window.innerHeight
      setCtx(canvasRef.current.getContext('2d'))
    }
  }, [])

  useEffect(() => {
    setAudioCtx(new AudioContext())
  }, [])

  const initVisualizer = useCallback(
    (buffer: AudioBuffer) => {
      if (!audioCtx || !ctx) return
      setVisualizer(new Visualizer(buffer, audioCtx, ctx))
    },
    [audioCtx, ctx]
  )

  useEffect(() => {
    if (!audioCtx) return
    const loader = new Loader(
      'http://localhost:8080/sample.mp3',
      initVisualizer,
      audioCtx
    )
    loader.loadBuffer()
  }, [audioCtx, initVisualizer])

  const handleClick = useCallback(() => {
    visualizer && visualizer.play()
  }, [visualizer])

  return (
    <Wrapper>
      <Button onClick={handleClick}>クリックして再生</Button>
      <canvas ref={canvasRef} />
      <audio ref={audioRef} src="http://localhost:8080/sample.mp3" />
    </Wrapper>
  )
}
