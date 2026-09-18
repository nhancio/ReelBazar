// Platform-split: Metro picks .web.ts on web, .native.ts on iOS/Android.
export { useVoiceInput } from './useVoiceInput.native';
export type { VoiceInput } from './useVoiceInput.native';
