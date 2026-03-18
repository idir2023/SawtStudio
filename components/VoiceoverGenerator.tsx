'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Play, Square, Loader2, Save, History, Mic, Sparkles, Download, Crown, AlertTriangle, Shield, AlertCircle } from 'lucide-react';
import { GoogleGenAI, Modality } from '@google/genai';
import { db, auth } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, getDocs, updateDoc, increment } from 'firebase/firestore';

import { User } from 'firebase/auth';
import { useUserProfile } from '@/hooks/useUserProfile';
import PricingModal from '@/components/PricingModal';
import AdminDashboard from '@/components/AdminDashboard';
import ExportModal from '@/components/ExportModal';

const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });

const VOICE_STYLES = [
  { id: 'documentary', label: 'وثائقي (Documentary)', icon: '🌍' },
  { id: 'islamic', label: 'قصص إسلامية (Islamic Story)', icon: '🕌' },
  { id: 'did-you-know', label: 'هل تعلم؟ (Did You Know?)', icon: '💡' },
  { id: 'dramatic', label: 'درامي (Dramatic)', icon: '🎭' },
];

const VOICE_NAMES = [
  { id: 'Zephyr', label: 'Zephyr (عميق ودافئ - Deep/Warm)' },
  { id: 'Fenrir', label: 'Fenrir (قوي وحازم - Strong)' },
  { id: 'Charon', label: 'Charon (ناضج ورخيم - Mature)' },
  { id: 'Kore', label: 'Kore (هادئ وواضح - Calm/Clear)' },
  { id: 'Puck', label: 'Puck (حيوي وسريع - Energetic)' },
];

interface Script {
  id: string;
  title: string;
  text: string;
  createdAt: any;
}

