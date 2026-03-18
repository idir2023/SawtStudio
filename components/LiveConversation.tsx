'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { User } from 'firebase/auth';

const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });

export default function LiveConversation({ user }: { user: User | null }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0);
  
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  
  // Audio playback
  const playbackContextRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef<number>(0);

  const startConversation = async () => {
    try {
      setIsConnecting(true);
      setError(null);

      // 1. Setup Audio Capture
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      
      const audioCtx = new window.AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;
      
      const source = audioCtx.createMediaStreamSource(stream);
      sourceNodeRef.current = source;
      
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      source.connect(analyser);
      
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorNodeRef.current = processor;
      analyser.connect(processor);
      processor.connect(audioCtx.destination);

      // 2. Setup Playback Context
      playbackContextRef.current = new window.AudioContext({ sampleRate: 24000 });
      nextPlayTimeRef.current = playbackContextRef.current.currentTime;

      // 3. Connect to Live API
      const sessionPromise = ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-09-2025",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: "You are a professional Arabic documentary narrator. You have a warm, deep, and natural human voice. You speak in a calm, confident, and engaging tone. You use Modern Standard Arabic (Fusha). Your style is storytelling, with dynamic intonation and natural pauses. You are having a conversation with a director who is asking you to narrate certain scenes or asking about your narration style.",
        },
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            setIsConnecting(false);
            
            // Start sending audio
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcm16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                pcm16[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
              }
              
              const buffer = new ArrayBuffer(pcm16.length * 2);
              const view = new DataView(buffer);
              for (let i = 0; i < pcm16.length; i++) {
                view.setInt16(i * 2, pcm16[i], true);
              }
              
              const base64Data = btoa(String.fromCharCode(...new Uint8Array(buffer)));
              
              sessionPromise.then((session) => {
                session.sendRealtimeInput({
                  media: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
                });
              });
              
              // Update volume meter
              const dataArray = new Uint8Array(analyser.frequencyBinCount);
              analyser.getByteFrequencyData(dataArray);
              const sum = dataArray.reduce((a, b) => a + b, 0);
              setVolume(sum / dataArray.length);
            };
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && playbackContextRef.current) {
              const binaryString = atob(base64Audio);
              const len = binaryString.length;
              const bytes = new Uint8Array(len);
              for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              
              // Decode PCM16 24kHz
              const pcm16 = new Int16Array(bytes.buffer);
              const audioBuffer = playbackContextRef.current.createBuffer(1, pcm16.length, 24000);
              const channelData = audioBuffer.getChannelData(0);
              for (let i = 0; i < pcm16.length; i++) {
                channelData[i] = pcm16[i] / 32768.0;
              }
              
              const source = playbackContextRef.current.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(playbackContextRef.current.destination);
              
              const currentTime = playbackContextRef.current.currentTime;
              if (nextPlayTimeRef.current < currentTime) {
                nextPlayTimeRef.current = currentTime;
              }
              
              source.start(nextPlayTimeRef.current);
              nextPlayTimeRef.current += audioBuffer.duration;
            }
            
            if (message.serverContent?.interrupted) {
              if (playbackContextRef.current) {
                playbackContextRef.current.close();
                playbackContextRef.current = new window.AudioContext({ sampleRate: 24000 });
                nextPlayTimeRef.current = playbackContextRef.current.currentTime;
              }
            }
          },
          onerror: (err) => {
            console.error("Live API Error:", err);
            setError("Connection error occurred.");
            stopConversation();
          },
          onclose: () => {
            stopConversation();
          }
        }
      });
      
      sessionRef.current = sessionPromise;
      
    } catch (err) {
      console.error("Failed to start conversation:", err);
      setError("Microphone access denied or connection failed.");
      setIsConnecting(false);
      stopConversation();
    }
  };

  const stopConversation = () => {
    if (processorNodeRef.current) {
      processorNodeRef.current.disconnect();
      processorNodeRef.current.onaudioprocess = null;
    }
    if (sourceNodeRef.current) sourceNodeRef.current.disconnect();
    if (analyserRef.current) analyserRef.current.disconnect();
    if (audioContextRef.current) audioContextRef.current.close();
    if (playbackContextRef.current) playbackContextRef.current.close();
    
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }
    
    if (sessionRef.current) {
      sessionRef.current.then((session: any) => session.close()).catch(console.error);
    }
    
    setIsConnected(false);
    setIsConnecting(false);
    setVolume(0);
  };

  return (
    <div className="flex-1 bg-[#151619] border border-white/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden flex flex-col items-center justify-center min-h-[500px]">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-md bg-amber-500/5 blur-[100px] pointer-events-none" />
      
      <div className="relative z-10 flex flex-col items-center text-center max-w-md">
        <div className="mb-8 relative">
          <div className={`absolute inset-0 bg-amber-500/20 rounded-full blur-xl transition-all duration-75 ${isConnected ? 'opacity-100' : 'opacity-0'}`} style={{ transform: `scale(${1 + volume / 50})` }} />
          <div className={`w-32 h-32 rounded-full flex items-center justify-center border-2 transition-colors ${isConnected ? 'border-amber-500 bg-amber-500/10 text-amber-500' : 'border-white/10 bg-[#0a0a0a] text-white/40'}`}>
            {isConnected ? <Sparkles className="w-12 h-12" /> : <Mic className="w-12 h-12" />}
          </div>
        </div>

        <h2 className="text-2xl font-semibold text-white mb-2">Live Director Mode</h2>
        <p className="text-white/60 mb-8">
          Have a real-time conversation with the documentary narrator. Direct their tone, ask them to read lines, or discuss the script.
        </p>

        {error && (
          <div className="flex items-center gap-2 text-red-400 bg-red-400/10 px-4 py-2 rounded-lg mb-6">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {!isConnected ? (
          <Button
            onClick={startConversation}
            disabled={isConnecting}
            className="bg-amber-600 hover:bg-amber-500 text-white px-8 h-12 rounded-full font-medium tracking-wide transition-all shadow-[0_0_20px_rgba(217,119,6,0.3)] hover:shadow-[0_0_30px_rgba(217,119,6,0.5)] w-full max-w-[240px]"
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Mic className="w-5 h-5 mr-2" />
                Start Conversation
              </>
            )}
          </Button>
        ) : (
          <Button
            onClick={stopConversation}
            variant="destructive"
            className="px-8 h-12 rounded-full font-medium tracking-wide w-full max-w-[240px]"
          >
            <Square className="w-5 h-5 mr-2 fill-current" />
            End Conversation
          </Button>
        )}
      </div>
    </div>
  );
}
