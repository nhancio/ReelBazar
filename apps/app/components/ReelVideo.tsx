import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Image } from 'expo-image';
import { colors } from '@/theme';

interface Props {
  uri: string;
  thumbnailUri?: string | null;
  /**
   * True when this reel is the one the viewer is actually looking at. The feed derives it
   * from FlatList viewability — only the active reel plays, everything else is paused.
   */
  active: boolean;
  muted: boolean;
  onToggleMuted: () => void;
  /** Fired once, the first time this reel becomes active. */
  onFirstPlay?: () => void;
  height: number;
}

export function ReelVideo({
  uri,
  thumbnailUri,
  active,
  muted,
  onToggleMuted,
  onFirstPlay,
  height,
}: Props) {
  // One player instance per mounted card. That is affordable only because the feed keeps a
  // small render window (see windowSize/removeClippedSubviews in the feed screen) — an
  // unbounded list of players will exhaust the platform's decoder budget and stall playback.
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = muted;
  });

  useEffect(() => {
    player.muted = muted;
  }, [player, muted]);

  useEffect(() => {
    if (active) {
      player.play();
      onFirstPlay?.();
    } else {
      player.pause();
      // Rewind so a reel scrolled back to restarts rather than resuming mid-clip, which is
      // what every short-video feed does and what the web <video> did on remount.
      player.currentTime = 0;
    }
    // onFirstPlay is intentionally excluded: the feed recreates the callback each render,
    // and re-running this effect would restart playback on every parent update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, player]);

  return (
    <Pressable onPress={onToggleMuted} style={[styles.wrap, { height }]}>
      {/* Poster underneath the video so the card never flashes empty while the first
          frame decodes. thumbnailUrl is currently always null server-side (see app.MD
          "Functional Gaps" #13) — this renders correctly either way. */}
      {thumbnailUri ? (
        <Image
          source={{ uri: thumbnailUri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ) : null}

      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
        // The feed is inline-only; both of these add native surface area and are disabled
        // in the expo-video config plugin too.
        allowsPictureInPicture={false}
      />

      {/* Web autoplay policy: a video may only autoplay when muted. The feed therefore
          starts muted and this tap target is the unmute affordance on every platform. */}
      <View style={styles.tapHint} pointerEvents="none" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    backgroundColor: colors.videoBackdrop,
    overflow: 'hidden',
  },
  tapHint: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, },
});
