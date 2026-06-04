import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Send, 
  Check, 
  AlertCircle, 
  Sparkles, 
  Settings, 
  History, 
  Wifi, 
  WifiOff, 
  ExternalLink,
  ChevronRight,
  Music,
  DiscAlbum,
  Trash2,
  X
} from 'lucide-react';
import { AudioFileData } from '../types';

interface GoogleChatIntegrationProps {
  activeFile: AudioFileData | null;
  onClose?: () => void;
}

interface ChatLogMessage {
  id: string;
  timestamp: string;
  trackName: string;
  destination: string;
  status: 'success' | 'failed';
  errorDetails?: string;
  messageType: 'webhook' | 'oauth';
  payloadSummary: string;
}

export default function GoogleChatIntegration({ activeFile, onClose }: GoogleChatIntegrationProps) {
  // Connection states
  const [connectionMethod, setConnectionMethod] = useState<'webhook' | 'token'>('webhook');
  const [webhookUrl, setWebhookUrl] = useState<string>(() => localStorage.getItem('sonic_gchat_webhook') || '');
  const [accessToken, setAccessToken] = useState<string>(() => localStorage.getItem('sonic_gchat_token') || '');
  const [targetSpaceId, setTargetSpaceId] = useState<string>(() => localStorage.getItem('sonic_gchat_space') || '');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ status: 'success' | 'failed' | null; message: string }>({ status: null, message: '' });

  // Preferences
  const [autoNotify, setAutoNotify] = useState<boolean>(() => localStorage.getItem('sonic_gchat_autonotify') === 'true');
  const [includeDetails, setIncludeDetails] = useState<boolean>(() => localStorage.getItem('sonic_gchat_details') !== 'false');

  // Custom messaging
  const [customComment, setCustomComment] = useState<string>('');
  const [isSendingCustom, setIsSendingCustom] = useState<boolean>(false);
  const [customSendResult, setCustomSendResult] = useState<{ status: 'success' | 'failed' | null; message: string }>({ status: null, message: '' });

  // History logs
  const [logs, setLogs] = useState<ChatLogMessage[]>(() => {
    const raw = localStorage.getItem('sonic_gchat_logs');
    return raw ? JSON.parse(raw) : [];
  });

  // Save config values when altered
  useEffect(() => {
    localStorage.setItem('sonic_gchat_webhook', webhookUrl);
  }, [webhookUrl]);

  useEffect(() => {
    localStorage.setItem('sonic_gchat_token', accessToken);
  }, [accessToken]);

  useEffect(() => {
    localStorage.setItem('sonic_gchat_space', targetSpaceId);
  }, [targetSpaceId]);

  useEffect(() => {
    localStorage.setItem('sonic_gchat_autonotify', String(autoNotify));
  }, [autoNotify]);

  useEffect(() => {
    localStorage.setItem('sonic_gchat_details', String(includeDetails));
  }, [includeDetails]);

  useEffect(() => {
    localStorage.setItem('sonic_gchat_logs', JSON.stringify(logs));
  }, [logs]);

  // Handle validating standard connection status visually
  useEffect(() => {
    if (connectionMethod === 'webhook') {
      setIsConnected(webhookUrl.trim().startsWith('https://chat.googleapis.com/v1/spaces/'));
    } else {
      setIsConnected(accessToken.trim().length > 15 && targetSpaceId.trim().length > 4);
    }
  }, [connectionMethod, webhookUrl, accessToken, targetSpaceId]);

  // Utility to push audit reports dynamically
  const addLog = (trackName: string, destination: string, status: 'success' | 'failed', messageType: 'webhook' | 'oauth', payloadSummary: string, error?: string) => {
    const newLog: ChatLogMessage = {
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toLocaleTimeString(),
      trackName,
      destination,
      status,
      messageType,
      payloadSummary,
      errorDetails: error
    };
    setLogs(prev => [newLog, ...prev.slice(0, 19)]); // Cap at 20 logs for local storage efficiency
  };

  const clearLogs = () => {
    setLogs([]);
    localStorage.removeItem('sonic_gchat_logs');
  };

  // Helper: Generates beautiful Google Chat Card V2 compatible structures
  const buildCardV2Payload = (file: AudioFileData, commentText?: string) => {
    const trackTitle = file.metadata.title.trim() || file.name.replace(/\.[^/.]+$/, "");
    const artistName = file.metadata.artist.trim() || 'RAAJEEB PRODUCTION';
    const albumName = file.metadata.album.trim() || 'MOLDAVITE CORE LP';
    const year = file.metadata.year.trim() || new Date().getFullYear().toString();
    const genre = file.metadata.genre.trim() || 'Electronic';
    
    const formattedDuration = `${Math.floor(file.duration / 60)}:${String(Math.floor(file.duration % 60)).padStart(2, '0')}`;
    const peakLoudness = file.peakDb !== undefined ? `${file.peakDb.toFixed(1)} dBFS` : 'N/A';
    const sampleRateStr = `${(file.sampleRate / 1000).toFixed(1)} kHz`;
    const spaceConfig = `${file.channels === 2 ? 'Stereo' : 'Mono'} WAV source`;

    // High performance visual elements formatted inside card sections
    const widgets: any[] = [
      {
        "decoratedText": {
          "startIcon": { "knownIcon": "MUSIC_NOTE" },
          "text": `<b>Track:</b> ${trackTitle}`
        }
      },
      {
        "decoratedText": {
          "startIcon": { "knownIcon": "PERSON" },
          "text": `<b>Artist:</b> ${artistName}`
        }
      },
      {
        "decoratedText": {
          "startIcon": { "knownIcon": "FOLDER" },
          "text": `<b>Album Template:</b> ${albumName} (${year})`
        }
      }
    ];

    if (includeDetails) {
      widgets.push(
        {
          "decoratedText": {
            "startIcon": { "knownIcon": "CLOCK" },
            "text": `<b>Length:</b> ${formattedDuration} • ${spaceConfig}`
          }
        },
        {
          "decoratedText": {
            "startIcon": { "knownIcon": "STAR" },
            "text": `<b>Master Quality:</b> 320 kbps MP3 • ${sampleRateStr}`
          }
        },
        {
          "decoratedText": {
            "startIcon": { "knownIcon": "DESCRIPTION" },
            "text": `<b>Peak Signal Level:</b> <font color="#8FCE5E"><b>${peakLoudness}</b></font> • Normalize auto-applied`
          }
        }
      );
    }

    if (commentText && commentText.trim() !== '') {
      widgets.unshift({
        "decoratedText": {
          "startIcon": { "knownIcon": "MEMBERSHIP" },
          "text": `<b>Producer Note:</b> <i>"${commentText}"</i>`
        }
      });
    }

    return {
      "cardsV2": [
        {
          "cardId": "sonicstrideMasterReport",
          "card": {
            "header": {
              "title": "Mastering Completed",
              "subtitle": "SONICSTRIDE PRO • Audio Mastering Output",
              "imageUrl": "https://img.icons8.com/color/48/waveform.png",
              "imageType": "CIRCLE"
            },
            "sections": [
              {
                "header": "HI-FI MASTER SUMMARY REPORT",
                "collapsible": false,
                "widgets": widgets
              }
            ]
          }
        }
      ]
    };
  };

  // Dispatch payloads directly via HTTP requests (handles both Webhook post and Auth endpoint API calls)
  const dispatchMessageToGoogleChat = async (file: AudioFileData | null, isTest: boolean = false, optionalComment?: string): Promise<boolean> => {
    const destinationName = connectionMethod === 'webhook' 
      ? `Webhook (Room ...${webhookUrl.slice(-12)})`
      : `Space ID: ${targetSpaceId}`;

    const labelName = isTest ? "Test Beacon Connection" : (file ? file.name : "Custom Message");

    try {
      let url = '';
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      let bodyPayload: any = {};

      if (isTest) {
        bodyPayload = {
          "text": `⚡ *SonicStride Pro System Signal* \nConnection handshake succeeded! This channel is ready to receive mastering reports generated for *${optionalComment || 'RAAJEEB PRODUCTION'}.*`
        };
      } else if (file) {
        bodyPayload = buildCardV2Payload(file, optionalComment);
      } else {
        bodyPayload = {
          "text": `💬 *Producer Note from SonicStride*:\n"${optionalComment || ''}"`
        };
      }

      if (connectionMethod === 'webhook') {
        if (!webhookUrl.trim()) throw new Error('Webhook URL field is completely blank');
        url = webhookUrl;
      } else {
        if (!accessToken.trim()) throw new Error('Access Token field is missing');
        if (!targetSpaceId.trim()) throw new Error('Target Space ID is missing');
        
        // Google Chat API v1 Messages insert endpoint
        url = `https://chat.googleapis.com/v1/spaces/${targetSpaceId}/messages`;
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(bodyPayload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Google Chat API rejected report with status ${response.status}: ${errorText || 'Unknown error'}`);
      }

      addLog(
        labelName,
        destinationName,
        'success',
        connectionMethod,
        isTest ? 'Handshake' : 'Master Report Card'
      );
      return true;
    } catch (err: any) {
      console.error("Google Chat dispatch failed:", err);
      addLog(
        labelName,
        destinationName,
        'failed',
        connectionMethod,
        isTest ? 'Handshake' : 'Master Report Card',
        err.message || String(err)
      );
      throw err;
    }
  };

  // Execute Test Connection Handshake
  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult({ status: null, message: '' });

    try {
      await dispatchMessageToGoogleChat(null, true, activeFile?.metadata.artist || 'RAAJEEB PRODUCTION');
      setTestResult({ status: 'success', message: 'Test card delivered! Verify your space in Google Chat.' });
    } catch (err: any) {
      setTestResult({ status: 'failed', message: err.message || 'Verification failed. Review endpoints/access token.' });
    } finally {
      setIsTesting(false);
    }
  };

  // Send Custom Report
  const handleSendCustomReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFile) return;

    setIsSendingCustom(true);
    setCustomSendResult({ status: null, message: '' });

    try {
      await dispatchMessageToGoogleChat(activeFile, false, customComment);
      setCustomSendResult({ status: 'success', message: 'Master card dispatched successfully!' });
      setCustomComment('');
      setTimeout(() => setCustomSendResult({ status: null, message: '' }), 5000);
    } catch (err: any) {
      setCustomSendResult({ status: 'failed', message: err.message || 'Failed to dispatch report.' });
    } finally {
      setIsSendingCustom(false);
    }
  };

  return (
    <div className="bg-[#0A0512] border border-white/5 rounded-xl flex flex-col overflow-hidden h-full">
      {/* Title Header */}
      <div className="h-11 border-b border-white/5 bg-[#12071d] flex items-center px-4 justify-between shrink-0 select-none">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-[#8FCE5E] shadow-[0_0_8px_#8FCE5E]" />
          <span className="text-[10px] uppercase font-bold tracking-widest text-[#8FCE5E]">Google Chat Workspace</span>
        </div>
        {onClose && (
          <button 
            type="button" 
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5 min-h-0">
        {/* Connection status card */}
        <div className="bg-slate-950/40 border border-white/5 p-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {isConnected ? (
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#8FCE5E]/10 border border-[#8FCE5E]/20 text-[#8FCE5E]">
                <Wifi className="w-4 h-4" />
              </div>
            ) : (
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-900 border border-white/5 text-slate-500">
                <WifiOff className="w-4 h-4" />
              </div>
            )}
            <div>
              <div className="text-[11px] font-bold text-white uppercase tracking-tight">
                {isConnected ? "Linked to Workspace Channel" : "Workspace offline"}
              </div>
              <div className="text-[9px] text-slate-500 font-mono tracking-wide">
                {isConnected 
                  ? `MODE: ${connectionMethod === 'webhook' ? 'HOOK' : 'BEARER AUTH'} • STANDBY` 
                  : "CONFIGURE AN INCOMING WEBHOOK OR BEARER TOKEN"}
              </div>
            </div>
          </div>
          <span className={`text-[8.5px] px-1.5 py-0.5 rounded font-mono uppercase font-semibold ${
            isConnected ? 'bg-emerald-950 border border-emerald-900 text-[#8FCE5E]' : 'bg-red-950/50 border border-red-900/30 text-red-400'
          }`}>
            {isConnected ? "Ok" : "Pending"}
          </span>
        </div>

        {/* Configurations Toggle */}
        <div className="flex flex-col gap-1.5 font-sans">
          <label className="text-[9px] uppercase font-bold tracking-wider text-slate-500 font-mono">
            Connection Method
          </label>
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 border border-white/5 rounded-lg select-none">
            <button
               type="button"
               onClick={() => setConnectionMethod('webhook')}
               className={`py-1.5 rounded font-mono text-[9px] uppercase tracking-wider transition-all cursor-pointer ${
                 connectionMethod === 'webhook' 
                   ? 'bg-[#f59e0b]/10 text-[#f59e0b] font-bold border border-[#f59e0b]/20' 
                   : 'text-slate-500 hover:text-slate-300'
               }`}
             >
               Incoming Webhook
             </button>
             <button
               type="button"
               onClick={() => setConnectionMethod('token')}
               className={`py-1.5 rounded font-mono text-[9px] uppercase tracking-wider transition-all cursor-pointer ${
                 connectionMethod === 'token' 
                   ? 'bg-[#f59e0b]/10 text-[#f59e0b] font-bold border border-[#f59e0b]/20' 
                   : 'text-slate-500 hover:text-slate-300'
               }`}
             >
               Bearer Access Token
             </button>
          </div>
        </div>

        {/* Fields */}
        {connectionMethod === 'webhook' ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <label className="text-[9px] uppercase font-bold tracking-wider text-slate-500 font-mono">
                Incoming Webhook URL
              </label>
              <a 
                href="https://developers.google.com/workspace/chat/quickstart/webhooks" 
                target="_blank" 
                rel="noreferrer" 
                className="text-[8.5px] text-[#f59e0b] hover:underline flex items-center gap-0.5"
              >
                Docs <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://chat.googleapis.com/v1/spaces/AAAA.../webhooks/..."
              className="w-full bg-[#050109] border border-white/5 hover:border-white/10 focus:border-[#f59e0b]/50 focus:bg-black rounded p-2 text-xs font-mono text-white outline-none transition-all placeholder-slate-700"
            />
            <p className="text-[8.5px] text-slate-400 font-sans leading-relaxed">
              Create webhooks within your space's settings menu (<b>Apps & Integrations → Webhooks</b>) in Google Chat then paste the webhook token structure here.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] uppercase font-bold tracking-wider text-slate-500 font-mono">
                OAuth 2.0 Access Token
              </label>
              <input
                type="password"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="ya29.a0AcVp..."
                className="w-full bg-[#050109] border border-white/5 hover:border-white/10 focus:border-[#f59e0b]/50 focus:bg-black rounded p-2 text-xs font-mono text-white outline-none transition-all placeholder-slate-700"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] uppercase font-bold tracking-wider text-slate-500 font-mono">
                Google Chat Space ID
              </label>
              <input
                type="text"
                value={targetSpaceId}
                onChange={(e) => setTargetSpaceId(e.target.value)}
                placeholder="spaces/AAAAAAAAAAA"
                className="w-full bg-slate-950 border border-white/5 hover:border-white/10 focus:border-[#8FCE5E]/50 focus:bg-black rounded p-2 text-xs font-mono text-white outline-none transition-all placeholder-slate-700"
              />
              <p className="text-[8.5px] text-slate-500 font-sans leading-relaxed">
                Obtain the Space ID from Google Chat URLs or API space list structures. Be sure that the authenticated credential permissions cover the targeted space.
              </p>
            </div>
          </div>
        )}

        {/* Handshake actions */}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={!isConnected || isTesting}
            className="w-full py-2 bg-white/5 hover:bg-white/10 active:bg-white/15 text-slate-200 hover:text-white border border-white/10 hover:border-white/20 transition-all font-mono uppercase tracking-widest text-[9px] flex items-center justify-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed rounded"
          >
            {isTesting ? "Handshaking..." : "⚡ dispatch beacon test"}
          </button>
          
          {testResult.status && (
            <div className={`p-2.5 rounded text-[10px] flex items-start gap-1.5 border leading-normal ${
              testResult.status === 'success' 
                ? 'bg-emerald-950/20 border-emerald-900/30 text-emerald-400' 
                : 'bg-red-950/20 border-red-900/30 text-red-400'
            }`}>
              {testResult.status === 'success' ? <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
              <span>{testResult.message}</span>
            </div>
          )}
        </div>

        {/* Pref toggles */}
        <div className="border-t border-b border-white/5 py-4 flex flex-col gap-3">
          <div className="flex items-center justify-between select-none">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-300 font-bold uppercase tracking-tight">Auto-Notify on Master</span>
              <span className="text-[8.5px] text-slate-500 font-sans">Trigger webhook report instantly when compiled</span>
            </div>
            <button
              type="button"
              onClick={() => setAutoNotify(!autoNotify)}
              className={`w-9 h-5 rounded-full relative transition-colors duration-200 cursor-pointer ${
                autoNotify ? 'bg-[#8FCE5E] shadow-[0_0_8px_rgba(143,206,94,0.3)]' : 'bg-slate-800'
              }`}
            >
              <div
                className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-200 ${
                  autoNotify ? 'right-1' : 'left-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between select-none">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-300 font-bold uppercase tracking-tight">Include Export Parameters</span>
              <span className="text-[8.5px] text-slate-500 font-sans">Publish sample rate, boost levels, duration, and dBFS limits</span>
            </div>
            <button
              type="button"
              onClick={() => setIncludeDetails(!includeDetails)}
              className={`w-9 h-5 rounded-full relative transition-colors duration-200 cursor-pointer ${
                includeDetails ? 'bg-[#8FCE5E] shadow-[0_0_8px_rgba(143,206,94,0.3)]' : 'bg-slate-800'
              }`}
            >
              <div
                className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-200 ${
                  includeDetails ? 'right-1' : 'left-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Dispatch Manual Card Form */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[9px] uppercase font-bold tracking-wider text-slate-500 font-mono">Dispatch Workspace Report</span>
            <span className="text-[8.5px] text-fuchsia-400 font-mono">Interactive Cards</span>
          </div>

          {activeFile ? (
            <form onSubmit={handleSendCustomReport} className="flex flex-col gap-2 bg-slate-950 p-3 rounded-lg border border-white/5">
              <div className="flex items-center gap-2 pb-2 border-b border-white/5 select-none text-[10px]">
                <Music className="w-3.5 h-3.5 text-[#8FCE5E]" />
                <span className="text-white truncate font-bold uppercase tracking-tight">Target: {activeFile.metadata.title || activeFile.name.replace(/\.[^/.]+$/, "")}</span>
              </div>
              
              <div className="flex flex-col mt-1 gap-1">
                <span className="text-[8px] uppercase tracking-wide text-slate-600 font-mono">Optional comments, producer memo or reviews</span>
                <textarea
                  value={customComment}
                  onChange={(e) => setCustomComment(e.target.value)}
                  placeholder="e.g. Mastered track sounds great! Highs are very punchy."
                  rows={2}
                  className="w-full bg-black border border-white/5 focus:border-fuchsia-500/50 rounded p-2 text-xs text-slate-300 outline-none transition-all placeholder-slate-700 resize-none font-sans"
                />
              </div>

              <button
                type="submit"
                disabled={!isConnected || isSendingCustom}
                className="w-full mt-1.5 py-2.5 bg-[#8FCE5E] text-slate-950 hover:brightness-105 active:scale-[0.99] transition-all font-bold text-[9px] uppercase tracking-wider flex items-center justify-center gap-1.5 disabled:opacity-45 disabled:cursor-not-allowed rounded cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" /> {isSendingCustom ? "Dispatching Report..." : "Post Master Card to Google Chat"}
              </button>

              {customSendResult.status && (
                <div className={`p-2 rounded text-[9.5px] flex items-center gap-1 border mt-1 leading-normal ${
                  customSendResult.status === 'success' 
                    ? 'bg-emerald-950/20 border-emerald-900/10 text-emerald-400' 
                    : 'bg-red-950/20 border-red-900/10 text-red-400'
                }`}>
                  {customSendResult.status === 'success' ? <Check className="w-3 h-3 text-glow-moldavite" /> : <AlertCircle className="w-3.5 h-3.5" />}
                  <span>{customSendResult.message}</span>
                </div>
              )}
            </form>
          ) : (
            <div className="p-4 bg-slate-950/30 border border-white/5 border-dashed rounded-lg text-center text-slate-600 font-mono text-[9.5px]">
              No track currently active. Load a lossless WAV file to compose and post Master metrics.
            </div>
          )}
        </div>

        {/* Audit Dispatch Logs */}
        <div className="flex flex-col gap-2 mt-2">
          <div className="flex justify-between items-center select-none">
            <span className="text-[9px] uppercase font-bold tracking-wider text-slate-500 font-mono flex items-center gap-1">
              <History className="w-3.5 h-3.5" /> Dispatch History
            </span>
            {logs.length > 0 && (
              <button 
                type="button" 
                onClick={clearLogs}
                className="text-[8.5px] text-slate-600 hover:text-red-400 transition-colors uppercase font-bold tracking-wide"
              >
                Clear logs
              </button>
            )}
          </div>

          <div className="flex flex-col gap-2 max-h-[160px] overflow-y-auto">
            {logs.length > 0 ? (
              logs.map((log) => (
                <div 
                  key={log.id} 
                  className={`p-2 rounded border justify-between flex flex-col gap-1 items-start bg-slate-950/50 border-white/5 text-[10px] ${
                    log.status === 'failed' ? 'border-l-2 border-l-red-500' : 'border-l-2 border-l-[#8FCE5E]'
                  }`}
                >
                  <div className="flex justify-between items-center w-full text-[9px] text-slate-500 font-mono border-b border-white/5 pb-1 select-none">
                    <span>{log.timestamp} • {log.payloadSummary}</span>
                    <span className={log.status === 'success' ? 'text-[#8FCE5E] uppercase font-bold' : 'text-red-400 font-bold'}>
                      {log.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-white font-sans font-semibold mt-0.5 truncate w-full">
                    {log.trackName}
                  </div>
                  <div className="text-[8.5px] text-slate-500 font-mono truncate w-full">
                    Dest: {log.destination}
                  </div>
                  {log.errorDetails && (
                    <div className="text-[8.5px] text-red-400 font-mono bg-red-950/10 p-1 w-full rounded max-h-12 overflow-y-auto overflow-x-hidden whitespace-normal break-words leading-relaxed mt-1">
                      Err: {log.errorDetails}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="p-3 bg-slate-950/20 border border-white/5 border-dashed rounded text-center text-slate-600 font-mono text-[9px] uppercase tracking-wider select-none">
                No reports dispatched yet in this workspace.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cybernetic Footer */}
      <div className="h-8 border-t border-white/5 bg-[#08020e] flex items-center justify-between px-3 shrink-0 select-none text-[8px] font-mono text-slate-600">
        <span>ST stride client 1.28.0</span>
        <span className="text-[#8FCE5E]/60 uppercase tracking-widest flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded border border-white/5">
          <Sparkles className="w-2.5 h-2.5" /> G-Chat Sync Secured
        </span>
      </div>
    </div>
  );
}

export async function triggerAutoNotifyIfEnabled(file: AudioFileData, customComment?: string) {
  const autoNotify = localStorage.getItem('sonic_gchat_autonotify') === 'true';
  if (!autoNotify) return;

  const connectionMethod = localStorage.getItem('sonic_gchat_method') || 'webhook';
  const webhookUrl = localStorage.getItem('sonic_gchat_webhook') || '';
  const accessToken = localStorage.getItem('sonic_gchat_token') || '';
  const targetSpaceId = localStorage.getItem('sonic_gchat_space') || '';
  const includeDetails = localStorage.getItem('sonic_gchat_details') !== 'false';

  if (connectionMethod === 'webhook' && !webhookUrl) return;
  if (connectionMethod === 'token' && (!accessToken || !targetSpaceId)) return;

  try {
    const trackTitle = file.metadata.title.trim() || file.name.replace(/\.[^/.]+$/, "");
    const artistName = file.metadata.artist.trim() || 'RAAJEEB PRODUCTION';
    const albumName = file.metadata.album.trim() || 'MOLDAVITE CORE LP';
    const year = file.metadata.year.trim() || new Date().getFullYear().toString();
    const formattedDuration = `${Math.floor(file.duration / 60)}:${String(Math.floor(file.duration % 60)).padStart(2, '0')}`;
    const peakLoudness = file.peakDb !== undefined ? `${file.peakDb.toFixed(1)} dBFS` : 'N/A';
    const sampleRateStr = `${(file.sampleRate / 1000).toFixed(1)} kHz`;
    const spaceConfig = `${file.channels === 2 ? 'Stereo' : 'Mono'} WAV source`;

    const widgets: any[] = [
      { "decoratedText": { "startIcon": { "knownIcon": "MUSIC_NOTE" }, "text": `<b>Track:</b> ${trackTitle}` } },
      { "decoratedText": { "startIcon": { "knownIcon": "PERSON" }, "text": `<b>Artist:</b> ${artistName}` } },
      { "decoratedText": { "startIcon": { "knownIcon": "FOLDER" }, "text": `<b>Album Template:</b> ${albumName} (${year})` } }
    ];

    if (includeDetails) {
      widgets.push(
        { "decoratedText": { "startIcon": { "knownIcon": "CLOCK" }, "text": `<b>Length:</b> ${formattedDuration} • ${spaceConfig}` } },
        { "decoratedText": { "startIcon": { "knownIcon": "STAR" }, "text": `<b>Master Quality:</b> 320 kbps MP3 • ${sampleRateStr}` } },
        { "decoratedText": { "startIcon": { "knownIcon": "DESCRIPTION" }, "text": `<b>Peak Signal Level:</b> <font color="#8FCE5E"><b>${peakLoudness}</b></font> • Normalize auto-applied` } }
      );
    }

    if (customComment) {
      widgets.unshift({
        "decoratedText": {
          "startIcon": { "knownIcon": "MEMBERSHIP" },
          "text": `<b>Producer Note:</b> <i>"${customComment}"</i>`
        }
      });
    }

    const payload = {
      "cardsV2": [{
        "cardId": "sonicstrideMasterReport",
        "card": {
          "header": {
            "title": "Mastering Completed",
            "subtitle": "SONICSTRIDE PRO • Audio Mastering Output",
            "imageUrl": "https://img.icons8.com/color/48/waveform.png",
            "imageType": "CIRCLE"
          },
          "sections": [{
            "header": "HI-FI MASTER SUMMARY REPORT",
            "collapsible": false,
            "widgets": widgets
          }]
        }
      }]
    };

    let url = '';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    if (connectionMethod === 'webhook') {
      url = webhookUrl;
    } else {
      url = `https://chat.googleapis.com/v1/spaces/${targetSpaceId}/messages`;
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    // Capture success log in localStorage
    const logsRaw = localStorage.getItem('sonic_gchat_logs');
    const logs = logsRaw ? JSON.parse(logsRaw) : [];
    const destinationName = connectionMethod === 'webhook' 
      ? `Webhook (Room ...${url.slice(-12)})`
      : `Space ID: ${targetSpaceId}`;

    const newLog = {
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toLocaleTimeString(),
      trackName: `${trackTitle} (Auto-Notified)`,
      destination: destinationName,
      status: response.ok ? 'success' as const : 'failed' as const,
      messageType: connectionMethod as 'webhook' | 'oauth',
      payloadSummary: 'Master Report Card',
      errorDetails: response.ok ? undefined : `Rejection response code: ${response.status}`
    };
    localStorage.setItem('sonic_gchat_logs', JSON.stringify([newLog, ...logs.slice(0, 19)]));
  } catch (err: any) {
    console.error("Auto Google Chat notifications failed:", err);
    // Capture error logs in localStorage
    const logsRaw = localStorage.getItem('sonic_gchat_logs');
    const logs = logsRaw ? JSON.parse(logsRaw) : [];
    const newLog = {
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toLocaleTimeString(),
      trackName: `${file.name} (Auto-Notified)`,
      destination: connectionMethod === 'webhook' ? `Webhook` : `Space ID: ${targetSpaceId}`,
      status: 'failed' as const,
      messageType: connectionMethod as 'webhook' | 'oauth',
      payloadSummary: 'Master Report Card',
      errorDetails: err.message || String(err)
    };
    localStorage.setItem('sonic_gchat_logs', JSON.stringify([newLog, ...logs.slice(0, 19)]));
  }
}
