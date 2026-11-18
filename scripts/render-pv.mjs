import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const keyframesOnly = process.argv.includes('--keyframes-only')
const fps = Number(process.env.PV_FPS || 24)
const durationSec = 38
const totalFrames = durationSec * fps

const browserExe = process.env.BROWSER_EXE || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
].find(existsSync)

const ffmpegExe = process.env.FFMPEG_EXE || 'ffmpeg'

function outputMatch(child, stream, pattern) {
  return new Promise((resolve, reject) => {
    let output = ''
    const timer = setTimeout(() => reject(new Error(`Startup timed out: ${output.slice(-800)}`)), 20000)
    child.once('error', (err) => { clearTimeout(timer); reject(err) })
    child.once('exit', (code) => { clearTimeout(timer); reject(new Error(`Exited (${code}): ${output.slice(-800)}`)) })
    stream.on('data', (chunk) => {
      output += chunk
      const match = output.match(pattern)
      if (match) {
        clearTimeout(timer)
        resolve(match[1])
      }
    })
  })
}

/**
 * Synthesizes a 38.0-second stereo 44.1kHz 16-bit WAV soundtrack:
 * - 122 BPM Persona 5 Acid-Jazz / Heist Groove (Funk Bass, Rhodes 9th chords, Syncopated Drums, Lead Riff)
 * - Exact millisecond-synced UI & Heist Sound Effects (Slash, Stamp Slam, Comic Burst, Menu Tick)
 */