export default function VoiceoverGenerator({ user }: { user: User | null }) {
  const { profile, loading: profileLoading } = useUserProfile(user);
  const [text, setText] = useState('');
  const [voiceStyle, setVoiceStyle] = useState('documentary');
  const [voiceName, setVoiceName] = useState('Zephyr');
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pcmDataRef = useRef<Int16Array | null>(null);

  useEffect(() => {
    if (!user) return;
    
    const q = query(
      collection(db, `users/${user.uid}/scripts`),
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedScripts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Script[];
      setScripts(fetchedScripts);
    }, (error) => {
      console.error("Error fetching scripts:", error);
    });

    return () => unsubscribe();
  }, [user]);

  const handleGenerate = async () => {
    if (!text.trim()) return;
    
    if (user && profile) {
      if (profile.subscriptionTier === 'free' && profile.generationsCount >= 100) {
        setShowPricing(true);
        return;
      }
    }
    
    setIsGenerating(true);
    setAudioUrl(null);
    setError(null);
    
    try {
      let styleInstruction = "";
      switch (voiceStyle) {
        case 'islamic':
          styleInstruction = `
- أسلوب قصصي إسلامي خاشع ومؤثر
- نبرة وقورة وهادئة وروحانية تناسب السيرة النبوية وقصص الأنبياء والصحابة
- اقرأ بتأنٍ وعمق، مع إعطاء الكلمات حقها من التفخيم والترقيق
- أضف وقفات تأملية قصيرة بعد المعاني العظيمة`;
          break;
        case 'did-you-know':
          styleInstruction = `
- أسلوب يوتيوب حماسي ومثير للفضول، مشابه لقنوات 'هل تعلم'
- نبرة مفعمة بالطاقة، تجذب انتباه المستمع وتثير دهشته
- إيقاع سريع نسبياً مع التشويق قبل المعلومات الغريبة
- تفاعل قوي مع النص لإبقاء المستمع متيقظاً`;
          break;
        case 'dramatic':
          styleInstruction = `
- أسلوب درامي مشوق، مليء بالمشاعر والتوتر والغموض
- يناسب القصص التاريخية والأحداث الملحمية
- تدرج في طبقات الصوت حسب الموقف (من الهمس إلى الانفعال)
- وقفات درامية طويلة نسبياً لزيادة التشويق`;
          break;
        case 'documentary':
        default:
          styleInstruction = `
- أسلوب وثائقي رصين واحترافي، مشابه لقنوات ناشيونال جيوغرافيك والجزيرة الوثائقية
- نبرة عميقة، هادئة، وموثوقة
- إيقاع متزن ومريح للأذن
- سرد قصصي يشد الانتباه بهدوء`;
          break;
      }

      const prompt = `Generate a high-quality Arabic voiceover based on the following style and text.

Voice characteristics & Style:
${styleInstruction}

General Rules:
- Arabic (Fusha), with perfect articulation and correct grammar (Tashkeel).
- Natural breathing and pauses between sentences.
- Studio-quality, clean audio with no background noise.
- Do NOT add any sound effects, just the voice.

Text to read:
${text}`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceName },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        // Decode base64 to binary string
        const binaryString = atob(base64Audio);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Create WAV file from raw PCM16 data (24kHz)
        const pcm16 = new Int16Array(bytes.buffer);
        pcmDataRef.current = pcm16;
        const sampleRate = 24000;
        const buffer = new ArrayBuffer(44 + pcm16.length * 2);
        const view = new DataView(buffer);
        
        const writeString = (view: DataView, offset: number, string: string) => {
          for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
          }
        };
        
        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + pcm16.length * 2, true);
        writeString(view, 8, 'WAVE');
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString(view, 36, 'data');
        view.setUint32(40, pcm16.length * 2, true);
        
        let offset = 44;
        for (let i = 0; i < pcm16.length; i++, offset += 2) {
          view.setInt16(offset, pcm16[i], true);
        }
        
        const blob = new Blob([buffer], { type: 'audio/wav' });
        const audioSrc = URL.createObjectURL(blob);
        setAudioUrl(audioSrc);
        
        // Save to history if logged in
        if (user) {
          try {
            await addDoc(collection(db, `users/${user.uid}/scripts`), {
              userId: user.uid,
              title: text.substring(0, 30) + (text.length > 30 ? '...' : ''),
              text: text,
              createdAt: serverTimestamp()
            });
            
            // Increment usage
            await updateDoc(doc(db, 'users', user.uid), {
              generationsCount: increment(1)
            });
          } catch (err) {
            console.error("Failed to save script to history or update usage", err);
          }
        }
      }
    } catch (error) {
      console.error('Error generating audio:', error);
      setError('Failed to generate audio. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  const loadScript = (scriptText: string) => {
    setText(scriptText);
    setShowHistory(false);
    setAudioUrl(null);
  };

  const handleExportAudio = () => {
    if (!audioUrl) return;
    setShowExportModal(true);
  };

  return (
    <div className="flex flex-col md:flex-row gap-8 w-full max-w-6xl mx-auto">
      {/* Main Generator Area */}
      <div className="flex-1 bg-[#151619] border border-white/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-md bg-amber-500/5 blur-[100px] pointer-events-none" />
        
        <div className="relative z-10 flex flex-col h-full">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <Mic className="w-5 h-5 text-amber-500" />
                Documentary Studio
              </h2>
              {profile && (
                <button 
                  onClick={() => profile.subscriptionTier === 'free' && setShowPricing(true)}
                  className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  profile.subscriptionTier === 'pro' 
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 cursor-default' 
                    : 'bg-white/10 text-white/70 border border-white/10 hover:bg-white/20 hover:text-white cursor-pointer'
                }`}>
                  {profile.subscriptionTier === 'pro' ? (
                    <>
                      <Crown className="w-3.5 h-3.5" />
                      Pro Plan
                    </>
                  ) : (
                    <>
                      Free Plan ({100 - profile.generationsCount} left)
                    </>
                  )}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {profile && profile.role === 'admin' && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowAdmin(true)}
                  className="bg-purple-500/10 text-purple-400 border-purple-500/30 hover:bg-purple-500/20 hover:text-purple-300"
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Admin Panel
                </Button>
              )}
              {user && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowHistory(!showHistory)}
                  className="text-white/60 hover:text-white"
                >
                  <History className="w-4 h-4 mr-2" />
                  History
                </Button>
              )}
            </div>
          </div>

          {profile && profile.subscriptionTier === 'free' && profile.generationsCount >= 80 && (
            <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3 text-amber-200/90 text-sm">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <div>
                  <span className="font-medium text-amber-500">Approaching Limit:</span> You have {100 - profile.generationsCount} free generations remaining.
                </div>
              </div>
              <Button size="sm" className="bg-amber-600 hover:bg-amber-500 text-white" onClick={() => setShowPricing(true)}>
                Upgrade to Pro
              </Button>
            </div>
          )}

          <div className="flex-1 flex flex-col gap-4">
            {/* Controls */}
            <div className="flex flex-col md:flex-row gap-4 bg-[#0a0a0a] p-4 rounded-xl border border-white/5">
              <div className="flex-1">
                <label className="block text-xs font-medium text-white/50 mb-2 uppercase tracking-wider">Voice Style (الأسلوب)</label>
                <div className="grid grid-cols-2 gap-2">
                  {VOICE_STYLES.map(style => (
                    <button
                      key={style.id}
                      onClick={() => setVoiceStyle(style.id)}
                      className={`text-sm py-2 px-3 rounded-lg border transition-all flex items-center justify-center gap-2 ${
                        voiceStyle === style.id 
                          ? 'bg-amber-500/10 border-amber-500/50 text-amber-500' 
                          : 'bg-[#151619] border-white/5 text-white/70 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <span>{style.icon}</span>
                      <span className="truncate">{style.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="w-full md:w-64">
                <label className="block text-xs font-medium text-white/50 mb-2 uppercase tracking-wider">Character (الشخصية)</label>
                <div className="flex flex-col gap-2">
                  <select
                    value={voiceName}
                    onChange={(e) => setVoiceName(e.target.value)}
                    className="w-full bg-[#151619] border border-white/10 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500/50 transition-colors appearance-none"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(255,255,255,0.5)'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1rem' }}
                  >
                    {VOICE_NAMES.map(voice => (
                      <option key={voice.id} value={voice.id} className="bg-[#151619] text-white">
                        {voice.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="relative flex-1">
              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="أدخل النص العربي هنا... (Enter your Arabic text here...)"
                className="w-full h-full min-h-[300px] resize-none bg-[#0a0a0a] border-white/10 text-white placeholder:text-white/30 p-6 text-lg leading-relaxed font-sans text-right"
                dir="rtl"
              />
              <div className="absolute bottom-4 left-4 text-xs text-white/40 font-mono">
                {text.length} chars
              </div>
            </div>

            <div className="flex items-center justify-between mt-4 bg-[#0a0a0a] p-4 rounded-xl border border-white/5">
              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !text.trim()}
                className="bg-amber-600 hover:bg-amber-500 text-white px-8 h-12 rounded-full font-medium tracking-wide transition-all shadow-[0_0_20px_rgba(217,119,6,0.3)] hover:shadow-[0_0_30px_rgba(217,119,6,0.5)]"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Generating Voiceover...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Generate Audio
                  </>
                )}
              </Button>

              {audioUrl && (
                <div className="flex items-center gap-4">
                  <audio
                    ref={audioRef}
                    src={audioUrl}
                    onEnded={handleAudioEnded}
                    className="hidden"
                  />
                  <div className="text-sm text-white/60 font-mono">Ready to play</div>
                  <Button
                    onClick={handleExportAudio}
                    variant="outline"
                    size="icon"
                    title="Export Audio"
                    className="w-12 h-12 rounded-full border-white/10 text-white/70 hover:bg-white/10 hover:text-white"
                  >
                    <Download className="w-5 h-5" />
                  </Button>
                  <Button
                    onClick={togglePlay}
                    variant="outline"
                    size="icon"
                    className="w-12 h-12 rounded-full border-amber-500/30 text-amber-500 hover:bg-amber-500/10 hover:text-amber-400"
                  >
                    {isPlaying ? <Square className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* History Sidebar */}
      {showHistory && user && (
        <div className="w-full md:w-80 bg-[#151619] border border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col h-[600px]">
          <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
            <Save className="w-4 h-4 text-white/60" />
            Saved Scripts
          </h3>
          <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
            {scripts.length === 0 ? (
              <div className="text-center text-white/40 text-sm mt-10">
                No saved scripts yet.
              </div>
            ) : (
              scripts.map((script) => (
                <div 
                  key={script.id}
                  onClick={() => loadScript(script.text)}
                  className="p-4 rounded-xl bg-[#0a0a0a] border border-white/5 hover:border-amber-500/30 cursor-pointer transition-colors group"
                >
                  <h4 className="text-white text-sm font-medium truncate mb-1 text-right" dir="rtl">
                    {script.title}
                  </h4>
                  <p className="text-white/40 text-xs truncate text-right" dir="rtl">
                    {script.text}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
      {/* Pricing Modal */}
      <PricingModal isOpen={showPricing} onClose={() => setShowPricing(false)} />

      {/* Admin Dashboard */}
      {showAdmin && <AdminDashboard onClose={() => setShowAdmin(false)} />}

      {/* Export Modal */}
      <ExportModal 
        isOpen={showExportModal} 
        onClose={() => setShowExportModal(false)} 
        audioUrl={audioUrl}
        pcmData={pcmDataRef.current}
      />
    </div>
  );
}
