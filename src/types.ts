export interface AudioMetadata {
  title: string;
  artist: string;
  album: string;
  year: string;
  genre: string;
  coverUrl: string | null;
  coverBuffer: ArrayBuffer | null;
}

export interface AudioFileData {
  id: string;
  name: string;
  size: number;
  duration: number;
  sampleRate: number;
  channels: number;
  audioBuffer: AudioBuffer | null;
  metadata: AudioMetadata;
  gain: number; // sound boost factor, default 1.0 (no boost)
  peakDb?: number; 
  peakLevel?: number;
  objectUrl?: string; // raw audio blob url for direct player routing
}

export interface RenderProgress {
  phase: 'idle' | 'loading' | 'boosting' | 'rendering' | 'encoding' | 'tagging' | 'completed' | 'error';
  percentage: number;
  message: string;
}
