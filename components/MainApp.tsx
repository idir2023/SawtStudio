'use client';

import { useState, useEffect } from 'react';
import { auth, googleProvider, signInWithPopup, signOut } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { LogIn, LogOut, Mic, Radio } from 'lucide-react';
import Image from 'next/image';
import VoiceoverGenerator from './VoiceoverGenerator';
import LiveConversation from './LiveConversation';

export default function MainApp() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState<'generator' | 'live'>('generator');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-white/10 bg-[#151619] px-6 py-4 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center border border-amber-500/20">
              <Mic className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Sawt<span className="text-amber-500">Studio</span></h1>
              <p className="text-xs text-white/40 font-medium tracking-wider uppercase">Arabic Voiceover AI</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-4">
                <div className="hidden md:flex items-center gap-2">
                  <Image src={user.photoURL || ''} alt="Profile" width={32} height={32} className="w-8 h-8 rounded-full border border-white/10" referrerPolicy="no-referrer" />
                  <span className="text-sm font-medium text-white/80">{user.displayName}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={handleLogout} className="text-white/60 hover:text-white hover:bg-white/5">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            ) : (
              <Button onClick={handleLogin} className="bg-white text-black hover:bg-white/90 rounded-full px-6 font-medium">
                <LogIn className="w-4 h-4 mr-2" />
                Sign In
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-12 flex flex-col">
        <div className="max-w-6xl mx-auto w-full mb-8 flex justify-center">
          <div className="bg-[#151619] p-1 rounded-full border border-white/10 inline-flex">
            <button
              onClick={() => setActiveTab('generator')}
              className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'generator' ? 'bg-amber-500 text-black shadow-lg' : 'text-white/60 hover:text-white'}`}
            >
              <Mic className="w-4 h-4" />
              Script Generator
            </button>
            <button
              onClick={() => setActiveTab('live')}
              className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'live' ? 'bg-amber-500 text-black shadow-lg' : 'text-white/60 hover:text-white'}`}
            >
              <Radio className="w-4 h-4" />
              Live Director
            </button>
          </div>
        </div>

        {activeTab === 'generator' ? <VoiceoverGenerator user={user} /> : <LiveConversation user={user} />}
      </main>
    </div>
  );
}
