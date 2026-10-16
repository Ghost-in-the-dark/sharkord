import { applyRemoteAudioElement } from '@/helpers/audio-volume';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';

type TFakeSourceNode = {
  stream: MediaStream;
  connections: unknown[];
  connect: (target: unknown) => void;
  disconnect: () => void;
};

const createFakeContext = () => {
  const state = { sources: [] as TFakeSourceNode[], resumeCalls: 0 };

  const context = {
    state: 'suspended',
    resume: async () => {
      state.resumeCalls += 1;
      context.state = 'running';
    },
    createMediaStreamSource: (stream: MediaStream) => {
      const node: TFakeSourceNode = {
        stream,
        connections: [],
        connect: (target) => {
          node.connections.push(target);
        },
        disconnect: () => {
          node.connections = [];
        }
      };
      state.sources.push(node);
      return node;
    },
    createGain: () => ({
      gain: { value: 1 },
      connections: [] as unknown[],
      connect(target: unknown) {
        this.connections.push(target);
      },
      disconnect: () => {}
    }),
    createMediaStreamDestination: () => ({
      stream: { id: 'processed' } as unknown as MediaStream
    })
  };

  return { context, state };
};

const createFakeElement = () => {
  let appliedVolume = 1;

  return {
    srcObject: null as MediaStream | null,
    muted: false,
    get volume() {
      return appliedVolume;
    },
    set volume(value: number) {
      // the real element rejects anything above 1, which is why the boost cannot
      // be applied here
      if (value > 1) throw new RangeError('IndexSizeError');
      appliedVolume = value;
    }
  };
};

const rawStream = { id: 'raw' } as unknown as MediaStream;

const { context, state } = createFakeContext();
const originalWindow = globalThis.window;

// the helper keeps one context for the page, so the fake has to be shared by every
// test in this file and the assertions count deltas rather than totals
beforeAll(() => {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      AudioContext: function AudioContext() {
        return context;
      }
    }
  });
});

afterAll(() => {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: originalWindow,
    writable: true
  });
});

describe('applyRemoteAudioElement', () => {
  test('should keep the element on the raw stream at or below the default volume', () => {
    const element = createFakeElement();

    applyRemoteAudioElement({
      audioElement: element as unknown as HTMLAudioElement,
      stream: rawStream,
      volumePercent: 50,
      playbackId: undefined,
      isDeafened: false
    });

    expect(element.srcObject).toBe(rawStream);
    expect(element.volume).toBe(0.5);
  });

  test('should reject a boost through the element volume instead of the graph', () => {
    const element = createFakeElement();

    // the graph is what makes the boost possible, a plain assignment would throw
    expect(() => {
      element.volume = 4;
    }).toThrow('IndexSizeError');

    applyRemoteAudioElement({
      audioElement: element as unknown as HTMLAudioElement,
      stream: rawStream,
      volumePercent: 400,
      playbackId: undefined,
      isDeafened: false
    });

    expect(element.volume).toBe(1);
  });

  test('should route a boosted element through a gain node that produced its stream', () => {
    const element = createFakeElement();
    const before = state.sources.length;

    applyRemoteAudioElement({
      audioElement: element as unknown as HTMLAudioElement,
      stream: rawStream,
      volumePercent: 400,
      playbackId: undefined,
      isDeafened: false
    });

    expect(state.sources.length - before).toBe(1);
    expect(element.srcObject).not.toBe(rawStream);
    expect(element.srcObject).not.toBeNull();
  });

  test('should reuse the graph across volume changes instead of building a new one', () => {
    const element = createFakeElement();
    const before = state.sources.length;

    for (const volumePercent of [200, 300, 400, 100]) {
      applyRemoteAudioElement({
        audioElement: element as unknown as HTMLAudioElement,
        stream: rawStream,
        volumePercent,
        playbackId: undefined,
        isDeafened: false
      });
    }

    expect(state.sources.length - before).toBe(1);
    // dropping the graph when the level returns below the default would audibly cut
    // the stream, so the element keeps playing the processed one
    expect(element.srcObject).not.toBe(rawStream);
  });

  test('should rebuild the graph when the element gets a different stream', () => {
    const element = createFakeElement();
    const before = state.sources.length;

    for (const stream of [
      rawStream,
      { id: 'next' } as unknown as MediaStream
    ]) {
      applyRemoteAudioElement({
        audioElement: element as unknown as HTMLAudioElement,
        stream,
        volumePercent: 200,
        playbackId: undefined,
        isDeafened: false
      });
    }

    expect(state.sources.length - before).toBe(2);
  });

  test('should forward the deafen state to the element', () => {
    const element = createFakeElement();

    applyRemoteAudioElement({
      audioElement: element as unknown as HTMLAudioElement,
      stream: rawStream,
      volumePercent: 400,
      playbackId: undefined,
      isDeafened: true
    });

    expect(element.muted).toBe(true);
  });

  test('should do nothing without an element or a stream', () => {
    const before = state.sources.length;

    applyRemoteAudioElement({
      audioElement: null,
      stream: rawStream,
      volumePercent: 400,
      playbackId: undefined,
      isDeafened: false
    });

    applyRemoteAudioElement({
      audioElement: createFakeElement() as unknown as HTMLAudioElement,
      stream: undefined,
      volumePercent: 400,
      playbackId: undefined,
      isDeafened: false
    });

    expect(state.sources.length).toBe(before);
  });

  test('should fall back to the plain element when the audio context is unavailable', () => {
    const element = createFakeElement();
    const stream = { id: 'no-context' } as unknown as MediaStream;

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {}
    });

    applyRemoteAudioElement({
      audioElement: element as unknown as HTMLAudioElement,
      stream,
      volumePercent: 400,
      playbackId: undefined,
      isDeafened: false
    });

    expect(element.srcObject).toBe(stream);
    // the boost is lost, but the stream still plays at a level the browser accepts
    expect(element.volume).toBe(1);

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        AudioContext: function AudioContext() {
          return context;
        }
      }
    });
  });
});
