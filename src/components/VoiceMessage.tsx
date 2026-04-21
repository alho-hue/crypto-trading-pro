import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, Trash2, Send } from 'lucide-react';

interface VoiceMessageProps {
  onSend: (audioBlob: Blob, duration: number) => void;
  onCancel: () => void;
}

export const VoiceMessage: React.FC<VoiceMessageProps> = ({ onSend, onCancel }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string>('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to start recording:', err);
      alert('Impossible d\'accéder au microphone. Vérifiez les permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const togglePlayback = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSend = () => {
    if (audioBlob) {
      onSend(audioBlob, recordingDuration);
      cleanup();
    }
  };

  const handleCancel = () => {
    cleanup();
    onCancel();
  };

  const cleanup = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl('');
    setRecordingDuration(0);
    setIsPlaying(false);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-2 bg-[#40444b] rounded-xl px-3 py-2">
      {!audioBlob ? (
        <>
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`p-2 rounded-full transition-all ${
              isRecording 
                ? 'bg-red-500 text-white animate-pulse' 
                : 'bg-[#5865f2] text-white hover:bg-[#4752c4]'
            }`}
          >
            {isRecording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          
          {isRecording && (
            <>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-sm text-white font-mono">
                  {formatDuration(recordingDuration)}
                </span>
              </div>
              <div className="flex-1 h-8 flex items-center gap-0.5">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-1 bg-[#5865f2] rounded-full transition-all duration-150"
                    style={{
                      height: `${Math.random() * 100}%`,
                      animation: 'wave 0.5s ease-in-out infinite',
                      animationDelay: `${i * 0.05}s`
                    }}
                  />
                ))}
              </div>
            </>
          )}
          
          {isRecording && (
            <button
              onClick={stopRecording}
              className="p-1.5 text-gray-400 hover:text-white"
            >
              <Square className="w-4 h-4" />
            </button>
          )}
        </>
      ) : (
        <>
          <button
            onClick={togglePlayback}
            className="p-2 bg-[#5865f2]/20 text-[#5865f2] rounded-full hover:bg-[#5865f2]/30"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          
          <span className="text-sm text-white font-mono">
            {formatDuration(recordingDuration)}
          </span>
          
          <div className="flex-1 h-8 flex items-center">
            <div className="w-full h-1 bg-[#2f3136] rounded-full overflow-hidden">
              <div className="h-full bg-[#5865f2] rounded-full" style={{ width: '60%' }} />
            </div>
          </div>
          
          <audio
            ref={audioRef}
            src={audioUrl}
            onEnded={() => setIsPlaying(false)}
            className="hidden"
          />
          
          <button
            onClick={handleCancel}
            className="p-1.5 text-gray-400 hover:text-red-400"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          
          <button
            onClick={handleSend}
            className="p-2 bg-[#5865f2] text-white rounded-full hover:bg-[#4752c4]"
          >
            <Send className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  );
};

// Composant pour afficher un message vocal reçu
interface VoicePlayerProps {
  audioUrl: string;
  duration: number;
}

export const VoicePlayer: React.FC<VoicePlayerProps> = ({ audioUrl, duration }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlayback = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-3 bg-[#5865f2]/10 rounded-xl px-3 py-2 max-w-[250px]">
      <button
        onClick={togglePlayback}
        className="p-2 bg-[#5865f2] text-white rounded-full hover:bg-[#4752c4] transition-colors"
      >
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      </button>
      
      <div className="flex-1">
        <div className="flex items-center gap-1 h-8">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className={`w-1 rounded-full transition-all duration-300 ${
                isPlaying && i < (currentTime / duration) * 20
                  ? 'bg-[#5865f2] h-full' 
                  : 'bg-[#5865f2]/30 h-2'
              }`}
              style={{
                height: isPlaying ? `${Math.random() * 80 + 20}%` : '30%'
              }}
            />
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
      
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
        className="hidden"
      />
    </div>
  );
};

export default VoiceMessage;
