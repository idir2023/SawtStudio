import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, X, Crown, AlertCircle } from 'lucide-react';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PricingModal({ isOpen, onClose }: PricingModalProps) {
  const [isAnnual, setIsAnnual] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl bg-[#151619] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="p-8 md:p-12 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Upgrade to <span className="text-amber-500">Pro</span>
          </h2>
          <p className="text-white/60 max-w-xl mx-auto mb-8">
            Unlock unlimited documentary voiceovers, premium voices, and commercial rights for your YouTube channel.
          </p>

          <div className="flex items-center justify-center gap-3 mb-12">
            <span className={`text-sm ${!isAnnual ? 'text-white font-medium' : 'text-white/50'}`}>Monthly</span>
            <button 
              onClick={() => setIsAnnual(!isAnnual)}
              className="relative w-14 h-7 bg-white/10 rounded-full transition-colors focus:outline-none"
            >
              <div className={`absolute top-1 left-1 w-5 h-5 bg-amber-500 rounded-full transition-transform ${isAnnual ? 'translate-x-7' : 'translate-x-0'}`} />
            </button>
            <span className={`text-sm ${isAnnual ? 'text-white font-medium' : 'text-white/50'}`}>
              Annually <span className="text-amber-500 text-xs ml-1">(Save 20%)</span>
            </span>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto text-left">
            {error && (
              <div className="md:col-span-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
            {/* Free Tier */}
            <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-8">
              <h3 className="text-xl font-semibold text-white mb-2">Free Starter</h3>
              <div className="text-3xl font-bold text-white mb-6">$0<span className="text-lg text-white/40 font-normal">/mo</span></div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-center gap-3 text-white/70">
                  <Check className="w-5 h-5 text-amber-500" />
                  100 Voiceover Generations
                </li>
                <li className="flex items-center gap-3 text-white/70">
                  <Check className="w-5 h-5 text-amber-500" />
                  Standard Voices
                </li>
                <li className="flex items-center gap-3 text-white/70">
                  <Check className="w-5 h-5 text-amber-500" />
                  Personal Use Only
                </li>
              </ul>
              <Button variant="outline" className="w-full border-white/10 text-white hover:bg-white/5" disabled>
                Current Plan
              </Button>
            </div>

            {/* Pro Tier */}
            <div className="bg-gradient-to-b from-amber-500/20 to-[#0a0a0a] border border-amber-500/30 rounded-2xl p-8 relative">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-amber-500 text-black text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                <Crown className="w-3 h-3" /> Most Popular
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Pro Creator</h3>
              <div className="text-3xl font-bold text-white mb-6">
                ${isAnnual ? '19' : '24'}<span className="text-lg text-white/40 font-normal">/mo</span>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-center gap-3 text-white">
                  <Check className="w-5 h-5 text-amber-500" />
                  <strong>Unlimited</strong> Voiceover Generations
                </li>
                <li className="flex items-center gap-3 text-white">
                  <Check className="w-5 h-5 text-amber-500" />
                  All Premium Voices & Styles
                </li>
                <li className="flex items-center gap-3 text-white">
                  <Check className="w-5 h-5 text-amber-500" />
                  Commercial Rights (YouTube, TikTok)
                </li>
                <li className="flex items-center gap-3 text-white">
                  <Check className="w-5 h-5 text-amber-500" />
                  Priority Support
                </li>
              </ul>
              <Button 
                className="w-full bg-amber-600 hover:bg-amber-500 text-white font-medium shadow-[0_0_20px_rgba(217,119,6,0.3)]"
                onClick={() => setError('Stripe integration is ready! Add your Stripe API keys to process payments.')}
              >
                Subscribe Now
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
