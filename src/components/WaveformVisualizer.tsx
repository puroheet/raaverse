import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Volume2, ChevronRight } from 'lucide-react';

interface WaveformVisualizerProps {
  audioBuffer: AudioBuffer | null;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  analyserNode: AnalyserNode | null;
  isPlaying: boolean;
}

export default function WaveformVisualizer({
  audioBuffer,
  currentTime,
  duration,
  onSeek,
  analyserNode,
  isPlaying,
}: WaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const liveCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number>(0);
  const [dimensions, setDimensions] = useState({ width: 800, height: 160 });

  // Handle resizing of the waveform view
  useEffect(() => {
    if (!containerRef.current) return;
    
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: Math.max(300, entry.contentRect.width),
          height: 160,
        });
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Compute waveform peaks
  const peaks = useMemo(() => {
    if (!audioBuffer) return [];
    
    const numBars = 160; // Resolution of waveform representation
    const result: number[] = [];
    const ch0 = audioBuffer.getChannelData(0);
    const step = Math.floor(ch0.length / numBars);
    
    for (let i = 0; i < numBars; i++) {
      let max = 0;
      const start = i * step;
      const end = Math.min(start + step, ch0.length);
      
      for (let j = start; j < end; j++) {
        const val = Math.abs(ch0[j]);
        if (val > max) max = val;
      }
      result.push(max);
    }

    // Normalize peaks
    const maxPeak = Math.max(...result, 0.01);
    return result.map((p) => p / maxPeak);
  }, [audioBuffer]);

  // Draw the static waveform inside the Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = dimensions;
    
    // Set higher density canvas backing for crisp retina rendering
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    if (peaks.length === 0) {
      // Draw placeholder waveform wave
      ctx.fillStyle = '#1e293b'; // slate-800
      ctx.beginPath();
      ctx.roundRect(0, height / 2 - 1, width, 2, 1);
      ctx.fill();
      return;
    }

    const barWidth = Math.max(2, (width / peaks.length) - 2);
    const barSpacing = 2;
    const centerY = height / 2;

    for (let i = 0; i < peaks.length; i++) {
      const peak = peaks[i];
      const barHeight = Math.max(4, peak * (height - 30));
      const x = i * (barWidth + barSpacing);
      const y = centerY - barHeight / 2;

      // Determine colors based on progress ratio
      const barProgressX = (x / width) * duration;
      const isPast = barProgressX <= currentTime;

      // Draw aesthetic rounded bars
      ctx.fillStyle = isPast ? '#f59e0b' : '#310714'; // Kill Bill Amber-Yellow : Deep Saturated Blood Red
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, barWidth / 2);
      ctx.fill();
    }
  }, [peaks, currentTime, duration, dimensions]);

  // Draw real-time spectrum analyzer animation when playing
  useEffect(() => {
    let animationId = 0;
    const liveCanvas = liveCanvasRef.current;
    if (!liveCanvas || !analyserNode) return;

    const ctx = liveCanvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const drawLive = () => {
      if (!isPlaying) {
        ctx.clearRect(0, 0, liveCanvas.width, liveCanvas.height);
        return;
      }

      animationId = requestAnimationFrame(drawLive);
      analyserNode.getByteFrequencyData(dataArray);

      const dpr = window.devicePixelRatio || 1;
      const width = liveCanvas.clientWidth;
      const height = liveCanvas.clientHeight;
      
      // Sync canvas pixels
      if (liveCanvas.width !== width * dpr || liveCanvas.height !== height * dpr) {
        liveCanvas.width = width * dpr;
        liveCanvas.height = height * dpr;
        ctx.resetTransform();
        ctx.scale(dpr, dpr);
      }

      ctx.clearRect(0, 0, width, height);

      // Draw subtle neon spectrum lines under the main waveform
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.4)'; // Saturated Blood Red neon
      ctx.beginPath();

      const sliceWidth = width / 40; // 40 bands is perfect
      for (let i = 0; i < 40; i++) {
        const val = dataArray[i] / 255;
        const barHeight = val * height * 0.7;
        const x = i * sliceWidth;
        const y = height - barHeight;

        // Bouncing frequency equalizer visuals
        ctx.fillStyle = `rgba(245, 158, 11, ${0.2 + val * 0.6})`; // Bright pulp amber
        ctx.beginPath();
        ctx.roundRect(x + 2, y, sliceWidth - 4, barHeight, 2);
        ctx.fill();
      }
    };

    drawLive();

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [analyserNode, isPlaying]);

  // Click handler to seek through timeline
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(ratio * duration);
  };

  // Mouse hover previews
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, cursorX / rect.width));
    setHoverTime(ratio * duration);
    setHoverX(cursorX);
  };

  const handleMouseLeave = () => {
    setHoverTime(null);
  };

  const playheadPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div id="waveform-visualizer-container" className="flex flex-col gap-2.5 w-full select-none" ref={containerRef}>
      {/* Immersive Dark Waveform Visualizer Wrapper */}
      <div
        id="waveform-canvas-wrapper"
        className="relative bg-[#050507] border border-white/5 rounded-xl overflow-hidden cursor-pointer h-[180px] flex flex-col justify-between transition-all duration-300 shadow-inner"
        onClick={handleTimelineClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Dynamic Absolute Header Indicators */}
        <div className="absolute top-4 left-6 right-6 flex items-center justify-between pointer-events-none z-30">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono font-bold text-[#f59e0b] bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded tracking-widest uppercase">STEREO</span>
            <span className="text-[9px] font-mono text-slate-400 font-semibold uppercase tracking-widest">Waveform Scope</span>
          </div>

          {hoverTime !== null ? (
            <span className="text-[9px] font-mono text-[#f59e0b] bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded uppercase tracking-wider">
              Seek to: {Math.floor(hoverTime / 60).toString().padStart(2, '0')}:
              {Math.floor(hoverTime % 60).toString().padStart(2, '0')}
            </span>
          ) : (
            <span className="text-[9px] font-mono text-slate-400 font-semibold uppercase tracking-wider animate-pulse">
              {isPlaying ? "D6 ROUTE ACTIVE" : "PLAYBACK PAUSED"}
            </span>
          )}
        </div>

        {/* Floating background grids */}
        <div id="waveform-grid" className="absolute inset-0 grid grid-cols-12 pointer-events-none opacity-[0.03]">
          {Array.from({ length: 11 }).map((_, i) => (
            <div key={i} className="border-r border-white h-full" />
          ))}
        </div>

        {/* Live frequency visualizer bouncy spectrum bars */}
        <canvas
          ref={liveCanvasRef}
          className="absolute inset-x-0 bottom-8 h-1/3 w-full pointer-events-none opacity-40 z-0"
        />

        {/* Main Canvas Waveform */}
        <div className="flex-1 relative min-h-[120px] flex items-center">
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-10 pointer-events-none" />

          {/* Hover timing cursor */}
          {hoverTime !== null && (
            <div
              id="waveform-hover-guide"
              className="absolute top-0 bottom-0 w-[1px] bg-cyan-400/30 pointer-events-none z-20"
              style={{ left: `${hoverX}px` }}
            />
          )}

          {/* Glowing Playhead line */}
          <div
            id="waveform-playhead"
            className="absolute top-0 bottom-0 w-[2px] bg-white shadow-[0_0_15px_white] pointer-events-none z-30 transition-all duration-75"
            style={{ left: `${playheadPercent}%` }}
          />
        </div>

        {/* Underneath precise timeline sub-rail from spec */}
        <div className="h-8 border-t border-white/5 flex items-center px-6 justify-between bg-[#08080C]/80 backdrop-blur-sm z-20">
          <span className="text-[9px] font-mono text-slate-500">0:00:00</span>
          <div className="flex-1 mx-4 h-[1px] bg-white/5"></div>
          <span className="text-[9px] font-mono text-slate-400">
            {duration > 0 ? `${Math.floor(duration / 60)}:${Math.floor(duration % 60).toString().padStart(2, '0')}` : '0:00'}
          </span>
        </div>
      </div>
    </div>
  );
}
