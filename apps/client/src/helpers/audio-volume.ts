import { isVolumeBoosted, volumePercentToGain } from '@sharkord/shared';
import { applyAudioOutputDevice } from './audio-output';

type TRemoteAudioGraph = {
  source: MediaStreamAudioSourceNode;
  gain: GainNode;
  destination: MediaStreamAudioDestinationNode;
  stream: MediaStream;
};

type TApplyRemoteAudioElementArgs = {
  audioElement: HTMLAudioElement | null;
  stream: MediaStream | undefined;
  volumePercent: number;
  playbackId: string | undefined;
  isDeafened: boolean;
};

// every boosted stream shares one context. browsers cap how many a page may hold
// and the elements live as long as their voice session, so it is never closed
let sharedContext: AudioContext | null = null;

// the graph is cached per element: building one per volume change would leak a
// context on every slider tick
const elementGraphs = new WeakMap<HTMLAudioElement, TRemoteAudioGraph>();

const getSharedContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;

  if (typeof window.AudioContext === 'undefined') return null;

  if (!sharedContext || sharedContext.state === 'closed') {
    sharedContext = new window.AudioContext();
  }

  return sharedContext;
};

const resumeContext = (context: AudioContext) => {
  // a context created outside a user gesture starts suspended and would swallow
  // the stream, so it is resumed on every apply
  if (context.state !== 'suspended') return;

  context.resume().catch(() => {
    // the element keeps playing, only the boost stays silent until the next try
  });
};

const buildGraph = (
  audioElement: HTMLAudioElement,
  stream: MediaStream
): TRemoteAudioGraph | null => {
  const context = getSharedContext();

  if (!context) return null;

  try {
    const source = context.createMediaStreamSource(stream);
    const gain = context.createGain();
    const destination = context.createMediaStreamDestination();

    source.connect(gain);
    gain.connect(destination);
    resumeContext(context);

    const graph: TRemoteAudioGraph = { source, gain, destination, stream };

    elementGraphs.set(audioElement, graph);

    return graph;
  } catch (error) {
    // a missing graph must not take the stream down: the caller falls back to the
    // plain element playback
    console.warn('Failed to build the audio gain graph:', error);

    return null;
  }
};

const dropGraph = (
  audioElement: HTMLAudioElement,
  graph: TRemoteAudioGraph
) => {
  graph.source.disconnect();
  elementGraphs.delete(audioElement);
};

// wires a remote stream to its audio element and applies the stored level. a
// boost cannot be expressed as HTMLMediaElement.volume, so it runs through a gain
// node instead. the element stays the sink owner by playing the processed stream,
// which keeps its own setSinkId working, and the graph is only built for streams
// that need one
const applyRemoteAudioElement = ({
  audioElement,
  stream,
  volumePercent,
  playbackId,
  isDeafened
}: TApplyRemoteAudioElementArgs) => {
  if (!audioElement || !stream) return;

  audioElement.muted = isDeafened;

  const gainValue = volumePercentToGain(volumePercent);
  const cachedGraph = elementGraphs.get(audioElement);

  if (cachedGraph && cachedGraph.stream !== stream) {
    dropGraph(audioElement, cachedGraph);
  }

  const cachedForStream = elementGraphs.get(audioElement);
  const graph =
    cachedForStream ??
    (isVolumeBoosted(volumePercent) ? buildGraph(audioElement, stream) : null);

  if (!graph) {
    if (audioElement.srcObject !== stream) {
      audioElement.srcObject = stream;
    }

    // the browser rejects anything above 1 with an IndexSizeError, so the element
    // gets a clamped level whenever there is no graph to carry the boost
    audioElement.volume = Math.min(1, gainValue);

    applyAudioOutputDevice(audioElement, playbackId);

    return;
  }

  const { gain, destination } = graph;

  gain.gain.value = gainValue;
  audioElement.volume = 1;

  if (audioElement.srcObject !== destination.stream) {
    audioElement.srcObject = destination.stream;
  }

  applyAudioOutputDevice(audioElement, playbackId);
};

export { applyRemoteAudioElement };
