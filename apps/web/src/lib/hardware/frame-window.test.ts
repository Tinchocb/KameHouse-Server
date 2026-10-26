import { describe, expect, it } from 'vitest'
import { createFrameWindow } from './frame-window'

describe('frame window', () => {
    it('incluye congelamientos de 250 ms y de varios segundos en primer plano', () => {
        const frames = createFrameWindow()
        expect(frames.sample(0)).toBeNull()
        expect(frames.sample(16)?.delta).toBe(16)
        expect(frames.sample(266)?.delta).toBe(250)
        expect(frames.sample(2266)).toEqual({ delta: 2000, fps: 1 })
    })

    it('no atribuye al hilo principal el tiempo sin foco o en segundo plano', () => {
        const frames = createFrameWindow()
        frames.sample(0)
        frames.sample(16)
        frames.reset()
        expect(frames.sample(60000)).toBeNull()
        expect(frames.sample(60016)).toEqual({ delta: 16, fps: 2 })
    })
})
