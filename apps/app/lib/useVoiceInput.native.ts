export interface VoiceInput {
  supported: boolean;
  listening: boolean;
  /** Why voice is unavailable, if it is. Shown to the user rather than a dead mic button. */
  unavailableReason: string | null;
  start: () => void;
  stop: () => void;
}

/**
 * Native voice dictation is not wired up yet.
 *
 * The Expo SDK has no speech *recognition* module (expo-speech is text-to-speech, the other
 * direction). Doing this on device needs a native dependency — `expo-speech-recognition`
 * wraps SFSpeechRecognizer and Android's SpeechRecognizer — plus the
 * NSSpeechRecognitionUsageDescription / RECORD_AUDIO permissions and a fresh dev-client
 * build, which is blocked until the store credentials exist.
 *
 * Until then the AI screen shows a disabled mic with this reason and text entry works
 * normally. Web already has real dictation via useVoiceInput.web.ts.
 */
export function useVoiceInput(_onResult: (text: string) => void): VoiceInput {
  return {
    supported: false,
    listening: false,
    unavailableReason: 'Voice input needs a new app build — type your question for now.',
    start: () => {},
    stop: () => {},
  };
}
