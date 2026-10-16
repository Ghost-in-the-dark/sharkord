import { useDevices } from '@/components/devices-provider/hooks/use-devices';
import { useVolumeControl } from '@/components/voice-provider/volume-control-context';
import { useIsOwnUser } from '@/features/server/users/hooks';
import { useVoice } from '@/features/server/voice/hooks';
import { applyRemoteAudioElement } from '@/helpers/audio-volume';
import { StreamKind } from '@sharkord/shared';
import { useEffect, useMemo } from 'react';
import { useAudioLevel } from './use-audio-level';

const useVoiceRefs = (
  remoteId: number,
  externalStream?: { pluginId: string; streamKey: string }
) => {
  const isExternalStream = !!externalStream;
  const {
    remoteUserStreams,
    externalStreams,
    localAudioStream,
    localVideoStream,
    localScreenShareStream,
    ownVoiceState,
    getOrCreateRefs
  } = useVoice();
  // an external stream has no owner, and its id is not from the user id space
  const isOwnUser = useIsOwnUser(isExternalStream ? null : remoteId);
  const {
    getVolume,
    getUserVolumeKey,
    getUserScreenVolumeKey,
    getExternalVolumeKey
  } = useVolumeControl();
  const { devices } = useDevices();

  const {
    videoRef,
    audioRef,
    screenShareRef,
    screenShareAudioRef,
    externalAudioRef,
    externalVideoRef
  } = getOrCreateRefs(remoteId, isExternalStream);

  const videoStream = useMemo(() => {
    if (isOwnUser) return localVideoStream;

    return remoteUserStreams[remoteId]?.[StreamKind.VIDEO];
  }, [remoteUserStreams, remoteId, isOwnUser, localVideoStream]);

  const audioStream = useMemo(() => {
    if (isOwnUser) return undefined;

    return remoteUserStreams[remoteId]?.[StreamKind.AUDIO];
  }, [remoteUserStreams, remoteId, isOwnUser]);

  const audioStreamForLevel = useMemo(() => {
    if (isOwnUser) return localAudioStream;

    return remoteUserStreams[remoteId]?.[StreamKind.AUDIO];
  }, [remoteUserStreams, remoteId, isOwnUser, localAudioStream]);

  const screenShareStream = useMemo(() => {
    if (isOwnUser) return localScreenShareStream;

    return remoteUserStreams[remoteId]?.[StreamKind.SCREEN];
  }, [remoteUserStreams, remoteId, isOwnUser, localScreenShareStream]);

  const screenShareAudioStream = useMemo(() => {
    if (isOwnUser) return undefined;

    return remoteUserStreams[remoteId]?.[StreamKind.SCREEN_AUDIO];
  }, [remoteUserStreams, remoteId, isOwnUser]);

  const externalAudioStream = useMemo(
    () => externalStreams[remoteId]?.audioStream,
    [externalStreams, remoteId]
  );

  const externalVideoStream = useMemo(
    () => externalStreams[remoteId]?.videoStream,
    [externalStreams, remoteId]
  );

  const { audioLevel, isSpeaking, speakingIntensity, speakingEffectClass } =
    useAudioLevel(audioStreamForLevel);

  const userVolumeKey = getUserVolumeKey(remoteId);
  const userVolume = getVolume(userVolumeKey);

  const userScreenVolumeKey = getUserScreenVolumeKey(remoteId);
  const userScreenVolume = getVolume(userScreenVolumeKey);

  const externalVolumeKey = externalStream
    ? getExternalVolumeKey(externalStream.pluginId, externalStream.streamKey)
    : null;

  const externalVolume = externalVolumeKey ? getVolume(externalVolumeKey) : 100;

  useEffect(() => {
    if (!videoStream || !videoRef.current) return;

    videoRef.current.srcObject = videoStream;
  }, [videoStream, videoRef]);

  useEffect(() => {
    applyRemoteAudioElement({
      audioElement: audioRef.current,
      stream: audioStream,
      volumePercent: userVolume,
      playbackId: devices.playbackId,
      isDeafened: ownVoiceState.soundMuted
    });
  }, [
    audioStream,
    audioRef,
    userVolume,
    devices.playbackId,
    ownVoiceState.soundMuted
  ]);

  useEffect(() => {
    applyRemoteAudioElement({
      audioElement: screenShareAudioRef.current,
      stream: screenShareAudioStream,
      volumePercent: userScreenVolume,
      playbackId: devices.playbackId,
      isDeafened: ownVoiceState.soundMuted
    });
  }, [
    screenShareAudioStream,
    screenShareAudioRef,
    userScreenVolume,
    devices.playbackId,
    ownVoiceState.soundMuted
  ]);

  useEffect(() => {
    if (!screenShareStream || !screenShareRef.current) return;

    if (screenShareRef.current.srcObject !== screenShareStream) {
      screenShareRef.current.srcObject = screenShareStream;
    }
  }, [screenShareStream, screenShareRef]);

  useEffect(() => {
    applyRemoteAudioElement({
      audioElement: externalAudioRef.current,
      stream: externalAudioStream,
      volumePercent: externalVolume,
      playbackId: devices.playbackId,
      isDeafened: ownVoiceState.soundMuted
    });
  }, [
    externalAudioStream,
    externalAudioRef,
    externalVolume,
    devices.playbackId,
    ownVoiceState.soundMuted
  ]);

  useEffect(() => {
    if (!externalVideoStream || !externalVideoRef.current) return;

    if (externalVideoRef.current.srcObject !== externalVideoStream) {
      externalVideoRef.current.srcObject = externalVideoStream;
    }
  }, [externalVideoStream, externalVideoRef]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = ownVoiceState.soundMuted;
    }

    if (screenShareAudioRef.current) {
      screenShareAudioRef.current.muted = ownVoiceState.soundMuted;
    }

    if (externalAudioRef.current) {
      externalAudioRef.current.muted = ownVoiceState.soundMuted;
    }
  }, [
    ownVoiceState.soundMuted,
    audioRef,
    screenShareAudioRef,
    externalAudioRef,
    audioStream,
    screenShareAudioStream,
    externalAudioStream
  ]);

  return {
    videoRef,
    audioRef,
    screenShareRef,
    screenShareAudioRef,
    externalAudioRef,
    externalVideoRef,
    hasAudioStream: !!audioStream,
    hasVideoStream: !!videoStream,
    hasScreenShareStream: !!screenShareStream,
    hasScreenShareAudioStream: !!screenShareAudioStream,
    hasExternalAudioStream: !!externalAudioStream,
    hasExternalVideoStream: !!externalVideoStream,
    audioLevel,
    isSpeaking,
    speakingIntensity,
    speakingEffectClass
  };
};

export { useVoiceRefs };
