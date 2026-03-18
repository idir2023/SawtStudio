import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, Download, FileAudio, Loader2 } from 'lucide-react';
// Fix for lamejs MPEGMode bug
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.MPEGMode = require('lamejs/src/js/MPEGMode.js');
  // @ts-ignore
  window.Lame = require('lamejs/src/js/Lame.js');
  // @ts-ignore
  window.BitStream = require('lamejs/src/js/BitStream.js');
  // @ts-ignore
  window.LameInternalFlags = require('lamejs/src/js/LameInternalFlags.js');
  // @ts-ignore
  window.GainAnalysis = require('lamejs/src/js/GainAnalysis.js');
  // @ts-ignore
  window.L3Side = require('lamejs/src/js/L3Side.js');
}

// @ts-ignore
import lamejs from 'lamejs';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  audioUrl: string | null;
  pcmData: Int16Array | null;
}

export default function ExportModal({ isOpen, onClose, audioUrl, pcmData }: ExportModalProps) {
  const [format, setFormat] = useState<'wav' | 'mp3'>('wav');
  const [bitrate, setBitrate] = useState<number>(128);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExport = async () => {
    if (!audioUrl && !pcmData) return;
    
    setIsExporting(true);
    setError(null);
    
    try {
      if (format === 'wav') {
        if (!audioUrl) {
          throw new Error('No WAV audio URL available for export.');
        }
        // Export WAV directly
        const a = document.createElement('a');
        a.href = audioUrl;
        a.download = `voiceover_${new Date().getTime()}.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else if (format === 'mp3') {
        if (!pcmData) {
          throw new Error('No PCM audio data available for MP3 encoding.');
        }
        
        if (typeof lamejs === 'undefined' || !lamejs.Mp3Encoder) {
          throw new Error('MP3 encoder (lamejs) is not loaded correctly.');
        }
        
        if (isNaN(bitrate) || bitrate < 32 || bitrate > 320) {
          throw new Error('Invalid MP3 bitrate selected.');
        }
        
        // Encode MP3 using lamejs
        // We need to yield to the event loop so the UI can update to show the loading state
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const channels = 1; // Mono
        const sampleRate = 24000; // 24kHz from Gemini
        
        const mp3encoder = new lamejs.Mp3Encoder(channels, sampleRate, bitrate);
        const mp3Data: Int8Array[] = [];
        
        const sampleBlockSize = 1152; // Can be anything but make it a multiple of 576 to make encoders life easier
        
        for (let i = 0; i < pcmData.length; i += sampleBlockSize) {
          const sampleChunk = pcmData.subarray(i, i + sampleBlockSize);
          const mp3buf = mp3encoder.encodeBuffer(sampleChunk);
          if (mp3buf.length > 0) {
            mp3Data.push(mp3buf);
          }
        }
        
        const mp3buf = mp3encoder.flush();
        if (mp3buf.length > 0) {
          mp3Data.push(mp3buf);
        }
        
        const blob = new Blob(mp3Data as any, { type: 'audio/mp3' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `voiceover_${new Date().getTime()}.mp3`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Clean up
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      
      onClose();
    } catch (err: any) {
      console.error('Error exporting audio:', err);
      const errorMessage = err?.message || String(err);
      
      if (errorMessage.includes('MPEGMode is not defined')) {
        setError('MP3 Encoding Error: The encoder failed to initialize. This is a known issue with some browsers. Please try exporting as WAV instead.');
      } else if (errorMessage.includes('lamejs')) {
        setError('The MP3 encoder is currently unavailable. Please try again or use WAV format.');
      } else if (errorMessage.includes('pcmData')) {
        setError('Audio data is missing or corrupted. Please generate the voiceover again.');
      } else {
        setError(`Export failed: ${errorMessage}. Please try again.`);
      }
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-[#151619] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-[#0a0a0a]">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Download className="w-5 h-5 text-amber-500" />
            Export Audio
          </h2>
          <button 
            onClick={onClose}
            className="text-white/50 hover:text-white transition-colors"
            disabled={isExporting}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}
          {/* Format Selection */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-3">Audio Format</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setFormat('wav')}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all ${
                  format === 'wav' 
                    ? 'bg-amber-500/10 border-amber-500/50 text-amber-500' 
                    : 'bg-[#0a0a0a] border-white/10 text-white/60 hover:bg-white/5 hover:text-white'
                }`}
              >
                <FileAudio className="w-8 h-8 mb-2" />
                <span className="font-semibold">WAV</span>
                <span className="text-xs opacity-70 mt-1">Lossless, larger file</span>
              </button>
              
              <button
                onClick={() => setFormat('mp3')}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all ${
                  format === 'mp3' 
                    ? 'bg-amber-500/10 border-amber-500/50 text-amber-500' 
                    : 'bg-[#0a0a0a] border-white/10 text-white/60 hover:bg-white/5 hover:text-white'
                }`}
              >
                <FileAudio className="w-8 h-8 mb-2" />
                <span className="font-semibold">MP3</span>
                <span className="text-xs opacity-70 mt-1">Compressed, smaller file</span>
              </button>
            </div>
          </div>

          {/* Bitrate Selection (only for MP3) */}
          {format === 'mp3' && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
              <label className="block text-sm font-medium text-white/70 mb-3">MP3 Bitrate</label>
              <div className="grid grid-cols-3 gap-2">
                {[128, 192, 320].map((b) => (
                  <button
                    key={b}
                    onClick={() => setBitrate(b)}
                    className={`py-2 px-3 rounded-lg border text-sm transition-all ${
                      bitrate === b
                        ? 'bg-amber-500/10 border-amber-500/50 text-amber-500'
                        : 'bg-[#0a0a0a] border-white/10 text-white/60 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {b} kbps
                  </button>
                ))}
              </div>
              <p className="text-xs text-white/40 mt-2">
                {bitrate === 128 && "Standard quality, good for voice."}
                {bitrate === 192 && "High quality, balanced file size."}
                {bitrate === 320 && "Maximum quality, largest file size."}
              </p>
            </div>
          )}

          <Button 
            className="w-full bg-amber-600 hover:bg-amber-500 text-white font-medium"
            onClick={handleExport}
            disabled={isExporting || (!audioUrl && !pcmData)}
          >
            {isExporting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-5 h-5 mr-2" />
                Download {format.toUpperCase()}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
