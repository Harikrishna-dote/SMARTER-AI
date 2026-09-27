import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { normalizeResponseForSpeech } from '../lib/responseFormatting';
import { extractSmartCommand, hasSmartWakeWord } from '../lib/voiceCommands';

interface SpeakOptions {
  rate?: number;
  pitch?: number;
  language?: string;
  onBoundary?: (charIndex: number, charLength: number) => void;
  onEnd?: () => void;
}

interface ListenOptions {
  handsFree?: boolean;
  wakeWord?: 'smart';
  requireWakeWord?: boolean;
  onInterimTranscript?: (text: string) => void;
}

interface VoiceController {
  speaking: boolean;
  listening: boolean;
  supported: boolean;
  speechSupported: boolean;
  recognitionSupported: boolean;
  teluguVoiceAvailable: boolean;
  hindiVoiceAvailable: boolean;
  voiceStatus: string;
  speak: (text: string, options?: SpeakOptions) => void;
  stop: () => void;
  startListening: (onTranscript: (text: string) => void, options?: ListenOptions) => void | Promise<void>;
  stopListening: () => void;
}

// Minimal typings for the (non-standard) Web Speech Recognition API.
interface SpeechRecognitionResultEvent {
  results: {
    [index: number]: {
      [index: number]: { transcript: string };
      isFinal?: boolean;
    };
    length: number;
  };
}
interface SpeechSynthesisBoundaryEventLike {
  charIndex: number;
  charLength: number;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

interface SpeechSegment {
  text: string;
  lang: string;
}

function availableVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
  return window.speechSynthesis.getVoices();
}

function chooseVoice(lang: string): SpeechSynthesisVoice | null {
  const voices = availableVoices();
  const normalized = lang.toLowerCase();
  return (
    voices.find((voice) => voice.lang.toLowerCase() === normalized) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith(normalized.split('-')[0])) ??
    voices.find((voice) => normalized.startsWith('te') && /telugu|te-/i.test(`${voice.name} ${voice.lang}`)) ??
    null
  );
}

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

function normalizeSpeechLanguage(language: string): string {
  if (language === 'te') return 'te-IN';
  if (language === 'hi') return 'hi-IN';
  if (language === 'bilingual') return 'en-IN';
  if (language === 'en') return 'en-IN';
  return language || 'en-IN';
}

function speechSegments(text: string, language: string): SpeechSegment[] {
  if (language !== 'bilingual') {
    return [{ text, lang: normalizeSpeechLanguage(language) }];
  }

  return text
    .split(/(?<=[.!?।])\s+|\n+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => ({
      text: part,
      lang: /[\u0C00-\u0C7F]/.test(part) ? 'te-IN' : /[\u0900-\u097F]/.test(part) ? 'hi-IN' : 'en-IN',
    }));
}

