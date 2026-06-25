import React, { useState, useEffect } from 'react';
import { Scan, Volume2, VolumeX, CheckCircle2, AlertCircle } from 'lucide-react';

interface BarcodeInputProps {
  onScan: (code: string) => void;
  placeholder?: string;
  context?: 'goods_receipt' | 'fulfillment' | 'bin_locations' | 'general';
  activeId?: string;
  className?: string;
}

export default function BarcodeInput({
  onScan,
  placeholder = 'Scan barcode/serial key...',
  context = 'general',
  activeId,
  className = '',
}: BarcodeInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Suggestions depending on the context
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    // Populate smart scan test hints based on database contexts
    const fetchHints = async () => {
      try {
        if (context === 'goods_receipt') {
          const poRes = await fetch('/api/v1/purchase-orders');
          const poData = await poRes.json();
          const hints: string[] = [];
          if (poData?.data) {
            poData.data.forEach((po: any) => {
              if (po.status !== 'received') hints.push(po.id);
            });
          }
          const skuRes = await fetch('/api/v1/skus');
          const skuData = await skuRes.json();
          if (skuData?.data) {
            skuData.data.slice(0, 3).forEach((s: any) => hints.push(s.id));
          }
          setSuggestions(hints);
        } else if (context === 'fulfillment') {
          const plRes = await fetch('/api/v1/pick-lists');
          const plData = await plRes.json();
          const hints: string[] = [];
          if (plData?.data) {
            plData.data.forEach((pl: any) => {
              if (pl.status !== 'completed') hints.push(pl.id);
            });
          }
          const skuRes = await fetch('/api/v1/skus');
          const skuData = await skuRes.json();
          if (skuData?.data) {
            skuData.data.slice(0, 3).forEach((s: any) => hints.push(s.id));
          }
          setSuggestions(hints);
        } else if (context === 'bin_locations') {
          const locRes = await fetch('/api/v1/locations');
          const locData = await locRes.json();
          if (locData?.data) {
            setSuggestions(locData.data.slice(0, 5).map((l: any) => l.id));
          }
        }
      } catch (err) {
        console.warn('Error pre-loading barcode hints:', err);
      }
    };
    fetchHints();
  }, [context]);

  const playBeep = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.value = 1450; // crisp high chirp
      gainNode.gain.setValueAtTime(0.06, audioCtx.currentTime);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.1);
    } catch (err) {
      console.warn('Audio feedback blocked by iframe constraints.', err);
    }
  };

  const handleSubmit = (e?: React.FormEvent | React.KeyboardEvent) => {
    if (e) e.preventDefault();
    const code = inputValue.toUpperCase().trim();
    if (!code) return;

    playBeep();
    onScan(code);
    setInputValue('');
    setFeedback({ type: 'success', msg: `Scanned: "${code}" successfully.` });

    setTimeout(() => {
      setFeedback(null);
    }, 2800);
  };

  const selectSuggestion = (code: string) => {
    setInputValue(code);
    setShowSuggestions(false);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="relative flex items-center">
        <div className="relative flex-1">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={placeholder}
            className="w-full pl-10 pr-20 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-xs placeholder-slate-400 font-mono tracking-wide font-semibold outline-hidden transition-all shadow-xs"
          />
          <Scan className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-500 animate-pulse pointer-events-none" />
          
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1.5">
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? 'Mute Scan Sound' : 'Enable Scan Sound'}
              className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-md transition-colors"
            >
              {soundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            </button>
            
            {suggestions.length > 0 && (
              <button
                type="button"
                onClick={() => setShowSuggestions(!showSuggestions)}
                className="px-1.5 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[9px] font-bold rounded-md transition-colors uppercase"
              >
                Hints
              </button>
            )}
          </div>
        </div>
        
        <button
          type="button"
          onClick={() => handleSubmit()}
          className="ml-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer"
        >
          Scan
        </button>
      </div>

      {/* Suggestion hints popover */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-64 bg-slate-900 border border-slate-800 text-white p-3 rounded-xl shadow-xl space-y-1.5">
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Simulate Sandbox Barcodes:</p>
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
            {suggestions.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => selectSuggestion(code)}
                className="px-2 py-1 bg-slate-800 hover:bg-indigo-600 rounded-md text-[10px] font-mono font-bold transition-colors text-left"
              >
                {code}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Dynamic Status Feedback message directly under input */}
      {feedback && (
        <div className={`p-2 rounded-lg text-[10px] font-semibold flex items-center space-x-1.5 animate-slideUp ${
          feedback.type === 'success' ? 'bg-emerald-50 border border-emerald-100 text-emerald-950' : 'bg-rose-50 border border-rose-100 text-rose-950'
        }`}>
          {feedback.type === 'success' ? (
            <CheckCircle2 className="h-3 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="h-3 text-rose-600 shrink-0" />
          )}
          <span className="flex-1 leading-normal">{feedback.msg}</span>
        </div>
      )}
    </div>
  );
}
