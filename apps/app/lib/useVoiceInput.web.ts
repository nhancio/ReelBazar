import { useCallback, useEffect, useRef, useState } from 'react';

export interface VoiceInput {
  supported: boolean;
  listening: boolean;
  unavailableReason: string | null;
  start: () => void;
  stop: () => void;
}

/** The vendor-prefixed constructor is still the only one Safari exposes. */
function getRecognitionCtor(): any | null {
  if (typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition ?? null;
}

/**
 * Dictation via the Web Speech API — a platform feature, so no dependency and no API key.
 * Chrome and Safari support it; Firefox does not, which is why `supported` is reported rather
 * than assumed.
 */
export function useVoiceInput(onResult: (text: string) => void): VoiceInput {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  // Held in a ref so restarting recognition never needs a fresh effect run.
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const Ctor = getRecognitionCtor();
  const supported = Boolean(Ctor);

  useEffect(() => {
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.lang = 'en-IN';
    recognition.continuous = false;
    // Interim results let the input fill in as the person speaks instead of only at the end.
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        transcript += event.results[i][0].transcript;
      }
      onResultRef.current(transcript.trim());
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;

    return () => {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try {
        recognition.abort();
      } catch {
        // Already stopped.
      }
      recognitionRef.current = null;
    };
  }, [Ctor]);

  const start = useCallback(() => {
    if (!recognitionRef.current || listening) return;
    try {
      recognitionRef.current.start();
      setListening(true);
    } catch {
      // start() throws if called while already running; treat as a no-op.
    }
  }, [listening]);

  const stop = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch {
      // Already stopped.
    }
    setListening(false);
  }, []);

  return {
    supported,
    listening,
    unavailableReason: supported ? null : 'This browser does not support voice input.',
    start,
    stop,
  };
}