function synthesizePvAudioWav(durationSeconds = 38) {
  const sampleRate = 44100
  const numSamples = Math.floor(durationSeconds * sampleRate)
  const left = new Float32Array(numSamples)
  const right = new Float32Array(numSamples)

  const bpm = 122
  const beatSec = 60 / bpm
  const stepSec = beatSec / 4 // 16th note

  // Helper: deterministic pseudo-noise
  let seed = 1337
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return (seed / 0xffffffff) * 2 - 1
  }

  const addTone = (startSec, durSec, freqStart, freqEnd, ampL, ampR, wave = 'saw', decay = 6) => {
    const i0 = Math.max(0, Math.floor(startSec * sampleRate))
    const i1 = Math.min(numSamples, Math.floor((startSec + durSec) * sampleRate))
    let phase = 0
    for (let i = i0; i < i1; i += 1) {
      const t = (i - i0) / sampleRate
      const p = t / durSec
      const freq = freqStart + (freqEnd - freqStart) * p
      phase += (2 * Math.PI * freq) / sampleRate
      const env = Math.min(1, t / 0.004) * Math.exp(-decay * p)
      let s = 0
      if (wave === 'saw') {
        s = 2 * ((phase / (2 * Math.PI)) - Math.floor(0.5 + phase / (2 * Math.PI)))
      } else if (wave === 'square') {
        s = Math.sin(phase) >= 0 ? 0.8 : -0.8
      } else if (wave === 'tri') {
        s = (2 / Math.PI) * Math.asin(Math.sin(phase))
      } else {
        s = Math.sin(phase) + 0.35 * Math.sin(phase * 2) + 0.15 * Math.sin(phase * 3)
      }
      left[i] += s * env * ampL
      right[i] += s * env * ampR
    }
  }

  const addNoiseHit = (startSec, durSec, ampL, ampR, decay = 18, hp = false) => {
    const i0 = Math.max(0, Math.floor(startSec * sampleRate))
    const i1 = Math.min(numSamples, Math.floor((startSec + durSec) * sampleRate))
    let prev = 0
    for (let i = i0; i < i1; i += 1) {
      const t = (i - i0) / sampleRate
      const p = t / durSec
      const env = Math.min(1, t / 0.002) * Math.exp(-decay * p)
      const raw = rand()
      const n = hp ? raw - prev * 0.82 : raw
      prev = raw
      left[i] += n * env * ampL
      right[i] += n * env * ampR
    }
  }

  // 1. Acid-Jazz Groove Loop (Emin9 -> A13 -> Cmaj9 -> B7#9)
  const totalSteps = Math.floor(durationSeconds / stepSec)
  const bassRoots = [82.41, 110.0, 65.41, 61.74] // E2, A2, C2, B1
  const chordVoicings = [
    [164.81, 196.0, 246.94, 293.66, 369.99], // Em9
    [220.0, 277.18, 329.63, 392.0, 440.0],   // A13
    [130.81, 164.81, 196.0, 246.94, 293.66], // Cmaj9
    [123.47, 155.56, 185.0, 220.0, 293.66],  // B7#9
  ]
  const bassPattern = [
    1, 0, 0, 1, 0, 0, 1, 0,
    0, 1, 0, 0, 1, 0, 1, 1,
  ]
  const leadNotes = [
    659.25, 0, 587.33, 659.25, 0, 783.99, 0, 739.99,
    659.25, 0, 587.33, 493.88, 0, 440.0, 493.88, 0,
  ]

  for (let step = 0; step < totalSteps; step += 1) {
    const t = step * stepSec + (step % 2 === 1 ? stepSec * 0.14 : 0) // Acid-jazz swing
    const bar = Math.floor(step / 16)
    const stepInBar = step % 16
    const chordIdx = bar % 4

    // Kick on 0, 3, 6, 10
    if (stepInBar === 0 || stepInBar === 3 || stepInBar === 6 || stepInBar === 10) {
      addTone(t, 0.18, 125, 42, 0.34, 0.34, 'sine', 9)
      addNoiseHit(t, 0.025, 0.08, 0.08, 30, true)
    }
    // Snare on 4, 12 (+ ghost note on 15)
    if (stepInBar === 4 || stepInBar === 12) {
      addTone(t, 0.12, 210, 115, 0.18, 0.18, 'tri', 12)
      addNoiseHit(t, 0.16, 0.24, 0.24, 14, false)
    } else if (stepInBar === 15 && bar % 2 === 1) {
      addNoiseHit(t, 0.08, 0.09, 0.09, 20, false)
    }
    // Hi-hat on every 8th + open hat on 2, 14
    if (stepInBar === 2 || stepInBar === 14) {
      addNoiseHit(t, 0.14, 0.07, 0.09, 9, true)
    } else if (stepInBar % 2 === 0) {
      addNoiseHit(t, 0.045, 0.05, 0.06, 26, true)
    }

    // Syncopated Funk Bass
    if (bassPattern[stepInBar]) {
      const root = bassRoots[chordIdx]
      const mult = stepInBar === 14 ? 1.5 : stepInBar === 15 ? 2.0 : 1.0
      addTone(t, stepSec * 1.45, root * mult, root * mult, 0.20, 0.20, 'saw', 5.5)
      addTone(t, stepSec * 1.45, root * mult * 0.5, root * mult * 0.5, 0.18, 0.18, 'sine', 4.5)
    }

    // Jazzy Rhodes Chord Stabs on 0, 6, 11
    if (stepInBar === 0 || stepInBar === 6 || stepInBar === 11) {
      const dur = stepInBar === 6 ? stepSec * 2.8 : stepSec * 1.8
      const voicing = chordVoicings[chordIdx]
      voicing.forEach((freq, idx) => {
        const pan = idx / (voicing.length - 1)
        addTone(t, dur, freq, freq, 0.055 * (1 - pan * 0.4), 0.055 * (0.6 + pan * 0.4), 'sine', 4.2)
      })
    }

    // P5 Lead Violin/Synth Motif on odd bars
    const leadFreq = leadNotes[stepInBar]
    if (leadFreq && (bar % 2 === 1 || bar >= 14)) {
      addTone(t, stepSec * 1.35, leadFreq * 0.992, leadFreq, 0.065, 0.08, 'saw', 4.8)
    }
  }

  // 2. Synced UI & Heist Sound Effects matching pv.html CUES
  const playSlash = (sec) => {
    addNoiseHit(sec, 0.22, 0.28, 0.28, 10, true)
    addTone(sec, 0.18, 1100, 150, 0.20, 0.22, 'saw', 7)
  }
  const playSlam = (sec) => {
    addTone(sec, 0.28, 175, 36, 0.38, 0.38, 'tri', 6.5)
    addNoiseHit(sec, 0.18, 0.25, 0.25, 12, false)
    ;[440, 554.37, 659.25].forEach((f) => addTone(sec, 0.22, f, f * 0.98, 0.08, 0.08, 'saw', 7))
  }
  const playBurst = (sec) => {
    ;[523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
      addTone(sec + idx * 0.018, 0.24, f, f * 1.02, 0.11, 0.11, 'saw', 6)
    })
    addNoiseHit(sec, 0.14, 0.18, 0.18, 14, true)
  }
  const playTick = (sec) => {
    addTone(sec, 0.05, 1480, 740, 0.11, 0.11, 'square', 18)
  }

  // Cue timestamps in seconds
  ;[0.02, 1.8, 5.5, 12.65, 14.6, 17.4, 20.1, 26.5, 30.0, 34.8].forEach(playSlash)
  ;[6.5, 7.7, 8.9].forEach(playBurst)
  ;[0.05, 10.2, 22.1, 23.0, 25.4, 28.0, 32.1, 33.8, 35.45].forEach(playSlam)
  ;[3.1, 4.2, 9.8, 12.1, 15.5, 16.3, 18.7, 21.2, 24.2, 27.4, 29.1, 31.0, 33.0].forEach(playTick)

  // Fade out last 0.8s and soft-clip master bus
  const fadeStart = (durationSeconds - 0.8) * sampleRate
  const pcm = Buffer.alloc(44 + numSamples * 4)
  pcm.write('RIFF', 0)
  pcm.writeUInt32LE(36 + numSamples * 4, 4)
  pcm.write('WAVE', 8)
  pcm.write('fmt ', 12)
  pcm.writeUInt32LE(16, 16)
  pcm.writeUInt16LE(1, 20) // PCM
  pcm.writeUInt16LE(2, 22) // Stereo
  pcm.writeUInt32LE(sampleRate, 24)
  pcm.writeUInt32LE(sampleRate * 4, 28)
  pcm.writeUInt16LE(4, 32)
  pcm.writeUInt16LE(16, 34)
  pcm.write('data', 36)
  pcm.writeUInt32LE(numSamples * 4, 40)

  for (let i = 0; i < numSamples; i += 1) {
    const fade = i > fadeStart ? Math.max(0, 1 - (i - fadeStart) / (numSamples - fadeStart)) : 1
    const l = Math.tanh(left[i] * fade * 0.95)
    const r = Math.tanh(right[i] * fade * 0.95)
    pcm.writeInt16LE(Math.round(l * 32767), 44 + i * 4)
    pcm.writeInt16LE(Math.round(r * 32767), 44 + i * 4 + 2)
  }
  return pcm
}

