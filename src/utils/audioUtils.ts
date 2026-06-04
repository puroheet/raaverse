import { ID3Writer } from 'browser-id3-writer';
import { AudioMetadata } from '../types';

/**
 * Scans and calculates peak levels of an AudioBuffer in decibels.
 */
export function analyzeAudioBuffer(audioBuffer: AudioBuffer): { peakDb: number; peakLevel: number } {
  const channels = audioBuffer.numberOfChannels;
  let maxPeak = 0;
  for (let c = 0; c < channels; c++) {
    const data = audioBuffer.getChannelData(c);
    const len = data.length;
    for (let i = 0; i < len; i++) {
      const val = Math.abs(data[i]);
      if (val > maxPeak) {
        maxPeak = val;
      }
    }
  }
  const peakDb = maxPeak === 0 ? -120 : 20 * Math.log10(maxPeak);
  return { peakDb, peakLevel: maxPeak };
}

/**
 * Uses Web Audio API OfflineAudioContext to apply gain/sound boost on a background thread.
 * This also supports optional peak amplitude normalization to -1 dB before/after user scaling.
 */
export async function offlineSoundBoost(
  sourceBuffer: AudioBuffer,
  gainFactor: number,
  normalize: boolean = false
): Promise<{
  renderedBuffer: AudioBuffer;
  originalPeakDb: number;
  appliedScaleFactor: number;
}> {
  const { numberOfChannels, sampleRate, length } = sourceBuffer;
  
  // Compute initial peak amplitude
  const { peakDb, peakLevel } = analyzeAudioBuffer(sourceBuffer);
  
  // Normalization target: -1 dB (floating point coefficient ≈ 0.891251)
  let normScale = 1.0;
  if (normalize && peakLevel > 0) {
    normScale = 0.891251 / peakLevel;
  }
  
  const finalGain = normScale * gainFactor;
  
  // Create an offline context
  const offlineCtx = new OfflineAudioContext(numberOfChannels, length, sampleRate);
  
  // Create source and gain node
  const source = offlineCtx.createBufferSource();
  source.buffer = sourceBuffer;
  
  const gainNode = offlineCtx.createGain();
  gainNode.gain.value = finalGain;
  
  // Connect nodes
  source.connect(gainNode);
  gainNode.connect(offlineCtx.destination);
  
  // Start playback
  source.start(0);
  
  // Render
  const renderedBuffer = await offlineCtx.startRendering();
  
  return {
    renderedBuffer,
    originalPeakDb: peakDb,
    appliedScaleFactor: finalGain
  };
}

/**
 * Non-blocking, chunked browser-based MP3 Encoder using LameJS at 320 kbps.
 * Uses requestAnimationFrame to prevent thread lockups and reports crisp progress.
 */
export function encodeAudioBufferToMp3(
  audioBuffer: AudioBuffer,
  onProgress: (percentage: number) => void
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      const globalWindow = window as any;
      if (!globalWindow.lamejs) {
        throw new Error('LameJS library is not loaded. Please ensure you are online and reload.');
      }

      const { Mp3Encoder } = globalWindow.lamejs;
      const channels = audioBuffer.numberOfChannels;
      const sampleRate = audioBuffer.sampleRate;
      const totalLength = audioBuffer.length;
      
      // Output premium high quality 320 kbps bit rate
      const kbps = 320;
      const encoder = new Mp3Encoder(channels, sampleRate, kbps);
      const mp3Data: Int8Array[] = [];

      // We process the buffer in chunk increments
      const chunkSize = 115200; // ~2.6s chunks at 44.1kHz for optimal balance between progress updates & speed
      let offset = 0;

      // Extract raw audio data
      const channelData: Float32Array[] = [];
      for (let c = 0; c < channels; c++) {
        channelData.push(audioBuffer.getChannelData(c));
      }

      function processChunk() {
        if (offset >= totalLength) {
          // Flush the encoder buffer
          const flushBuf = encoder.flush();
          if (flushBuf.length > 0) {
            mp3Data.push(new Int8Array(flushBuf));
          }
          
          const mp3Blob = new Blob(mp3Data, { type: 'audio/mp3' });
          onProgress(100);
          resolve(mp3Blob);
          return;
        }

        const size = Math.min(chunkSize, totalLength - offset);
        
        // Prepare 16-bit PCM buffers
        if (channels === 2) {
          // Stereo
          const leftPcm = new Int16Array(size);
          const rightPcm = new Int16Array(size);
          const leftCh = channelData[0];
          const rightCh = channelData[1];

          for (let i = 0; i < size; i++) {
            const idx = offset + i;
            let l = leftCh[idx];
            let r = rightCh[idx];

            // Standard clamping
            if (l < -1) l = -1;
            else if (l > 1) l = 1;
            
            if (r < -1) r = -1;
            else if (r > 1) r = 1;

            leftPcm[i] = l < 0 ? l * 0x8000 : l * 0x7FFF;
            rightPcm[i] = r < 0 ? r * 0x8000 : r * 0x7FFF;
          }

          const mp3buf = encoder.encodeBuffer(leftPcm, rightPcm);
          if (mp3buf.length > 0) {
            mp3Data.push(new Int8Array(mp3buf));
          }
        } else {
          // Mono (or treat multiple channels as downmixed mono)
          const monoPcm = new Int16Array(size);
          const monoCh = channelData[0];

          for (let i = 0; i < size; i++) {
            const idx = offset + i;
            let m = monoCh[idx];

            if (m < -1) m = -1;
            else if (m > 1) m = 1;

            monoPcm[i] = m < 0 ? m * 0x8000 : m * 0x7FFF;
          }

          const mp3buf = encoder.encodeBuffer(monoPcm);
          if (mp3buf.length > 0) {
            mp3Data.push(new Int8Array(mp3buf));
          }
        }

        offset += size;
        const progress = Math.round((offset / totalLength) * 100);
        onProgress(progress);
        
        // Defer next processing chunk to keep UI snappy
        setTimeout(processChunk, 10);
      }

      // Start encoding loop
      processChunk();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Tag an MP3 ArrayBuffer with custom ID3v2.3 tags (Title, Artist, Album, Year, Genre, Cover art).
 */
export async function tagMp3File(
  mp3Blob: Blob,
  metadata: AudioMetadata
): Promise<Blob> {
  const mp3ArrayBuffer = await mp3Blob.arrayBuffer();
  const writer = new ID3Writer(mp3ArrayBuffer);

  // Set Core text frames
  if (metadata.title.trim()) {
    writer.setFrame('TIT2', metadata.title.trim());
  }
  if (metadata.artist.trim()) {
    writer.setFrame('TPE1', [metadata.artist.trim()]);
  }
  if (metadata.album.trim()) {
    writer.setFrame('TALB', metadata.album.trim());
  }
  if (metadata.year.trim()) {
    const parsedYear = parseInt(metadata.year.trim(), 10);
    if (!isNaN(parsedYear)) {
      writer.setFrame('TYER', parsedYear);
    }
  }
  if (metadata.genre.trim()) {
    writer.setFrame('TCON', [metadata.genre.trim()]);
  }

  // Set cover art frame if available
  if (metadata.coverBuffer) {
    writer.setFrame('APIC', {
      type: 3, // Cover front
      data: metadata.coverBuffer,
      description: 'Cover',
      useUnicodeEncoding: false
    });
  }

  writer.addTag();
  return writer.getBlob();
}

/**
 * Format filesizes nicely
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Format timestamps nicely in MM:SS
 */
export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
