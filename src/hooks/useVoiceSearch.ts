import { useState, useRef, useCallback } from "react";

export type VoiceState = "idle" | "recording" | "transcribing";

interface UseVoiceSearchReturn {
  voiceState: VoiceState;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  error: string | null;
  clearError: () => void;
}

const MAX_RECORDING_MS = 10_000;

export function useVoiceSearch(
  onTranscription: (text: string) => void
): UseVoiceSearchReturn {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, []);

  const transcribe = useCallback(
    async (blob: Blob) => {
      setVoiceState("transcribing");
      try {
        const file = new File([blob], "recording.webm", { type: "audio/webm" });
        const form = new FormData();
        form.append("audio", file);

        const res = await fetch("/api/transcribe", {
          method: "POST",
          body: form,
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Transcription failed (${res.status})`);
        }

        const data: { text: string; latency_ms: number } = await res.json();
        const text = data.text?.trim();
        if (text) {
          onTranscription(text);
        } else {
          setError("No speech detected. Try again.");
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Transcription failed"
        );
      } finally {
        setVoiceState("idle");
      }
    },
    [onTranscription]
  );

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.stop();
    }
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Your browser doesn't support microphone access.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const msg =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone permission denied. Please allow access and try again."
          : "Could not access microphone.";
      setError(msg);
      return;
    }

    streamRef.current = stream;
    chunksRef.current = [];

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";

    const recorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      cleanup();
      if (blob.size > 0) {
        transcribe(blob);
      } else {
        setVoiceState("idle");
        setError("No audio recorded. Try again.");
      }
    };

    recorder.onerror = () => {
      cleanup();
      setVoiceState("idle");
      setError("Recording failed. Please try again.");
    };

    recorder.start();
    setVoiceState("recording");

    timerRef.current = setTimeout(() => {
      stopRecording();
    }, MAX_RECORDING_MS);
  }, [cleanup, stopRecording, transcribe]);

  const clearError = useCallback(() => setError(null), []);

  return { voiceState, startRecording, stopRecording, error, clearError };
}