const workDir = await mkdtemp(join(tmpdir(), 'dsh-cc-pv-'))
const server = spawn(process.execPath, ['scripts/preview-server.mjs'], {
  cwd: root,
  env: { ...process.env, PORT: '0' },
  stdio: ['ignore', 'pipe', 'pipe'],
})

let browser
try {
  const base = await outputMatch(server, server.stdout, /preview (http:\/\/127\.0\.0\.1:\d+)/)
  browser = spawn(
    browserExe,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--no-first-run',
      '--no-default-browser-check',
      '--hide-scrollbars',
      '--remote-debugging-port=0',
      `--user-data-dir=${join(workDir, 'profile')}`,
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] }
  )
  const wsEndpoint = await outputMatch(browser, browser.stderr, /DevTools listening on (ws:\/\/[^\s]+)/)
  const socket = new WebSocket(wsEndpoint)
  await once(socket, 'open')

  let nextId = 0
  const pending = new Map()
  let sessionId = null

  socket.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data)
    if (msg.id && pending.has(msg.id)) {
      const req = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) req.reject(new Error(JSON.stringify(msg.error)))
      else req.resolve(msg.result)
    }
  })

  const send = (method, params = {}, target = sessionId) => {
    const id = ++nextId
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id)
        reject(new Error(`CDP timeout: ${method}`))
      }, 20000)
      pending.set(id, {
        resolve: (res) => { clearTimeout(timer); resolve(res) },
        reject,
      })
      socket.send(JSON.stringify({ id, method, params, ...(target ? { sessionId: target } : {}) }))
    })
  }

  const evaluate = async (expression) => {
    const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (res.exceptionDetails) throw new Error(JSON.stringify(res.exceptionDetails))
    return res.result?.value
  }

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' }, null)
  ;({ sessionId } = await send('Target.attachToTarget', { targetId, flatten: true }, null))
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  })

  await send('Page.navigate', { url: `${base}/pv.html?record=1` })
  await evaluate(`new Promise((resolve, reject) => {
    const t0 = performance.now();
    const check = () => {
      if (window.__pvReady) resolve(true);
      else if (performance.now() - t0 > 10000) reject('PV boot timeout');
      else setTimeout(check, 25);
    };
    check();
  })`)
  await evaluate('document.fonts.ready.then(() => true)')

  const shotsDir = join(root, 'shots', 'pv-keyframes')
  await mkdir(shotsDir, { recursive: true })

  // Keyframe timestamps covering all 6 Acts + sub-shots
  const KEYFRAMES = [
    [600, '01-intro-calling-card'],
    [2500, '02-act1-hero-landing'],
    [4500, '03-act1-slanted-nav-and-rows'],
    [5750, '04-act2-star-band-transition'],
    [7950, '05-act2-comic-sfx-burst'],
    [10800, '06-act2-collage-letters-switch'],
    [13200, '07-act3a-attachment-and-trigger-open'],
    [16000, '08-act3b-tool-rows-code-terminal'],
    [18500, '09-act3c-approval-stopped-error-board'],
    [21600, '10-act3d-deliverable-file-tickets'],
    [24400, '11-act4a-open-with-and-plus-menus'],
    [26800, '12-act4b-context-submenu-and-dossier'],
    [28800, '13-act4c-model-and-permission-selector'],
    [31200, '14-act5a-desktop-window-chrome'],
    [34100, '15-act5b-collapsed-96px-rail-and-more'],
    [36400, '16-act6-finale-calling-card'],
  ]

  for (const [ms, name] of KEYFRAMES) {
    await evaluate(`window.__pvStepTo(${ms})`)
    const { data } = await send('Page.captureScreenshot', { format: 'png' })
    const outPath = join(shotsDir, `${name}.png`)
    await writeFile(outPath, Buffer.from(data, 'base64'))
    console.log(`saved keyframe: ${outPath}`)
  }

  if (!keyframesOnly) {
    // Reset to t=0 before full sequential recording
    await evaluate('location.reload()')
    await evaluate(`new Promise((resolve, reject) => {
      const t0 = performance.now();
      const check = () => {
        if (window.__pvReady) resolve(true);
        else if (performance.now() - t0 > 10000) reject('PV reload timeout');
        else setTimeout(check, 25);
      };
      check();
    })`)
    await evaluate('document.fonts.ready.then(() => true)')

    const framesDir = join(workDir, 'frames')
    await mkdir(framesDir, { recursive: true })
    const wavPath = join(workDir, 'pv-audio.wav')
    await writeFile(wavPath, synthesizePvAudioWav(durationSec))
    console.log(`synthesized audio track: ${wavPath}`)

    for (let f = 0; f < totalFrames; f += 1) {
      const timeMs = (f / fps) * 1000
      await evaluate(`window.__pvStepTo(${timeMs.toFixed(2)})`)
      const { data } = await send('Page.captureScreenshot', { format: 'jpeg', quality: 92 })
      const frameFile = join(framesDir, `frame-${String(f).padStart(5, '0')}.jpg`)
      await writeFile(frameFile, Buffer.from(data, 'base64'))
      if (f % (fps * 4) === 0 || f === totalFrames - 1) {
        console.log(`captured frame ${f + 1}/${totalFrames} (${(timeMs / 1000).toFixed(1)}s)`)
      }
    }

    const mediaDir = join(root, 'media')
    await mkdir(mediaDir, { recursive: true })
    const mp4Path = join(mediaDir, 'dsh-calling-card-pv.mp4')

    await new Promise((resolve, reject) => {
      const ff = spawn(
        ffmpegExe,
        [
          '-y',
          '-framerate', String(fps),
          '-i', join(framesDir, 'frame-%05d.jpg'),
          '-i', wavPath,
          '-c:v', 'libx264',
          '-preset', 'fast',
          '-crf', '18',
          '-pix_fmt', 'yuv420p',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-shortest',
          '-movflags', '+faststart',
          mp4Path,
        ],
        { stdio: 'inherit' }
      )
      ff.once('error', reject)
      ff.once('exit', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))))
    })
    console.log(`rendered MP4 PV: ${mp4Path}`)
  }

  await send('Browser.close', {}, null)
  socket.close()
} finally {
  browser?.kill()
  server?.kill()
  await rm(workDir, { recursive: true, force: true }).catch(() => {})
}
