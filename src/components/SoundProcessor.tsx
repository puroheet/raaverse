import React, { useMemo } from 'react';
import { AudioFileData, RenderProgress } from '../types';
import { formatBytes, formatTime } from '../utils/audioUtils';
import { Volume2, Sparkles, Download, Cpu, Radio, ShieldCheck, RefreshCw } from 'lucide-react';

interface SoundProcessorProps {
  fileData: AudioFileData | null;
  onGainChange: (gain: number) => void;
  onExport: () => void;
  progress: RenderProgress;
  isProcessing: boolean;
  normalizeEnabled: boolean;
  onToggleNormalize: (enabled: boolean) => void;
}

export default function SoundProcessor({
  fileData,
  onGainChange,
  onExport,
  progress,
  isProcessing,
  normalizeEnabled,
  onToggleNormalize,
}: SoundProcessorProps) {
  // Convert multiplier factor to decibels
  const dbValue = useMemo(() => {
    if (!fileData) return '+0.0 dB';
    const g = fileData.gain;
    if (g === 1 || g === 0) return '+0.0 dB';
    const db = (20 * Math.log10(g)).toFixed(1);
    return `+${db} dB`;
  }, [fileData?.gain]);

  // Compute estimated file size based on MP3 CBR 320kbps (40,000 bytes per second)
  const estimatedSizeStr = useMemo(() => {
    if (!fileData) return '0.0 MB';
    // 320 kbps = 40 KB/s
    const bytes = fileData.duration * 40000;
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }, [fileData?.duration]);

  if (!fileData) {
    return (
      <div id="processor-card-empty" className="bg-[#0E0E12] border border-white/5 rounded-xl p-6 flex flex-col items-center justify-center text-center text-slate-500 h-full min-h-[300px]">
        <Cpu className="h-10 w-10 text-slate-700 mb-3 stroke-[1.2] animate-pulse" />
        <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">
          Processor Standby
        </p>
        <p className="text-xs max-w-[200px] text-slate-400 font-sans leading-normal">
          WAV file missing. Upload a source track to activate custom gain filters.
        </p>
      </div>
    );
  }

  return (
    <div id="processor-card" className="bg-[#0e0716] border border-white/5 rounded-xl p-5 flex flex-col gap-5 shadow-lg h-full">
      <div id="processor-title" className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#f59e0b] font-bold shadow-[0_0_10px_rgba(245,158,11,0.6)]" />
          <h3 className="font-sans font-bold text-[10px] text-slate-300 uppercase tracking-widest">
            Processing Panel
          </h3>
        </div>
        <span className="text-[9px] text-[#f59e0b] font-mono font-bold uppercase tracking-wider">D6 DSP CORE</span>
      </div>

      {/* Input Gain Controls */}
      <div id="sound-booster-section" className="flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <h4 className="text-xs font-bold text-white uppercase tracking-tight">Input Gain</h4>
          <span className="text-[#f59e0b] font-mono text-xs font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
            {dbValue}
          </span>
        </div>

        <div className="bg-[#050109] border border-white/5 rounded-lg p-3.5 flex flex-col gap-3 shadow-inner">
          <input
            type="range"
            min="1"
            max="5"
            step="0.1"
            value={fileData.gain}
            disabled={isProcessing}
            onChange={(e) => onGainChange(parseFloat(e.target.value))}
            className="w-full h-1 bg-slate-800 accent-[#f59e0b] rounded-full cursor-pointer disabled:opacity-50"
          />
          <div className="flex justify-between text-[9px] text-slate-500 font-mono uppercase">
            <span>+0dB (1.0x)</span>
            <span>+14dB (5.0x)</span>
          </div>
        </div>
      </div>

      {/* Quick Presets Section (Harmonic Boost from Design Spec!) */}
      <div id="harmonic-boost-presets" className="flex flex-col gap-2">
        <h4 className="text-xs font-bold text-white uppercase tracking-tight">Boost Presets</h4>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => !isProcessing && onGainChange(3.0)}
            className={`py-2 px-3 rounded text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer ${
              Math.abs(fileData.gain - 3.0) < 0.05
                ? 'bg-[#f59e0b] text-black font-extrabold shadow-[0_0_18px_rgba(245,158,11,0.5)]'
                : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
            }`}
          >
            Punch (+9.5dB)
          </button>
          <button
            type="button"
            onClick={() => !isProcessing && onGainChange(1.6)}
            className={`py-2 px-3 rounded text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer ${
              Math.abs(fileData.gain - 1.6) < 0.05
                ? 'bg-[#f59e0b] text-black font-extrabold shadow-[0_0_18px_rgba(245,158,11,0.5)]'
                : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
            }`}
          >
            Clarity (+4.1dB)
          </button>
        </div>
      </div>

      {/* Custom Output Filters / Normalization from Design Template */}
      <div id="design-output-filters" className="flex flex-col gap-2">
        <h4 className="text-xs font-bold text-white uppercase tracking-tight">Signal Options</h4>
        <div className="bg-[#050109] border border-white/5 rounded-lg p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 uppercase font-mono tracking-tight">CBR Encoder Quality</span>
            <span className="text-[9px] font-mono font-bold text-pink-400 bg-pink-500/10 px-1.5 py-0.5 rounded tracking-wider uppercase">
              320 KBPS CBR
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 uppercase font-mono tracking-tight">Normalizer Node</span>
              <span className="text-[8px] text-slate-500 font-mono tracking-tight">AUTOMATIC -1.0 DB PEAK LIMIT</span>
            </div>
            <button
              type="button"
              onClick={() => onToggleNormalize(!normalizeEnabled)}
              className={`w-9 h-5 rounded-full relative transition-colors duration-200 cursor-pointer ${
                normalizeEnabled ? 'bg-[#a3e635] shadow-[0_0_10px_rgba(163,230,53,0.5)]' : 'bg-slate-800'
              }`}
            >
              <div
                className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-200 ${
                  normalizeEnabled ? 'right-1' : 'left-1'
                }`}
              />
            </button>
          </div>

          <div className="flex flex-col gap-1 pt-2 border-t border-white/5 mt-1">
            <div className="flex justify-between text-[9px] font-mono">
              <span className="text-slate-500">DETECTED PEAK:</span>
              <span className="text-slate-300 font-bold">
                {fileData.peakDb !== undefined ? `${fileData.peakDb.toFixed(1)} dBFS` : 'Scanning...'}
              </span>
            </div>

            {normalizeEnabled && (
              <div className="flex justify-between text-[9px] font-mono">
                <span className="text-slate-500">NORM MULTIPLIER:</span>
                <span className="text-[#a3e635] font-bold">
                  {fileData.peakLevel && fileData.peakLevel > 0 
                    ? `x${(0.891251 / fileData.peakLevel).toFixed(2)}` 
                    : 'x1.00'}
                </span>
              </div>
            )}

            <div className="flex justify-between text-[9px] font-mono">
              <span className="text-slate-500">TOTAL SCALING:</span>
              <span className="text-yellow-400 font-bold">
                {normalizeEnabled && fileData.peakLevel && fileData.peakLevel > 0
                  ? `x${((0.891251 / fileData.peakLevel) * fileData.gain).toFixed(2)}`
                  : `x${fileData.gain.toFixed(2)}`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Exporter Progress block */}
      <div id="exporter-dock" className="mt-auto pt-2 flex flex-col gap-3">
        {isProcessing ? (
          <div id="processing-monitor" className="bg-[#050109] border border-white/5 rounded-lg p-4 flex flex-col gap-3 shadow-inner">
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#f59e0b] font-mono tracking-wide uppercase flex items-center gap-1.5">
                <RefreshCw className="h-3 w-3 animate-spin text-[#f59e0b]" /> {progress.phase.toUpperCase()}
              </span>
              <span className="font-mono text-[#f59e0b] font-bold">{progress.percentage}%</span>
            </div>

            {/* Neon slider bar progress */}
            <div className="w-full bg-[#0E0E12] h-1 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="bg-[#f59e0b] h-full rounded-full transition-all duration-300 shadow-[0_0_12px_#f59e0b]"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>

            <p className="text-[9px] text-slate-400 font-mono leading-tight bg-[#09090D] px-2.5 py-1.5 rounded border border-white/5 text-center">
              {progress.message}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center px-1">
              <div className="flex flex-col">
                <span className="text-[9px] uppercase tracking-wider text-slate-500 font-mono">Estimated MP3 size</span>
                <span className="text-sm font-bold text-white font-sans">{estimatedSizeStr}</span>
              </div>
              <span className="text-[9px] text-slate-500 font-mono uppercase bg-slate-900/60 px-2 py-0.5 rounded">Cbr Target</span>
            </div>
            
            <button
              type="button"
              onClick={onExport}
              className="w-full py-3 bg-[#f59e0b] text-slate-950 font-sans font-black text-xs uppercase tracking-widest rounded-lg flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(245,158,11,0.35)] hover:brightness-110 active:scale-98 transition-all select-none"
            >
              <Download className="h-4 w-4" /> Render & Export
            </button>
          </div>
        )}

        <div className="flex items-center justify-center gap-1 text-slate-600 text-[10px] font-mono uppercase">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500/80" />
          <span>Local DSP Client Execution</span>
        </div>
      </div>
    </div>
  );
}
