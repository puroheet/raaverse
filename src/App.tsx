import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Cpu,
  Disc,
  Download,
  HelpCircle,
  Heart,
  Music,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  X,
  FolderOpen,
  Maximize2,
  Minimize2,
  Sparkles,
  Sliders,
  Radio,
  FileCheck,
  DiscAlbum,
  Trash2,
  Layers,
  FilePlus,
  CheckCircle,
  SlidersHorizontal,
  ChevronRight,
  Settings,
  MessageSquare
} from 'lucide-react';
import { AudioFileData, RenderProgress, AudioMetadata } from './types';
import { 
  formatTime, 
  offlineSoundBoost, 
  encodeAudioBufferToMp3, 
  tagMp3File,
  analyzeAudioBuffer 
} from './utils/audioUtils';
import WaveformVisualizer from './components/WaveformVisualizer';
import MetadataEditor from './components/MetadataEditor';
import SoundProcessor from './components/SoundProcessor';
import GoogleChatIntegration, { triggerAutoNotifyIfEnabled } from './components/GoogleChatIntegration';

export default function App() {
  const [activeTab, setActiveTab] = useState<'editor' | 'batch'>('editor');
  const [showGoogleChat, setShowGoogleChat] = useState<boolean>(true);
  
  // Single mode state
  const [fileData, setFileData] = useState<AudioFileData | null>(null);

  // Batch mode states
  const [batchFiles, setBatchFiles] = useState<AudioFileData[]>([]);
  const [batchMetadata, setBatchMetadata] = useState<AudioMetadata>({
    title: '',
    artist: 'RAAJEEB PRODUCTION',
    album: 'MOLDAVITE CORE LP',
    year: new Date().getFullYear().toString(),
    genre: 'Synthwave',
    coverUrl: null,
    coverBuffer: null
  });
  const [batchGain, setBatchGain] = useState<number>(1.0);
  const [selectedBatchFileId, setSelectedBatchFileId] = useState<string | null>(null);

  // Global DSP options
  const [normalizeEnabled, setNormalizeEnabled] = useState<boolean>(true);

  // Common UI & Playback states
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0.8);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [aboutModalOpen, setAboutModalOpen] = useState<boolean>(false);
  const [dragOver, setDragOver] = useState<boolean>(false);
  const [decoding, setDecoding] = useState<boolean>(false);
  
  // Exporter/Process states
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<RenderProgress>({
    phase: 'idle',
    percentage: 0,
    message: ''
  });

  // Track active index during sequential batch export
  const [activeBatchIndex, setActiveBatchIndex] = useState<number | null>(null);

  // HTML5 audio elements and AudioGraph references
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);

  // Resolve the currently active file for player and waveform scope
  const activeFile = useMemo(() => {
    if (activeTab === 'editor') {
      return fileData;
    } else {
      return batchFiles.find(f => f.id === selectedBatchFileId) || batchFiles[0] || null;
    }
  }, [activeTab, fileData, batchFiles, selectedBatchFileId]);

  // Synchronize player element source with active track selection
  useEffect(() => {
    if (audioRef.current && activeFile) {
      if (audioRef.current.src !== activeFile.objectUrl) {
        const wasPlaying = isPlaying;
        handleStop(); // Halt previous channels
        audioRef.current.src = activeFile.objectUrl || '';
        audioRef.current.load();
        setCurrentTime(0);
        if (wasPlaying) {
          // Re-init playback if they were actively listening to help seamlessly transition
          setTimeout(() => {
            initAudioGraphAndPlay();
          }, 80);
        }
      }
    }
  }, [activeFile?.id]);

  // Sync volume of HTML audio node
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Sync playback rate range
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Sync real-time master gain boost to live playback preview
  useEffect(() => {
    if (gainNodeRef.current && activeFile) {
      // Calculate active preview gain based on user and normalization settings
      let normFactor = 1.0;
      if (normalizeEnabled && activeFile.peakLevel && activeFile.peakLevel > 0) {
        normFactor = 0.891251 / activeFile.peakLevel;
      }
      const targetGain = activeTab === 'editor' ? activeFile.gain : batchGain;
      gainNodeRef.current.gain.value = normFactor * targetGain;
    }
  }, [activeFile?.id, fileData?.gain, batchGain, normalizeEnabled, activeTab]);

  // Handle active audio time updates
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  // Build or reuse Web Audio Graph on user playback triggering
  const initAudioGraphAndPlay = async () => {
    if (!audioRef.current || !activeFile) return;

    try {
      if (!audioContextRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContextClass();
        const gainNode = ctx.createGain();
        const analyserNode = ctx.createAnalyser();
        
        analyserNode.fftSize = 256;

        let normFactor = 1.0;
        if (normalizeEnabled && activeFile.peakLevel && activeFile.peakLevel > 0) {
          normFactor = 0.891251 / activeFile.peakLevel;
        }
        const initialGain = activeTab === 'editor' ? activeFile.gain : batchGain;
        gainNode.gain.value = normFactor * initialGain;

        // Route media element audio source
        const source = ctx.createMediaElementSource(audioRef.current);
        source.connect(gainNode);
        gainNode.connect(analyserNode);
        analyserNode.connect(ctx.destination);

        audioContextRef.current = ctx;
        gainNodeRef.current = gainNode;
        analyserNodeRef.current = analyserNode;
      }

      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      await audioRef.current.play();
      setIsPlaying(true);
    } catch (err: any) {
      console.error('Audio Graph init error:', err);
      audioRef.current.play().then(() => setIsPlaying(true)).catch(e => {
        alert('Could not start playback. Verify audio drivers or browser sandboxing settings.');
      });
    }
  };

  const togglePlay = () => {
    if (!activeFile || !audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      initAudioGraphAndPlay();
    }
  };

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      setIsPlaying(false);
    }
  };

  const handleSeek = (time: number) => {
    if (audioRef.current && activeFile) {
      const clamped = Math.max(0, Math.min(activeFile.duration, time));
      audioRef.current.currentTime = clamped;
      setCurrentTime(clamped);
    }
  };

  // Upload actions
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      if (activeTab === 'batch' || e.dataTransfer.files.length > 1) {
        handleBatchFilesUploadedByList(e.dataTransfer.files);
      } else {
        handleFileUploaded(e.dataTransfer.files[0]);
      }
    }
  };

  // Decode singular WAV uploaded track
  const handleFileUploaded = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.wav')) {
      alert('Unsupported format. Please select a high-fidelity standard .wav file.');
      return;
    }

    setDecoding(true);
    try {
      const objectUrl = URL.createObjectURL(file);
      handleStop();

      const arrayBuffer = await file.arrayBuffer();
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      const decCtx = new AudioCtxClass();
      const decodedBuffer = await decCtx.decodeAudioData(arrayBuffer);
      await decCtx.close();

      const { peakDb, peakLevel } = analyzeAudioBuffer(decodedBuffer);
      const initialTitle = file.name.replace(/\.[^/.]+$/, "");

      setFileData({
        id: Math.random().toString(36).substring(7),
        name: file.name,
        size: file.size,
        duration: decodedBuffer.duration,
        sampleRate: decodedBuffer.sampleRate,
        channels: decodedBuffer.numberOfChannels,
        audioBuffer: decodedBuffer,
        metadata: {
          title: initialTitle,
          artist: 'RAAJEEB PRODUCTION',
          album: '',
          year: new Date().getFullYear().toString(),
          genre: '',
          coverUrl: null,
          coverBuffer: null
        },
        gain: 1.0,
        peakDb,
        peakLevel,
        objectUrl
      });
      
      setCurrentTime(0);
    } catch (err: any) {
      console.error(err);
      alert('WAV Parse Exception: Stream decoding failed. Ensure file is not corrupt.');
    } finally {
      setDecoding(false);
    }
  };

  // Decode multiple files for sequential batch parsing
  const handleBatchFilesUploadedByList = async (files: FileList) => {
    setDecoding(true);
    setActiveTab('batch');

    const validFiles = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.wav'));
    if (validFiles.length === 0) {
      alert('All files skipped. Please drag or upload uncompressed lossless .wav format files.');
      setDecoding(false);
      return;
    }

    const decodedList: AudioFileData[] = [];
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;

    for (const file of validFiles) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const decCtx = new AudioCtxClass();
        const decodedBuffer = await decCtx.decodeAudioData(arrayBuffer);
        await decCtx.close();

        const { peakDb, peakLevel } = analyzeAudioBuffer(decodedBuffer);
        const originalTitle = file.name.replace(/\.[^/.]+$/, "");
        const objectUrl = URL.createObjectURL(file);

        decodedList.push({
          id: Math.random().toString(36).substring(7),
          name: file.name,
          size: file.size,
          duration: decodedBuffer.duration,
          sampleRate: decodedBuffer.sampleRate,
          channels: decodedBuffer.numberOfChannels,
          audioBuffer: decodedBuffer,
          metadata: {
            title: originalTitle,
            artist: batchMetadata.artist,
            album: batchMetadata.album,
            year: batchMetadata.year,
            genre: batchMetadata.genre,
            coverUrl: batchMetadata.coverUrl,
            coverBuffer: batchMetadata.coverBuffer
          },
          gain: batchGain,
          peakDb,
          peakLevel,
          objectUrl
        });
      } catch (err) {
        console.error(`Decoding failed for file ${file.name}:`, err);
      }
    }

    if (decodedList.length > 0) {
      setBatchFiles(prev => [...prev, ...decodedList]);
      setSelectedBatchFileId(decodedList[0].id);
    } else {
      alert('WAV Batch Loader Error: Failed to parse WAV bitstream headers.');
    }
    setDecoding(false);
  };

  const handleGainChange = (newGain: number) => {
    if (!fileData) return;
    setFileData({
      ...fileData,
      gain: newGain
    });
  };

  const handleMetadataChange = (newMetadata: any) => {
    if (!fileData) return;
    setFileData({
      ...fileData,
      metadata: newMetadata
    });
  };

  // Playback switches for table previewing
  const selectBatchPreview = (file: AudioFileData) => {
    if (selectedBatchFileId === file.id) {
      togglePlay();
    } else {
      setSelectedBatchFileId(file.id);
      setIsPlaying(false);
      setTimeout(() => {
        initAudioGraphAndPlay();
      }, 100);
    }
  };

  const handleRemoveTrackFromBatch = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setBatchFiles(prev => {
      const filtered = prev.filter(f => f.id !== id);
      if (selectedBatchFileId === id) {
        setSelectedBatchFileId(filtered[0]?.id || null);
      }
      return filtered;
    });
  };

  const handleTitleTagChange = (id: string, newTitle: string) => {
    setBatchFiles(prev => prev.map(f => {
      if (f.id === id) {
        return {
          ...f,
          metadata: {
            ...f.metadata,
            title: newTitle
          }
        };
      }
      return f;
    }));
  };

  // Run native single track sound boost and encoding
  const processAndExportMp3 = async () => {
    if (!fileData || !fileData.audioBuffer) return;

    setIsProcessing(true);
    setProgress({
      phase: 'loading',
      percentage: 5,
      message: 'Processing initialized. Preparing digital signal pathways...'
    });

    try {
      setProgress({
        phase: 'boosting',
        percentage: 15,
        message: normalizeEnabled 
          ? `Applying peak normalization (-1dB) and +${(20 * Math.log10(fileData.gain)).toFixed(1)}dB boost.`
          : `Activating Web-Audio DSP filter... Multiplying PCM peaks by ${fileData.gain.toFixed(1)}x.`
      });
      
      const boostResult = await offlineSoundBoost(fileData.audioBuffer, fileData.gain, normalizeEnabled);

      setProgress({
        phase: 'rendering',
        percentage: 30,
        message: 'Rendering PCM bitstream into premium constant bitrate encoder...'
      });

      const rawMp3Blob = await encodeAudioBufferToMp3(boostResult.renderedBuffer, (chunkPercent) => {
        const overallPercent = Math.round(30 + (chunkPercent * 0.60));
        setProgress({
          phase: 'encoding',
          percentage: overallPercent,
          message: `LameJS Multi-core Encoding: ${chunkPercent}% complete (Target Cbr: 320kbps).`
        });
      });

      setProgress({
        phase: 'tagging',
        percentage: 95,
        message: 'Writing ID3v2.3 tag headers & embedding high-res front Cover APIC.'
      });

      const taggedMp3Blob = await tagMp3File(rawMp3Blob, fileData.metadata);

      setProgress({
        phase: 'completed',
        percentage: 100,
        message: 'Binary MP3 package tagged successfully! Saving file to disk.'
      });

      const finalUrl = URL.createObjectURL(taggedMp3Blob);
      const downloadLink = document.createElement('a');
      const formattedTitle = (fileData.metadata.title.trim() || fileData.name.replace(/\.[^/.]+$/, ""))
        .replace(/[/\\?%*:|"<>]/g, '-');
      
      downloadLink.href = finalUrl;
      downloadLink.download = `${formattedTitle}.mp3`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      // Trigger automatic Google Chat workspace update if configured
      triggerAutoNotifyIfEnabled(fileData);

      setTimeout(() => {
        setIsProcessing(false);
        setProgress({ phase: 'idle', percentage: 0, message: '' });
      }, 1500);

    } catch (err: any) {
      console.error(err);
      setProgress({
        phase: 'error',
        percentage: 0,
        message: `Encoder Exception: ${err.message || 'Signal processing error'}`
      });
      setTimeout(() => {
        setIsProcessing(false);
      }, 4000);
    }
  };

  // Single file manual triggers
  const triggerManualUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.wav';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        handleFileUploaded(file);
      }
    };
    input.click();
  };

  // Batch file manual triggers
  const triggerBatchUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.wav';
    input.multiple = true;
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) {
        handleBatchFilesUploadedByList(files);
      }
    };
    input.click();
  };

  // Process multiple tracks sequentially
  const processAndExportBatch = async () => {
    if (batchFiles.length === 0) return;

    setIsProcessing(true);
    setActiveBatchIndex(0);

    for (let i = 0; i < batchFiles.length; i++) {
      const file = batchFiles[i];
      setActiveBatchIndex(i);
      setSelectedBatchFileId(file.id);

      setProgress({
        phase: 'loading',
        percentage: 0,
        message: `Batch Queue [${i + 1}/${batchFiles.length}]: Preparing "${file.name}"...`
      });

      try {
        setProgress({
          phase: 'boosting',
          percentage: 12,
          message: `Batch [${i + 1}/${batchFiles.length}]: Analyzing peaks and boosting signals for "${file.name}"...`
        });

        // Boost and Normalize track
        const boostResult = await offlineSoundBoost(file.audioBuffer!, batchGain, normalizeEnabled);

        setProgress({
          phase: 'rendering',
          percentage: 28,
          message: `Batch [${i + 1}/${batchFiles.length}]: Initiating constant 320kbps MP3 render...`
        });

        const rawMp3Blob = await encodeAudioBufferToMp3(boostResult.renderedBuffer, (chunkPercent) => {
          const overallPercent = Math.round(28 + (chunkPercent * 0.62));
          setProgress({
            phase: 'encoding',
            percentage: overallPercent,
            message: `Batch [${i + 1}/${batchFiles.length}]: Rendering tracks: ${chunkPercent}% complete.`
          });
        });

        setProgress({
          phase: 'tagging',
          percentage: 92,
          message: `Batch [${i + 1}/${batchFiles.length}]: Stitching ID3v2 metadata frames...`
        });

        // Pack shared album tags with individual title
        const fileMetadata = {
          ...batchMetadata,
          title: file.metadata.title.trim() || file.name.replace(/\.[^/.]+$/, "")
        };

        const taggedMp3Blob = await tagMp3File(rawMp3Blob, fileMetadata);

        setProgress({
          phase: 'completed',
          percentage: 100,
          message: `Batch [${i + 1}/${batchFiles.length}]: Done! Storing track ${fileMetadata.title}...`
        });

        // Secure file download
        const finalUrl = URL.createObjectURL(taggedMp3Blob);
        const downloadLink = document.createElement('a');
        const formattedTitle = (fileMetadata.title || file.name.replace(/\.[^/.]+$/, ""))
          .replace(/[/\\?%*:|"<>]/g, '-');
        
        downloadLink.href = finalUrl;
        downloadLink.download = `${formattedTitle}.mp3`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);

        // Compile track info envelope to trigger auto notifier
        const compiledTrack: AudioFileData = {
          ...file,
          metadata: fileMetadata,
          peakDb: file.peakDb
        };
        triggerAutoNotifyIfEnabled(compiledTrack);

        // Visual ease pause between rendering threads
        await new Promise(r => setTimeout(r, 1000));

      } catch (err: any) {
        console.error(`Batch rendering crash on track index ${i}:`, err);
        setProgress({
          phase: 'error',
          percentage: 0,
          message: `Error rendering file "${file.name}": ${err.message || 'DSP exception'}`
        });
        await new Promise(r => setTimeout(r, 3000));
      }
    }

    setIsProcessing(false);
    setActiveBatchIndex(null);
    setProgress({ phase: 'idle', percentage: 0, message: '' });
  };

  const durationStr = activeFile ? formatTime(activeFile.duration) : '00:00';
  const currentStr = formatTime(currentTime);

  // Compute actual dynamic buffer percentage
  const bufferPercent = useMemo(() => {
    if (decoding) return 40;
    if (isProcessing) {
      return progress.percentage;
    }
    return activeFile ? 100 : 0;
  }, [decoding, isProcessing, progress.percentage, activeFile]);

  return (
    <div id="desktop-wallpaper" className="w-full h-screen bg-designer-mesh text-slate-300 flex flex-col relative overflow-hidden font-sans select-none">
      
      {/* Moldavite & Wine Red background glowing aura circles */}
      <div id="moldavite-glow" className="absolute top-1/4 left-1/4 w-[45vw] h-[45vw] rounded-full bg-[#8FCE5E]/5 blur-[140px] pointer-events-none" />
      <div id="violet-glow" className="absolute bottom-1/4 right-1/4 w-[45vw] h-[45vw] rounded-full bg-fuchsia-950/10 blur-[150px] pointer-events-none" />

      {/* Hidden audio element for native media playback */}
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleAudioEnded}
        className="hidden"
      />

      {/* Main Apple style 3D cockpit dashboard container */}
      <div
        id="applet-window"
        className="w-full h-full bg-[#0A0612]/90 overflow-hidden flex flex-col z-10 transition-all duration-300 backdrop-blur-3xl"
      >
        {/* Navigation header consistent with spec */}
        <header className="h-14 border-b border-white/10 flex items-center justify-between px-6 bg-[#09020e] shrink-0 select-none">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] shadow-[0_0_14px_#f59e0b] animate-pulse"></div>
              <span className="font-bold tracking-tighter text-white text-xs sm:text-sm uppercase flex items-center gap-1">
                SONICSTRIDE{" "}
                <span className="text-glow-yellow font-extrabold tracking-widest pl-0.5">
                  PRO
                </span>
                <span className="text-[7.5px] bg-[#f43f5e]/15 text-[#f43f5e] font-mono tracking-widest px-1.5 py-0.5 rounded border border-[#f43f5e]/30">
                  D6
                </span>
              </span>
            </div>
            
            <nav className="flex gap-4 text-[10px] font-bold uppercase tracking-widest text-[#64748b] select-none">
              <button
                type="button"
                onClick={() => !isProcessing && setActiveTab('editor')}
                className={`pb-1 transition-all cursor-pointer border-b-2 hover:text-slate-200 ${
                  activeTab === 'editor' ? 'text-white border-[#f59e0b] text-glow-yellow' : 'border-transparent'
                }`}
              >
                Track Editor
              </button>
              <button
                type="button"
                onClick={() => !isProcessing && setActiveTab('batch')}
                className={`pb-1 transition-all cursor-pointer border-b-2 hover:text-slate-200 ${
                  activeTab === 'batch' ? 'text-white border-[#f43f5e] text-glow-blood' : 'border-transparent'
                }`}
              >
                Batch Processor
              </button>
              <button
                type="button"
                onClick={() => setShowGoogleChat(!showGoogleChat)}
                className={`pb-1 transition-all cursor-pointer border-b-2 hover:text-slate-200 flex items-center gap-1 ${
                  showGoogleChat ? 'text-[#a3e635] border-[#a3e635] text-glow-moldavite' : 'text-slate-500 border-transparent'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Google Chat</span>
              </button>
              <span 
                onClick={() => setAboutModalOpen(true)} 
                className="hover:text-slate-300 cursor-pointer transition-all pb-1 hidden sm:inline"
              >
                System Info
              </span>
            </nav>
          </div>

          <div className="flex items-center gap-5">
            <div className="flex flex-col items-end">
              <span className="text-[8px] text-slate-500 uppercase tracking-tighter font-mono">D6 DSP RAM STATE</span>
              <div className="w-24 h-1.5 bg-slate-950 rounded-full overflow-hidden mt-0.5 border border-white/5">
                <div
                  className="h-full bg-gradient-to-r from-[#f43f5e] via-[#f59e0b] to-[#a3e635] transition-all duration-300 shadow-[0_0_10px_#f59e0b]"
                  style={{ width: `${bufferPercent}%` }}
                ></div>
              </div>
            </div>
            <button 
              onClick={() => {
                if (activeTab === 'editor') {
                  setFileData(null);
                  handleStop();
                } else {
                  setBatchFiles([]);
                  handleStop();
                }
              }}
              className="px-2.5 py-1 bg-white/5 border border-white/10 rounded text-[9px] font-mono text-slate-400 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all cursor-pointer"
            >
              Reset view
            </button>
          </div>
        </header>

        {/* Workspace Body */}
        <div className="flex-1 flex overflow-hidden flex-col md:flex-row relative">
          
          {/* View Tab 1: Single Track Master Editor */}
          {activeTab === 'editor' && (
            <>
              {!fileData ? (
                <div
                  id="upload-dock"
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={triggerManualUpload}
                  className={`flex-1 m-6 border border-dashed rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 ${
                    dragOver
                      ? 'border-[#f59e0b] bg-[#221401]/30 shadow-[0_0_35px_rgba(245,158,11,0.25)]'
                      : 'border-white/10 hover:border-[#f59e0b]/40 bg-[#0A0410]/40 hover:bg-[#0A0410]/70'
                  }`}
                >
                  {decoding ? (
                    <div id="decoding-stage" className="flex flex-col items-center gap-4 animate-fade-in">
                      <div className="relative flex items-center justify-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-2 border-[#13071b] border-t-[#f59e0b]" />
                        <Disc className="h-6 w-6 text-[#f59e0b] absolute animate-pulse" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <p className="text-sm font-black text-white uppercase tracking-wider">
                          Decoding Lossless WAV...
                        </p>
                        <p className="text-[10px] text-[#f59e0b] font-mono tracking-wider">
                          STRIPPING ANALOG CHANNELS & SCANNING VOLUME PEAK DYNAMICALLY
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div id="waiting-upload-stage" className="flex flex-col items-center gap-4 max-w-md p-6">
                      <div className="bg-gradient-to-br from-[#800826]/40 to-amber-950/40 border border-[#f59e0b]/20 h-14 w-14 rounded-full flex items-center justify-center text-[#f59e0b] shadow-lg shadow-glow-yellow">
                        <Music className="h-6 w-6 animate-pulse" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <p className="text-sm uppercase tracking-widest text-[#f59e0b] font-black text-glow-yellow">
                          LOAD SINGLE WAV SOURCE
                        </p>
                        <p className="text-xs text-slate-400 leading-normal font-sans">
                          Drag and drop or browse files. Real-time sound boosting and high-fidelity -1 dB peak normalization will apply entirely client-side.
                        </p>
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <span className="bg-[#050109] border border-white/5 rounded px-3 py-1 text-[9px] text-slate-500 font-mono uppercase tracking-wider">
                          ⚡ LameJS High-speed rendering
                        </span>
                        <div 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveTab('batch');
                          }}
                          className="text-[9px] text-[#f59e0b] hover:text-yellow-400 font-bold uppercase tracking-widest flex items-center gap-0.5 underline hover:scale-105 transition-all"
                        >
                          Or enter batch mode <ChevronRight className="w-3 h-3" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex overflow-hidden flex-col md:flex-row w-full">
                  {/* Left Sidebar: Metadata */}
                  <aside className="w-72 border-r border-white/5 bg-[#09020e] flex flex-col p-5 overflow-y-auto shrink-0 gap-5">
                    <div>
                      <h3 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-3">Active File</h3>
                      <div className="p-3 bg-[#13071b]/40 border border-[#f59e0b]/10 rounded-lg flex items-center gap-3">
                        <div className="w-8 h-8 bg-amber-500/10 rounded flex items-center justify-center shrink-0">
                          <Music className="w-4 h-4 text-[#f59e0b]" />
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-xs font-semibold text-white truncate">{fileData.name}</p>
                          <p className="text-[9px] text-[#f59e0b] uppercase tracking-tight font-mono">
                            {(fileData.sampleRate / 1000).toFixed(1)}kHz • {fileData.channels === 2 ? 'Stereo' : 'Mono'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <MetadataEditor
                      metadata={fileData.metadata}
                      onChange={handleMetadataChange}
                      fileName={fileData.name}
                    />

                    <div className="mt-auto">
                      <button
                        type="button"
                        onClick={triggerManualUpload}
                        className="w-full py-2 bg-white/5 border border-dashed border-white/10 rounded text-[9px] uppercase tracking-widest font-bold text-slate-500 hover:text-[#f59e0b] hover:border-[#f59e0b]/30 transition-all cursor-pointer"
                      >
                        Select Another Track
                      </button>
                    </div>
                  </aside>

                  {/* Main Workspace (Waveform + Processor sliders) */}
                  <main className="flex-1 bg-[#050209] flex flex-col p-6 overflow-y-auto gap-6">
                    <WaveformVisualizer
                      audioBuffer={fileData.audioBuffer}
                      currentTime={currentTime}
                      duration={fileData.duration}
                      onSeek={handleSeek}
                      analyserNode={analyserNodeRef.current}
                      isPlaying={isPlaying}
                    />

                    <div id="processing-tools" className="grid grid-cols-1 gap-6">
                      <SoundProcessor
                        fileData={fileData}
                        onGainChange={handleGainChange}
                        onExport={processAndExportMp3}
                        progress={progress}
                        isProcessing={isProcessing}
                        normalizeEnabled={normalizeEnabled}
                        onToggleNormalize={setNormalizeEnabled}
                      />
                    </div>
                  </main>
                </div>
              )}
            </>
          )}

          {/* View Tab 2: Batch Processing Multi-Track Suite */}
          {activeTab === 'batch' && (
            <>
              {batchFiles.length === 0 ? (
                <div
                  id="batch-upload-dock"
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={triggerBatchUpload}
                  className={`flex-1 m-6 border border-dashed rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 ${
                    dragOver
                      ? 'border-[#f43f5e] bg-[#2d050c]/20 shadow-[0_0_35px_rgba(244,63,94,0.25)]'
                      : 'border-white/10 hover:border-[#f43f5e]/45 bg-[#0E0616]/40 hover:bg-[#0E0616]/75'
                  }`}
                >
                  {decoding ? (
                    <div className="flex flex-col items-center gap-4">
                      <div className="relative flex items-center justify-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-2 border-slate-800 border-t-[#f43f5e]" />
                        <Disc className="h-6 w-6 text-[#f43f5e] absolute animate-pulse" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <p className="text-sm font-black text-white uppercase tracking-wider">
                          DECODING BATCH WAVEFORMS...
                        </p>
                        <p className="text-[10px] text-[#f43f5e] font-mono tracking-widest">
                          CACHING MULTIPLE AUDIO STREAMS INTO SYSTEM MEMORY SEQUENTIALLY
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4 max-w-sm p-6 animate-fade-in">
                      <div className="bg-gradient-to-tr from-[#4c0519]/60 to-[#a3e635]/10 border border-white/5 h-14 w-14 rounded-full flex items-center justify-center text-[#f43f5e] shadow-lg shadow-glow-blood animate-pulse">
                        <Layers className="h-6 w-6" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <p className="text-sm uppercase tracking-widest text-[#f43f5e] font-black text-glow-blood">
                          UPLOAD WAV BATCH
                        </p>
                        <p className="text-xs text-slate-400 font-sans leading-relaxed">
                          Drag & drop multiple files or click to navigate. Album settings, gain boosting, and peak normalization will apply to all files in sequence.
                        </p>
                      </div>
                      <div className="mt-3 bg-[#050109] border border-white/5 rounded-lg px-3.5 py-1.5 text-[9px] text-[#f43f5e] font-mono font-bold uppercase tracking-wider">
                        💿 MULTI-TRACK LOSSLESS BATCH PIPELINE
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex overflow-hidden flex-col md:flex-row w-full">
                  {/* Left Sidebar: Shared Album Parameters */}
                  <aside className="w-72 border-r border-white/5 bg-[#09020e] flex flex-col p-5 overflow-y-auto shrink-0 gap-5">
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Shared Metadata</h3>
                        <span className="text-[7.5px] bg-[#f59e0b]/15 text-[#f59e0b] font-mono tracking-widest px-2 py-0.5 rounded border border-[#f59e0b]/30 uppercase font-bold">Album Template</span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-sans leading-relaxed mb-4">
                        Tweak these album tags once. They apply to all exported MP3 tracks automatically, maintaining a beautiful structure.
                      </p>
                    </div>

                    <MetadataEditor
                      metadata={batchMetadata}
                      onChange={setBatchMetadata}
                      fileName="BATCH EXPORT"
                      hideTitle={true}
                    />

                    <div className="mt-auto font-sans">
                      <button
                        type="button"
                        onClick={triggerBatchUpload}
                        className="w-full py-2 bg-[#f43f5e]/5 border border-[#f43f5e]/15 rounded text-[9px] uppercase tracking-widest font-black text-slate-300 hover:text-white hover:bg-[#f43f5e]/20 hover:border-[#f43f5e]/30 transition-all cursor-pointer"
                      >
                        + Add files to batch
                      </button>
                    </div>
                  </aside>

                  {/* Main Workspace: Tracks list spreadsheet & settings */}
                  <main className="flex-1 bg-[#050209] flex flex-col p-5 overflow-y-auto gap-5">
                    
                    {/* Active Track Preview Waveform */}
                    <div className="bg-[#0c0516]/40 border border-white/5 rounded-2xl p-4 flex flex-col gap-2">
                      <div className="flex justify-between items-center text-[10px] font-mono text-slate-500">
                        <span className="flex items-center gap-1 uppercase tracking-widest"><Sparkles className="w-3.5 h-3.5 text-[#f43f5e]" /> Live Preview Waveform</span>
                        <span className="text-[#a3e635] text-glow-moldavite font-black uppercase tracking-wider">ACTIVE PREVIEW: {activeFile?.name}</span>
                      </div>
                      
                      {activeFile ? (
                        <WaveformVisualizer
                          audioBuffer={activeFile.audioBuffer}
                          currentTime={currentTime}
                          duration={activeFile.duration}
                          onSeek={handleSeek}
                          analyserNode={analyserNodeRef.current}
                          isPlaying={isPlaying}
                        />
                      ) : (
                        <div className="h-[120px] bg-slate-950/40 rounded flex items-center justify-center text-slate-600 font-mono text-xs font-bold uppercase tracking-widest">
                          Select a track below to load its waveform scope
                        </div>
                      )}
                    </div>

                    {/* Bloomberg Standard 3D Spreadsheet Tracklist */}
                    <div className="flex-1 bg-[#0E0616] border border-white/5 rounded-xl shadow-lg flex flex-col overflow-hidden">
                      <div className="h-10 border-b border-white/5 bg-[#12071d] flex items-center px-4 justify-between select-none">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Tracklist Queue ({batchFiles.length} Loaded)</span>
                        <span className="text-[8.5px] text-[#f59e0b] font-mono font-bold">EDIT TRACK TITLES DIRECTLY</span>
                      </div>

                      <div className="flex-1 overflow-y-auto">
                        <table className="w-full border-collapse text-left text-xs text-slate-300 font-sans">
                          <thead>
                            <tr className="border-b border-white/5 text-[9px] uppercase font-mono text-slate-500 bg-slate-950/20 select-none">
                              <th className="py-2.5 px-4 w-12 text-center">Preview</th>
                              <th className="py-2.5 px-4">Original Filename</th>
                              <th className="py-2.5 px-4">ID3 Track Title tag</th>
                              <th className="py-2.5 px-4 w-24">Peak Level</th>
                              <th className="py-2.5 px-4 w-20">Length</th>
                              <th className="py-2.5 px-4 w-12 text-center">Discard</th>
                            </tr>
                          </thead>
                          <tbody>
                            {batchFiles.map((file, idx) => {
                              const isActive = activeFile?.id === file.id;
                              const isRenderingThis = isProcessing && activeBatchIndex === idx;
                              return (
                                <tr 
                                  key={file.id} 
                                  onClick={() => setSelectedBatchFileId(file.id)}
                                  className={`border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer group divide-x divide-white/5 ${
                                    isActive ? 'bg-[#1c040d] border-l-2 border-l-[#f43f5e]' : ''
                                  }`}
                                >
                                  {/* Inline play control button */}
                                  <td className="py-2 px-2 text-center">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        selectBatchPreview(file);
                                      }}
                                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                                        isActive && isPlaying 
                                          ? 'bg-[#f43f5e] text-white shadow-[0_0_10px_#f43f5e]' 
                                          : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white'
                                      }`}
                                    >
                                      {isActive && isPlaying ? (
                                        <Pause className="w-3.5 h-3.5 fill-current" />
                                      ) : (
                                        <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                                      )}
                                    </button>
                                  </td>

                                  <td className="py-2 px-4 font-mono text-[11px] font-semibold text-slate-400 max-w-[180px] truncate">
                                    {isRenderingThis && (
                                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#f43f5e] animate-ping mr-1.5"></span>
                                    )}
                                    {file.name}
                                  </td>

                                  {/* Inline editable title tag field */}
                                  <td className="py-1 px-4">
                                    <input
                                      type="text"
                                      disabled={isProcessing}
                                      value={file.metadata.title}
                                      onClick={(e) => e.stopPropagation()} // halt row select firing
                                      onChange={(e) => handleTitleTagChange(file.id, e.target.value)}
                                      className="w-full bg-[#050109] border border-white/5 hover:border-white/20 focus:bg-slate-950 focus:border-[#f43f5e]/50 rounded px-2.5 py-1.5 text-xs text-white placeholder-slate-700 font-sans outline-none transition-all truncate"
                                      placeholder="Custom title tag..."
                                    />
                                  </td>

                                  <td className="py-2 px-4 font-mono text-[11px] text-[#f59e0b] font-bold">
                                    {file.peakDb !== undefined ? `${file.peakDb.toFixed(1)} dBFS` : 'Calculating...'}
                                  </td>

                                  <td className="py-2 px-4 font-mono text-[11px] text-slate-500">
                                    {formatTime(file.duration)}
                                  </td>

                                  <td className="py-2 px-2 text-center">
                                    <button
                                      type="button"
                                      disabled={isProcessing}
                                      onClick={(e) => handleRemoveTrackFromBatch(file.id, e)}
                                      className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-all"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Batch Settings Bar & Compile Action Console */}
                    <div className="bg-[#0E0616] border border-white/5 rounded-xl p-4 flex flex-col gap-4">
                      
                      {/* Configuration controls */}
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                        <div className="md:col-span-5 flex flex-col gap-1.5 font-sans">
                          <div className="flex justify-between text-[11px] font-bold text-white uppercase tracking-tight">
                            <span>Batch Sound Boost (Gain)</span>
                            <span className="text-[#f59e0b] font-mono font-bold">
                              +{batchGain === 1 ? '0.0' : (20 * Math.log10(batchGain)).toFixed(1)} dB (x{batchGain.toFixed(1)})
                            </span>
                          </div>
                          <div className="bg-slate-950 border border-white/5 rounded-lg p-2 flex items-center gap-3">
                            <span className="text-[9px] font-mono text-slate-600">1x</span>
                            <input
                              type="range"
                              min="1"
                              max="5"
                              step="0.1"
                              value={batchGain}
                              disabled={isProcessing}
                              onChange={(e) => setBatchGain(parseFloat(e.target.value))}
                              className="flex-1 accent-[#f59e0b] h-1"
                            />
                            <span className="text-[9px] font-mono text-slate-600">5x</span>
                          </div>
                        </div>

                        {/* Normalization switch */}
                        <div className="md:col-span-4 flex items-center justify-between bg-slate-950 border border-white/5 rounded-lg p-3 font-sans">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-slate-400 uppercase font-mono tracking-tight font-bold">Normalization Node</span>
                            <span className="text-[8px] text-[#a3e635] font-mono font-bold uppercase">Target -1 dB Peak Volume</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => !isProcessing && setNormalizeEnabled(!normalizeEnabled)}
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

                        {/* Action buttons */}
                        <div className="md:col-span-3">
                          {!isProcessing ? (
                            <button
                              type="button"
                              onClick={processAndExportBatch}
                              className="w-full py-3 bg-[#f43f5e] text-white font-black text-[10px] uppercase tracking-widest rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-[0_0_20px_rgba(244,63,94,0.35)] hover:brightness-110 active:scale-98 transition-all"
                            >
                              <Layers className="w-3.5 h-3.5" /> Compile Batch
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled
                              className="w-full py-2.5 bg-slate-900 border border-white/5 text-slate-500 font-bold text-[9px] uppercase tracking-widest rounded-lg flex items-center justify-center gap-1.5"
                            >
                              <Disc className="w-3.5 h-3.5 animate-spin text-[#f43f5e]" /> Compiling...
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Rendering tracker overlay */}
                      {isProcessing && (
                        <div className="bg-[#05010a] border border-[#f43f5e]/20 rounded-lg p-3.5 flex flex-col gap-2">
                          <div className="flex justify-between items-center text-[10px] font-mono">
                            <span className="text-[#f59e0b] uppercase animate-pulse flex items-center gap-1.5 font-bold">
                              <span className="inline-block w-2 h-2 rounded-full bg-[#f59e0b] animate-ping"></span> 
                              Phase: {progress.phase.toUpperCase()}
                            </span>
                            <span className="font-bold text-glow-yellow">{progress.percentage}%</span>
                          </div>
                          
                          <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-white/5">
                            <div
                              className="bg-stretch bg-gradient-to-r from-[#f43f5e] via-[#f59e0b] to-[#a3e635] h-full rounded-full transition-all duration-300"
                              style={{ width: `${progress.percentage}%` }}
                            />
                          </div>

                          <p className="text-[9.5px] text-slate-400 font-mono text-center">
                            {progress.message}
                          </p>
                        </div>
                      )}

                    </div>

                  </main>
                </div>
              )}
            </>
          )}

          {showGoogleChat && (
            <aside id="google-chat-sidebar" className="w-80 border-l border-white/5 bg-[#0A0512] flex flex-col shrink-0 animate-fade-in z-20">
              <GoogleChatIntegration 
                activeFile={activeFile} 
                onClose={() => setShowGoogleChat(false)} 
              />
            </aside>
          )}

        </div>

        {/* Global Control Player Footer persistent inside window frame */}
        {activeFile && (
          <footer className="h-20 border-t border-white/5 bg-[#0A0311] flex items-center px-6 gap-6 shrink-0 z-20">
            {/* Playback action knobs */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleSeek(currentTime - 10)}
                className="p-1.5 text-slate-500 hover:text-white transition-colors cursor-pointer shrink-0"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M8.445 14.832A1 1 0 0010 14V6a1 1 0 00-1.555-.832l-6 4a1 1 0 000 1.664l6 4zM16.445 14.832A1 1 0 0018 14V6a1 1 0 00-1.555-.832l-6 4a1 1 0 000 1.664l6 4z" />
                </svg>
              </button>
              
              <button
                type="button"
                onClick={togglePlay}
                className="w-10 h-10 rounded-full bg-white text-[#0A0A0C] flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.25)] hover:bg-[#f59e0b] transition-colors cursor-pointer shrink-0"
              >
                {isPlaying ? (
                  <Pause className="h-4.5 w-4.5 fill-current text-[#0A0A0C]" />
                ) : (
                  <Play className="h-4.5 w-4.5 fill-current text-[#0A0A0C] ml-0.5" />
                )}
              </button>

              <button
                type="button"
                onClick={() => handleSeek(currentTime + 10)}
                className="p-1.5 text-slate-500 hover:text-white transition-colors cursor-pointer shrink-0"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832l6-4a1 1 0 000-1.664l-6-4zM11.555 5.168A1 1 0 0010 6v8a1 1 0 001.555.832l6-4a1 1 0 000-1.664l-6-4z" />
                </svg>
              </button>
            </div>

            {/* Seeking progress slider bar overlay */}
            <div className="flex-1 flex flex-col gap-1.5 min-w-0">
              <div className="flex items-center justify-between text-[10px] font-mono tracking-wider">
                <span className="text-white font-semibold">
                  {currentStr} <span className="text-slate-600">/</span> {durationStr}
                </span>
                <span className="text-slate-500 hidden sm:inline truncate max-w-sm uppercase font-bold text-[9px]">
                  STREAM ACTIVE: {activeFile.metadata.title || activeFile.name.replace(/\.[^/.]+$/, "")}
                </span>
              </div>
              <div className="relative w-full flex items-center group">
                <input
                  type="range"
                  min={0}
                  max={activeFile.duration}
                  value={currentTime}
                  onChange={(e) => handleSeek(parseFloat(e.target.value))}
                  className="w-full h-1 bg-[#10071c] accent-[#f59e0b] rounded-full cursor-pointer appearance-none outline-none group-hover:bg-purple-950/80 transition-all border border-white/5"
                />
              </div>
            </div>

            {/* Active stats display watermark (Bloomberg spec compliance!) */}
            <div className="hidden lg:flex flex-col items-end gap-0.5 shrink-0 select-none text-[8px] font-mono text-slate-500 text-right pr-2">
              <span className="text-[#f59e0b] uppercase tracking-widest font-black text-glow-yellow">© RAAJEEB PRODUCTION</span>
              <span>DEPLOYED • ALL RIGHTS RESERVED</span>
            </div>

            {/* Extra hardware settings (Speed rate slider / mute toggle indicators) */}
            <div className="flex items-center gap-4 shrink-0">
              {/* Playback speed multiplier badges */}
              <div className="hidden lg:flex items-center gap-1.5 bg-white/5 border border-white/5 px-2.5 py-1 rounded-md text-[9px] font-mono text-slate-400">
                <span className="text-slate-600 font-bold">SPD:</span>
                {[1.0, 1.5, 2.0].map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => setPlaybackRate(rate)}
                    className={`px-1.5 py-0.5 rounded transition cursor-pointer ${
                      playbackRate === rate
                        ? 'bg-[#f59e0b]/10 text-[#f59e0b] font-bold border border-[#f59e0b]/20 text-glow-yellow'
                        : 'hover:text-slate-200'
                    }`}
                  >
                    {rate.toFixed(1)}x
                  </button>
                ))}
              </div>

              {/* Hardware hardware volume widgets */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsMuted(!isMuted)}
                  className="text-slate-500 hover:text-white transition-colors cursor-pointer"
                >
                  {isMuted || volume === 0 ? <VolumeX className="h-4 w-4 text-red-500 animate-pulse" /> : <Volume2 className="h-4 w-4 text-slate-400" />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  disabled={isMuted}
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-16 accent-[#f59e0b] h-1 bg-slate-950 rounded-full cursor-pointer appearance-none outline-none disabled:opacity-20 border border-white/5"
                />
              </div>
            </div>
          </footer>
        )}

      </div>

      {/* Persistent footer copyright settings */}
      <footer className="mt-4 flex flex-col items-center justify-center gap-1 text-center font-mono select-none text-[9.5px] uppercase tracking-wider text-slate-600">
        <p className="flex items-center gap-1 opacity-70">
          <span>© {new Date().getFullYear()}</span> 
          <strong className="text-white">RAAJEEB PRODUCTION</strong>. 
          <span>ALL RIGHTS RESERVED • DEPLOYMENT HOST SECURE</span>
        </p>
        <p className="opacity-50 text-[8px] flex items-center gap-2">
          <span>PORT: 3000 (ONLINE)</span>
          <span>•</span>
          <span className="hover:text-fuchsia-400 cursor-pointer text-slate-500">raaj33b@gmail.com</span>
        </p>
      </footer>

      {/* Cybernetic Dialog Help info popup board */}
      {aboutModalOpen && (
        <div id="about-suite-modal" className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-[#0c0516] border border-white/10 max-w-sm w-full rounded-xl overflow-hidden shadow-2xl flex flex-col shadow-[#8FCE5E]/5 border-[#8FCE5E]/10 border-glowing-wine">
            <div className="bg-white/5 px-4 py-3 border-b border-white/5 flex justify-between items-center select-none">
              <span className="text-[10px] font-sans font-bold tracking-widest uppercase text-slate-300">
                System Interface Profile
              </span>
              <button
                onClick={() => setAboutModalOpen(false)}
                className="text-slate-500 hover:text-slate-300 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="p-5 flex flex-col gap-4 text-slate-400 text-xs font-sans leading-relaxed">
              <div className="flex items-center gap-3 bg-white/5 p-3 rounded-lg border border-white/5 bg-gradient-to-br from-purple-950/20 to-wine-950/20">
                <Sparkles className="h-8 w-8 text-[#8FCE5E] shadow-[0_0_10px_rgba(143,206,94,0.4)] stroke-[1.5]" />
                <div className="flex flex-col">
                  <span className="font-sans font-bold text-white uppercase text-xs tracking-wider">SONICSTRIDE PRO LP</span>
                  <span className="text-[9px] text-[#8FCE5E] font-mono">B-RELEASE 1.28.3 • SECURE RENDER</span>
                </div>
              </div>

              <p className="text-slate-400 text-[11px]">
                Sonicstride Pro is a leading offline browser-based digital audio processor. Configured specifically under the <strong className="text-white">Raajeeb Production</strong> guidelines.
              </p>

              <div className="flex flex-col gap-2 pt-1 border-t border-white/5">
                <div className="flex items-center gap-2 text-[10px] font-mono text-slate-300">
                  <span className="text-[#8FCE5E]">⚡</span>
                  <span><strong>Zero Server Overhead:</strong> Complete client local DSP.</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-mono text-slate-300">
                  <span className="text-[#8FCE5E]">⚡</span>
                  <span><strong>Auto -1.0 dB Normalizer:</strong> Constant loudness limit.</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-mono text-slate-300">
                  <span className="text-[#8FCE5E]">⚡</span>
                  <span><strong>Sequencing Batch Render:</strong> Export entire queues.</span>
                </div>
              </div>

              <div className="mt-2 text-center text-[10px] font-mono border-t border-white/5 pt-3 text-slate-500">
                <p>Support: <span className="text-[#8FCE5E]">raaj33b@gmail.com</span></p>
                <p className="mt-1 text-[8.5px]">DEVELOPED BY RAAJEEB PRODUCTION</p>
                <p className="text-[8px] uppercase tracking-widest text-[#8FCE5E]/50 mt-1">ALL RIGHTS RESERVED</p>
              </div>

              <button
                onClick={() => setAboutModalOpen(false)}
                className="bg-white/5 hover:bg-white/10 text-slate-200 py-2.5 px-4 rounded border border-white/10 hover:border-white/20 transition font-mono uppercase tracking-widest text-[9px] text-center mt-2 cursor-pointer"
              >
                Close properties
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