export function useVoice(language: string): VoiceController {
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceFeedback, setVoiceFeedback] = useState<string | null>(null);
  const [, setVoiceVersion] = useState(0);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const listeningGenerationRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const audioQueueRef = useRef<Blob[]>([]);
  const audioStreamDoneRef = useRef(true);
  const audioStreamCallbackRef = useRef<(() => void) | null>(null);
  const audioPlaybackErrorRef = useRef(false);
  const voiceRunRef = useRef(0);

  const speechSupported = typeof window !== 'undefined' && !!window.speechSynthesis;
  const recognitionSupported = typeof window !== 'undefined' && !!getRecognitionCtor();
  const mediaRecorderSupported = typeof window !== 'undefined'
    && typeof MediaRecorder !== 'undefined'
    && !!navigator.mediaDevices?.getUserMedia;
  const teluguVoiceAvailable = !!chooseVoice('te-IN');
  const hindiVoiceAvailable = !!chooseVoice('hi-IN');
  const supported = recognitionSupported || mediaRecorderSupported;
  const backendVoiceLanguage = language === 'te' || language === 'bilingual';
  const defaultVoiceStatus = !speechSupported && !backendVoiceLanguage
    ? 'Speech output is not available in this browser.'
    : backendVoiceLanguage
      ? teluguVoiceAvailable
        ? 'Telugu voice is available; backend Telugu audio is used first.'
        : 'Telugu audio uses backend TTS first. Native browser Telugu voice is the fallback.'
      : language === 'hi'
        ? hindiVoiceAvailable
          ? 'Hindi voice is available.'
          : 'Hindi text is ready. Install or enable a Hindi voice in your browser/OS for native Hindi audio.'
      : 'Speech output is ready.';
  const voiceStatus = voiceFeedback ?? defaultVoiceStatus;

  const playQueuedAudio = useCallback(() => {
    if (audioRef.current) return;
    const nextChunk = audioQueueRef.current.shift();
    if (!nextChunk) {
      if (audioStreamDoneRef.current) {
        setSpeaking(false);
        const onEnd = audioStreamCallbackRef.current;
        audioStreamCallbackRef.current = null;
        onEnd?.();
      }
      return;
    }

    const objectUrl = URL.createObjectURL(nextChunk);
    const audio = new Audio(objectUrl);
    audioRef.current = audio;
    audioUrlRef.current = objectUrl;
    const finishChunk = () => {
      audio.onended = null;
      audio.onerror = null;
      if (audioUrlRef.current === objectUrl) {
        URL.revokeObjectURL(objectUrl);
        audioUrlRef.current = null;
      }
      if (audioRef.current === audio) audioRef.current = null;
      playQueuedAudioRef.current();
    };
    audio.onended = finishChunk;
    audio.onerror = finishChunk;
    void audio.play().catch(() => {
      audioPlaybackErrorRef.current = true;
      finishChunk();
    });
  }, []);
  const playQueuedAudioRef = useRef<() => void>(() => undefined);
  playQueuedAudioRef.current = playQueuedAudio;

  const stop = useCallback(() => {
    voiceRunRef.current += 1;
    audioQueueRef.current = [];
    audioStreamDoneRef.current = true;
    audioStreamCallbackRef.current = null;
    const audio = audioRef.current;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    async (text: string, options: SpeakOptions = {}) => {
      const speakLanguage = options.language ?? language;
      const hasTeluguText = /[\u0C00-\u0C7F]/.test(text);
      const hasLatinText = /[A-Za-z]/.test(text);
      const effectiveLanguage = hasTeluguText && (speakLanguage !== 'te' || hasLatinText) ? 'bilingual' : speakLanguage;
      const useBackendVoice = effectiveLanguage === 'te' || effectiveLanguage === 'bilingual';
      if (!speechSupported && !useBackendVoice) return;
      stop();

      const spokenText = normalizeResponseForSpeech(text);
      if (!spokenText) {
        options.onEnd?.();
        return;
      }

      setSpeaking(true);

      // Use backend TTS first for multilingual classroom speech.
      if (effectiveLanguage === 'te' || effectiveLanguage === 'bilingual') {
        const runId = voiceRunRef.current;
        audioQueueRef.current = [];
        audioStreamDoneRef.current = false;
        audioStreamCallbackRef.current = options.onEnd ?? null;
        audioPlaybackErrorRef.current = false;
        try {
          let receivedChunk = false;
            await api.synthesizeStream(spokenText, effectiveLanguage, (audioBlob) => {
            if (voiceRunRef.current !== runId) return;
            receivedChunk = true;
            audioQueueRef.current.push(audioBlob);
            playQueuedAudioRef.current();
          }, options.rate ?? 1);
          if (voiceRunRef.current !== runId) return;
          audioStreamDoneRef.current = true;
          playQueuedAudioRef.current();
          if (!receivedChunk || audioPlaybackErrorRef.current) throw new Error('Voice stream returned no playable audio');
          return;
        } catch (error) {
          if (voiceRunRef.current !== runId) return;
          stop();
          console.error('Piper TTS synthesis failed, falling back to browser-native voice:', error);
        }
      }

      if (!speechSupported) {
        setSpeaking(false);
        setVoiceFeedback('Audio playback is unavailable in this browser. The tutor answer is still shown in the conversation.');
        options.onEnd?.();
        return;
      }

      // Fallback or standard English uses browser native TTS
      const segments = speechSegments(spokenText, effectiveLanguage);
      let index = 0;
      let offset = 0;

      const speakNext = () => {
        const segment = segments[index];
        if (!segment) {
          setSpeaking(false);
          options.onEnd?.();
          return;
        }

        const utterance = new SpeechSynthesisUtterance(segment.text);
        utterance.lang = segment.lang;
        const voice = chooseVoice(segment.lang);
        if (voice) utterance.voice = voice;
        utterance.rate = options.rate ?? 1;
        utterance.pitch = options.pitch ?? 1;
        utterance.onboundary = (event: SpeechSynthesisBoundaryEventLike) => {
          options.onBoundary?.(offset + (event.charIndex ?? 0), event.charLength ?? 0);
        };
        utterance.onend = () => {
          offset += segment.text.length + 1;
          index += 1;
          speakNext();
        };
        utterance.onerror = () => {
          offset += segment.text.length + 1;
          index += 1;
          speakNext();
        };
        window.speechSynthesis.speak(utterance);
      };

      speakNext();
    },
    [language, speechSupported, stop],
  );

  const startListening = useCallback(
    async (onTranscript: (text: string) => void, options: ListenOptions = {}) => {
      const Ctor = getRecognitionCtor();
      const requireWakeWord = options.requireWakeWord === true && options.wakeWord === 'smart';
      setVoiceFeedback(null);

      // Smart wake word mode must remain in the browser so the microphone can
      // stay open and detect the phrase before sending a command. For Telugu
      // and bilingual recording, use the configured backend Whisper path so
      // mixed-language speech is transcribed consistently across browsers.
      const preferBackendRecorder = !requireWakeWord && (language === 'te' || language === 'bilingual' || !Ctor);
      if (preferBackendRecorder && mediaRecorderSupported) {
        const generation = ++listeningGenerationRef.current;
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          if (generation !== listeningGenerationRef.current) {
            stream.getTracks().forEach((track) => track.stop());
            return;
          }

          const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
            .find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? '';
          const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
          const chunks: Blob[] = [];
          mediaStreamRef.current = stream;
          mediaRecorderRef.current = recorder;
          mediaChunksRef.current = chunks;
          recorder.ondataavailable = (event) => {
            if (event.data.size > 0) chunks.push(event.data);
          };
          recorder.onstop = () => {
            if (mediaRecorderRef.current === recorder) mediaRecorderRef.current = null;
            if (mediaStreamRef.current === stream) mediaStreamRef.current = null;
            stream.getTracks().forEach((track) => track.stop());
            if (generation === listeningGenerationRef.current) setListening(false);
            const audio = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
            if (!audio.size || generation !== listeningGenerationRef.current) return;
            const extension = recorder.mimeType.includes('mp4') ? 'm4a' : 'webm';
            void api.transcribeAudio(audio, `voice.${extension}`)
              .then((result) => {
                const transcript = result.text?.trim() ?? '';
                const unavailableMessage = result.language === 'unknown'
                  || transcript.toLowerCase().includes('local stt engine is not configured');
                if (generation === listeningGenerationRef.current && transcript && !unavailableMessage) {
                  setVoiceFeedback(null);
                  onTranscript(transcript);
                } else if (generation === listeningGenerationRef.current) {
                  setVoiceFeedback(unavailableMessage
                    ? 'Voice transcription is unavailable right now. Type your question below to receive the tutor answer.'
                    : 'I could not understand the audio. Please try again or type your question below.');
                }
              })
              .catch((error) => {
                if (generation === listeningGenerationRef.current) {
                  setVoiceFeedback('Voice input failed. You can type your question below and still receive the tutor answer.');
                }
                console.error('Backend voice transcription failed:', error);
              });
          };
          setListening(true);
          recorder.start();
          return;
        } catch (error) {
          mediaRecorderRef.current = null;
          mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
          // If the browser recognizer exists, permission/codec failures can
          // still use the browser path rather than disabling voice entirely.
          if (!Ctor) {
            setListening(false);
            setVoiceFeedback('Microphone input is unavailable. Type your question below to continue.');
            console.error('Backend voice recording could not start:', error);
            return;
          }
        }
      }

      if (!Ctor) {
        setVoiceFeedback('Microphone input is unavailable. Type your question below to continue.');
        return;
      }
      const generation = ++listeningGenerationRef.current;
      const recognition = new Ctor();
      let wakeArmed = false;
      let wakeTimer: ReturnType<typeof setTimeout> | undefined;
      const armWakeWord = () => {
        wakeArmed = true;
        if (wakeTimer) clearTimeout(wakeTimer);
        wakeTimer = setTimeout(() => { wakeArmed = false; }, 8_000);
      };
      recognition.lang = normalizeSpeechLanguage(language);
      recognition.continuous = !!options.handsFree || requireWakeWord;
      recognition.interimResults = !!options.handsFree || requireWakeWord || !!options.onInterimTranscript;
      recognition.onresult = (event: SpeechRecognitionResultEvent) => {
        if (generation !== listeningGenerationRef.current) return;
        let finalTranscript = '';
        let interimTranscript = '';
        for (let index = 0; index < event.results.length; index += 1) {
          const result = event.results[index];
          const transcript = result?.[0]?.transcript ?? '';
          if (result?.isFinal) finalTranscript += transcript;
          else interimTranscript += transcript;
        }
        if (interimTranscript.trim() && !requireWakeWord) options.onInterimTranscript?.(interimTranscript.trim());
        const finalText = finalTranscript.trim();
        if (!finalText) return;
        if (requireWakeWord) {
          const command = extractSmartCommand(finalText);
          if (command) {
            wakeArmed = false;
            if (wakeTimer) clearTimeout(wakeTimer);
            recognition.stop();
            setListening(false);
            onTranscript(command);
          } else if (hasSmartWakeWord(finalText)) {
            armWakeWord();
          } else if (wakeArmed) {
            wakeArmed = false;
            if (wakeTimer) clearTimeout(wakeTimer);
            recognition.stop();
            setListening(false);
            onTranscript(finalText);
          }
          return;
        }
        onTranscript(finalText);
      };
      recognition.onend = () => {
        if (wakeTimer) clearTimeout(wakeTimer);
        if (generation === listeningGenerationRef.current) recognitionRef.current = null;
        setListening(false);
      };
      recognition.onerror = () => {
        if (wakeTimer) clearTimeout(wakeTimer);
        if (generation === listeningGenerationRef.current) recognitionRef.current = null;
        setListening(false);
        if (generation === listeningGenerationRef.current) {
          setVoiceFeedback('Voice input could not hear you. Please try again or type your question below.');
        }
      };
      recognitionRef.current = recognition;
      setListening(true);
      try {
        recognition.start();
      } catch {
        setListening(false);
      }
    },
    [language],
  );

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    const recorder = mediaRecorderRef.current;
    if (!recorder) listeningGenerationRef.current += 1;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    setListening(false);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = () => setVoiceVersion((version) => version + 1);
      window.speechSynthesis.getVoices();
    }
    return () => {
      voiceRunRef.current += 1;
      audioQueueRef.current = [];
      audioStreamDoneRef.current = true;
      audioStreamCallbackRef.current = null;
      audioRef.current?.pause();
      audioRef.current = null;
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        window.speechSynthesis.onvoiceschanged = null;
      }
      listeningGenerationRef.current += 1;
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaRecorderRef.current = null;
      mediaStreamRef.current = null;
    };
  }, []);

  return {
    speaking,
    listening,
    supported,
    speechSupported,
    recognitionSupported,
    teluguVoiceAvailable,
    hindiVoiceAvailable,
    voiceStatus,
    speak,
    stop,
    startListening,
    stopListening,
  };
}
