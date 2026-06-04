import React, { useRef } from 'react';
import { AudioMetadata } from '../types';
import { Music, Upload, Calendar, Hash, FolderHeart, Disc, User, Heart } from 'lucide-react';

interface MetadataEditorProps {
  metadata: AudioMetadata;
  onChange: (metadata: AudioMetadata) => void;
  fileName: string;
  hideTitle?: boolean;
}

export default function MetadataEditor({ metadata, onChange, fileName, hideTitle = false }: MetadataEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTextChange = (field: keyof Omit<AudioMetadata, 'coverUrl' | 'coverBuffer'>, value: string) => {
    onChange({
      ...metadata,
      [field]: value
    });
  };

  const handleCoverUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload a valid image file (PNG/JPG).');
      return;
    }

    // Capture standard preview URL
    const coverUrl = URL.createObjectURL(file);

    // Read byte content as ArrayBuffer for ID3 tag injecting
    const reader = new FileReader();
    reader.onload = (e) => {
      const coverBuffer = e.target?.result as ArrayBuffer;
      onChange({
        ...metadata,
        coverUrl,
        coverBuffer
      });
    };
    reader.readAsArrayBuffer(file);
  };

  const handleIconClick = () => {
    fileInputRef.current?.click();
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleCoverUpload(e.dataTransfer.files[0]);
    }
  };

  return (
    <div id="metadata-editor-card" className="bg-[#0e0716] border border-white/5 rounded-xl p-5 flex flex-col gap-5 shadow-lg">
      <div id="metadata-editor-title" className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <Disc className="h-4 w-4 text-[#f59e0b] shadow-[0_0_10px_rgba(245,158,11,0.6)] animate-spin" />
          <h3 className="font-sans font-bold text-[10px] text-slate-300 uppercase tracking-widest">
            Metadata Editor
          </h3>
        </div>
        <span className="text-[9px] text-[#f59e0b] font-mono font-bold uppercase tracking-wider">ID3v2.3 Core</span>
      </div>

      <div id="metadata-layout" className="flex flex-col gap-4">
        {/* Album Artwork Frame Uploader */}
        <div id="cover-art-container" className="flex flex-col gap-1.5">
          <label className="text-[10px] text-slate-500 uppercase tracking-tighter font-mono">
            Album Cover Art
          </label>
          <div
            id="artwork-dragzone"
            onDragOver={onDragOver}
            onDrop={onDrop}
            onClick={handleIconClick}
            className={`relative group w-full h-32 bg-[#050109] rounded-lg overflow-hidden border border-dashed transition-all duration-300 flex flex-col items-center justify-center cursor-pointer text-center p-3 ${
              metadata.coverUrl ? 'border-white/10 hover:border-[#f59e0b]/50' : 'border-white/10 hover:border-[#f59e0b]/50 hover:bg-white/5'
            }`}
          >
            {metadata.coverUrl ? (
              <>
                <img
                  src={metadata.coverUrl}
                  alt="Album cover preview"
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  referrerPolicy="no-referrer"
                />
                {/* Dark Hover Reveal overlay */}
                <div className="absolute inset-0 bg-[#0A0A0C]/90 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1 transition-opacity duration-300 z-10">
                  <Upload className="h-4 w-4 text-[#f59e0b]" />
                  <span className="text-[10px] text-slate-300 font-mono">Replace Artwork</span>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-1.5 z-10 text-slate-400 group-hover:text-[#f59e0b] transition-colors">
                <Music className="h-6 w-6 stroke-[1.5] text-slate-500" />
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-black tracking-widest text-[#f59e0b]">+ Add Artwork</span>
                  <span className="text-[8px] text-slate-500 font-mono uppercase">Drag images or click</span>
                </div>
              </div>
            )}
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && handleCoverUpload(e.target.files[0])}
            />
          </div>
          {metadata.coverUrl && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onChange({ ...metadata, coverUrl: null, coverBuffer: null });
              }}
              className="text-[9px] text-red-400 hover:text-red-300 font-mono uppercase tracking-widest underline transition-colors cursor-pointer self-end"
            >
              Remove cover image
            </button>
          )}
        </div>

        {/* Text Input Fields */}
        <div id="metadata-inputs" className="flex flex-col gap-3">
          {/* Track Title */}
          {!hideTitle && (
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500 uppercase tracking-tighter">Track Title</label>
              <input
                type="text"
                placeholder={fileName ? fileName.replace(/\.[^/.]+$/, "") : "Song Title"}
                value={metadata.title}
                onChange={(e) => handleTextChange('title', e.target.value)}
                className="w-full bg-[#050109] border border-white/5 rounded px-3 py-2 text-xs focus:border-[#f59e0b]/50 outline-none transition-all text-white placeholder-slate-700 font-sans"
              />
            </div>
          )}

          {/* Artist */}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-500 uppercase tracking-tighter">Artist</label>
            <input
              type="text"
              placeholder="Synthetix Wave"
              value={metadata.artist}
              onChange={(e) => handleTextChange('artist', e.target.value)}
              className="w-full bg-[#050109] border border-white/5 rounded px-3 py-2 text-xs focus:border-[#f59e0b]/50 outline-none transition-all text-white placeholder-slate-700 font-sans"
            />
          </div>

          {/* Album */}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-500 uppercase tracking-tighter">Album Name (TALB)</label>
            <input
              type="text"
              placeholder="Cybernetic Dreams"
              value={metadata.album}
              onChange={(e) => handleTextChange('album', e.target.value)}
              className="w-full bg-[#050109] border border-white/5 rounded px-3 py-2 text-xs focus:border-[#f59e0b]/50 outline-none transition-all text-white placeholder-slate-700 font-sans"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Year */}
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500 uppercase tracking-tighter">Year</label>
              <input
                type="text"
                placeholder="2026"
                maxLength={4}
                value={metadata.year}
                onChange={(e) => handleTextChange('year', e.target.value.replace(/\D/g, ''))}
                className="w-full bg-[#050109] border border-white/5 rounded px-3 py-2 text-xs focus:border-[#f59e0b]/50 outline-none transition-all text-white placeholder-slate-700 font-mono"
              />
            </div>

            {/* Genre */}
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500 uppercase tracking-tighter">Genre</label>
              <input
                type="text"
                placeholder="Retrowave"
                value={metadata.genre}
                onChange={(e) => handleTextChange('genre', e.target.value)}
                className="w-full bg-[#050109] border border-white/5 rounded px-3 py-2 text-xs focus:border-[#f59e0b]/50 outline-none transition-all text-white placeholder-slate-700 font-sans"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
