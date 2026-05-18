"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useStore, Profile } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Heart,
  MapPin,
  MessageCircle,
  Trash2,
  Send,
  ChevronDown,
  ChevronUp,
  Reply,
  ImagePlus,
  Video,
  Mic,
  X,
  Clock,
  Loader2,
  Share2,
  Globe,
  Users as UsersIcon,
  Play,
  Pause,
  Volume2,
  Repeat2,
  Copy,
  ExternalLink,
  Camera,
  Plus,
  Square,
  Music,
} from "lucide-react";
import { getInitials, getAvatarColor, timeAgo } from "@/lib/constants";
import { UserAvatar } from "./UserAvatar";
import { toast } from "sonner";
import {
  compressImage,
  validateImageFile,
  createPreviewUrl,
  revokePreviewUrl,
} from "@/lib/image-compression";

// ═══════════════════════════════════════════════════════════
// Constantes
// ═══════════════════════════════════════════════════════════
const MAX_PHOTOS_PER_POST = 5;
const MAX_ACTIVE_MEDIA_POSTS = 5;
const MAX_VIDEO_POSTS_PER_12H = 5;
const MAX_VIDEO_DURATION = 30; // seconds
const MAX_AUDIO_DURATION = 60; // seconds

const REACTION_EMOJIS = [
  { type: "like", emoji: "\u2764\uFE0F", label: "Curtir" },
  { type: "laugh", emoji: "\uD83D\uDE02", label: "Engra\u00E7ado" },
  { type: "sad", emoji: "\uD83D\uDE14", label: "Triste" },
  { type: "wow", emoji: "\uD83D\uDE32", label: "Uau" },
  { type: "angry", emoji: "\uD83D\uDE21", label: "Bravo" },
  { type: "love", emoji: "\uD83D\uDE0D", label: "Amei" },
] as const;

function buildReactionGroups(reactions: { user_id: string; type: string }[]) {
  const groups: Record<string, { emoji: string; count: number; types: string[] }> = {};
  for (const r of reactions) {
    const match = REACTION_EMOJIS.find((e) => e.type === r.type);
    const emoji = match?.emoji || "\u2764\uFE0F";
    if (!groups[r.type]) groups[r.type] = { emoji, count: 0, types: [r.type] };
    groups[r.type].count++;
  }
  return Object.values(groups);
}

function getExpirationLabel(expiresAt: string): string {
  const now = Date.now();
  const expires = new Date(expiresAt).getTime();
  const diff = expires - now;
  if (diff <= 0) return "Expirado";
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hours > 0) return `Expira em ${hours}h${mins > 0 ? ` ${mins}min` : ""}`;
  return `Expira em ${mins}min`;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ═══════════════════════════════════════════════════════════
// Interfaces
// ═══════════════════════════════════════════════════════════
interface Comment {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  parent_id?: string | null;
  author: { id: string; display_name: string; username: string; avatar_url?: string | null; neighborhood?: string | null };
  reactions: { user_id: string; type: string }[];
}

interface PostWithAuthor {
  id: string;
  content: string;
  neighborhood?: string | null;
  created_at: string;
  author_id: string;
  comment_count?: number;
  image_urls?: string[];
  video_url?: string | null;
  audio_url?: string | null;
  expires_at?: string | null;
  visibility?: "public" | "followers";
  shared_post_id?: string | null;
  shared_post?: PostWithAuthor | null;
  author: { id: string; display_name: string; username: string; avatar_url?: string | null; neighborhood?: string | null };
  reactions: { user_id: string; type: string }[];
}

// ═══════════════════════════════════════════════════════════
// VideoPlayer
// ═══════════════════════════════════════════════════════════
function VideoPlayer({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const toggle = () => {
    if (!videoRef.current) return;
    if (playing) videoRef.current.pause();
    else videoRef.current.play();
    setPlaying(!playing);
  };

  return (
    <div className="mt-2.5 relative rounded-2xl overflow-hidden bg-black shadow-md group">
      <video
        ref={videoRef}
        src={src}
        className="w-full max-h-96 object-contain"
        playsInline
        preload="metadata"
        onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
        onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
        onEnded={() => setPlaying(false)}
        onClick={toggle}
      />
      {!playing && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer" onClick={toggle}>
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-md shadow-lg transition-transform hover:scale-110">
            <Play className="h-8 w-8 text-white fill-white ml-1" />
          </div>
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <div className="flex items-center gap-2">
          <button onClick={toggle} className="text-white">
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <div className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden cursor-pointer" onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            if (videoRef.current && duration) videoRef.current.currentTime = pct * duration;
          }}>
            <div className="h-full bg-white rounded-full transition-all" style={{ width: duration ? `${(currentTime / duration) * 100}%` : "0%" }} />
          </div>
          <span className="text-[10px] text-white/80 tabular-nums">{formatDuration(currentTime)}/{formatDuration(duration)}</span>
        </div>
      </div>
      <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-sm px-2.5 py-1 text-[10px] font-medium text-white">
        <Video className="h-3 w-3" /> Vídeo
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// AudioPlayer
// ═══════════════════════════════════════════════════════════
function AudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) audioRef.current.pause();
    else audioRef.current.play();
    setPlaying(!playing);
  };

  return (
    <div className="mt-2.5 rounded-2xl border bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 p-4 shadow-sm">
      <div className="flex items-center gap-3.5">
        <button onClick={toggle} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90 transition-all hover:scale-105">
          {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Volume2 className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold">Áudio</span>
            <span className="text-[10px] text-muted-foreground tabular-nums">{formatDuration(currentTime)} / {formatDuration(duration)}</span>
          </div>
          <div className="h-2 bg-primary/20 rounded-full overflow-hidden cursor-pointer" onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            if (audioRef.current && duration) audioRef.current.currentTime = pct * duration;
          }}>
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: duration ? `${(currentTime / duration) * 100}%` : "0%" }} />
          </div>
        </div>
      </div>
      <audio ref={audioRef} src={src} preload="metadata" onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)} onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)} onEnded={() => setPlaying(false)} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// PhotoGrid
// ═══════════════════════════════════════════════════════════
function PhotoGrid({ photos, onPhotoClick }: { photos: string[]; onPhotoClick?: (index: number) => void }) {
  const count = photos.length;
  if (count === 0) return null;

  if (count === 1) {
    return (
      <button onClick={() => onPhotoClick?.(0)} className="mt-2.5 w-full overflow-hidden rounded-2xl shadow-sm">
        <img src={photos[0]} alt="Foto do post" className="w-full max-h-80 object-cover hover:opacity-95 transition-opacity" loading="lazy" />
      </button>
    );
  }
  if (count === 2) {
    return (
      <div className="mt-2.5 grid grid-cols-2 gap-1 overflow-hidden rounded-2xl shadow-sm">
        {photos.map((url, i) => (
          <button key={i} onClick={() => onPhotoClick?.(i)} className="overflow-hidden">
            <img src={url} alt={`Foto ${i + 1}`} className="w-full h-44 object-cover hover:opacity-95 transition-opacity" loading="lazy" />
          </button>
        ))}
      </div>
    );
  }
  if (count === 3) {
    return (
      <div className="mt-2.5 grid grid-cols-2 gap-1 overflow-hidden rounded-2xl shadow-sm">
        <button onClick={() => onPhotoClick?.(0)} className="row-span-2 overflow-hidden">
          <img src={photos[0]} alt="Foto 1" className="w-full h-full object-cover hover:opacity-95 transition-opacity" loading="lazy" />
        </button>
        <button onClick={() => onPhotoClick?.(1)} className="overflow-hidden">
          <img src={photos[1]} alt="Foto 2" className="w-full h-44 object-cover hover:opacity-95 transition-opacity" loading="lazy" />
        </button>
        <button onClick={() => onPhotoClick?.(2)} className="overflow-hidden">
          <img src={photos[2]} alt="Foto 3" className="w-full h-44 object-cover hover:opacity-95 transition-opacity" loading="lazy" />
        </button>
      </div>
    );
  }
  return (
    <div className="mt-2.5 grid grid-cols-2 gap-1 overflow-hidden rounded-2xl shadow-sm">
      {photos.slice(0, 4).map((url, i) => (
        <button key={i} onClick={() => onPhotoClick?.(i)} className="relative overflow-hidden">
          <img src={url} alt={`Foto ${i + 1}`} className="w-full h-44 object-cover hover:opacity-95 transition-opacity" loading="lazy" />
          {i === 3 && count > 4 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white font-bold text-lg">+{count - 4}</div>
          )}
        </button>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// PhotoViewer
// ═══════════════════════════════════════════════════════════
function PhotoViewer({ photos, initialIndex, onClose }: { photos: string[]; initialIndex: number; onClose: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"><X className="h-5 w-5" /></button>
      {photos.length > 1 && (
        <>
          <button onClick={(e) => { e.stopPropagation(); setCurrentIndex((i) => (i > 0 ? i - 1 : photos.length - 1)); }} className="absolute left-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors">&#8249;</button>
          <button onClick={(e) => { e.stopPropagation(); setCurrentIndex((i) => (i < photos.length - 1 ? i + 1 : 0)); }} className="absolute right-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors">&#8250;</button>
        </>
      )}
      <img src={photos[currentIndex]} alt={`Foto ${currentIndex + 1}`} className="max-h-[90vh] max-w-[95vw] object-contain" onClick={(e) => e.stopPropagation()} />
      {photos.length > 1 && <div className="absolute bottom-4 text-white/70 text-sm">{currentIndex + 1} / {photos.length}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ShareMenu
// ═══════════════════════════════════════════════════════════
function ShareMenu({
  post,
  onClose,
  onRepost,
  triggerRef,
}: {
  post: PostWithAuthor;
  onClose: () => void;
  onRepost: (post: PostWithAuthor) => void;
  triggerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({ top: rect.top - 4, right: window.innerWidth - rect.right });
    const onScroll = () => {
      if (!triggerRef.current) return;
      const r = triggerRef.current.getBoundingClientRect();
      setPos({ top: r.top - 4, right: window.innerWidth - r.right });
    };
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [triggerRef]);

  const handleExternalShare = async () => {
    const shareData = {
      title: `Post de ${post.author.display_name}`,
      text: post.content.slice(0, 100) + (post.content.length > 100 ? "..." : ""),
      url: window.location.href,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.text}\n\n--- GDF Chat`);
        toast.success("Texto copiado!");
      }
    } catch { /* cancelled */ }
    onClose();
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(post.content.slice(0, 200));
      toast.success("Texto copiado!");
    } catch { toast.error("Erro ao copiar"); }
    onClose();
  };

  if (!pos) return null;

  // Check if menu would go above viewport; flip below if needed
  const menuHeight = 140;
  const flipBelow = pos.top - menuHeight < 8;

  return (
    <div
      className="fixed w-52 rounded-xl border bg-card p-1.5 shadow-xl z-[999] animate-in fade-in-0 zoom-in-95"
      style={{ right: pos.right, ...(flipBelow ? { top: pos.top + 36 } : { bottom: window.innerHeight - pos.top }) }}
    >
      <button
        onClick={() => { onRepost(post); onClose(); }}
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-accent"
      >
        <Repeat2 className="h-4 w-4 text-primary" />
        <span>Compartilhar no feed</span>
      </button>
      <button
        onClick={handleExternalShare}
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-accent"
      >
        <ExternalLink className="h-4 w-4 text-muted-foreground" />
        <span>Compartilhar fora</span>
      </button>
      <button
        onClick={handleCopyLink}
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-accent"
      >
        <Copy className="h-4 w-4 text-muted-foreground" />
        <span>Copiar texto</span>
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// FeedView
// ═══════════════════════════════════════════════════════════
export function FeedView({ openUserProfile }: { openUserProfile?: (userId: string) => void }) {
  const { profile } = useStore();
  const navigateToProfile = (uid: string) => {
    if (openUserProfile) openUserProfile(uid);
    else window.dispatchEvent(new CustomEvent("openUserProfile", { detail: { userId: uid } }));
  };

  const [posts, setPosts] = useState<PostWithAuthor[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [activeMediaCount, setActiveMediaCount] = useState(0);
  const [videoPostsInWindow, setVideoPostsInWindow] = useState(0);

  // Input refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const cameraPhotoRef = useRef<HTMLInputElement>(null);
  const cameraVideoRef = useRef<HTMLInputElement>(null);

  // Composer state
  const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
  const [selectedAudio, setSelectedAudio] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [audioPreview, setAudioPreview] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [visibility, setVisibility] = useState<"public" | "followers">("public");

  // Menu state
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Audio recording state (direct in-app recording)
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Viewer state
  const [viewerPhotos, setViewerPhotos] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);

  // Share state
  const [shareMenuOpen, setShareMenuOpen] = useState<string | null>(null);

  // Repost state
  const [repostingPost, setRepostingPost] = useState<PostWithAuthor | null>(null);
  const [repostContent, setRepostContent] = useState("");

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  useEffect(() => {
    const nb = profile?.neighborhood || "all";
    fetch(`/api/posts?neighborhood=${nb}&limit=30`)
      .then((r) => r.json())
      .then((data) => setPosts(data.posts || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [profile?.neighborhood]);

  useEffect(() => {
    if (!profile) return;
    fetchMediaCounts();
  }, [profile]);

  const fetchMediaCounts = async () => {
    if (!profile) return;
    try {
      const now = new Date().toISOString();
      const res = await fetch(`/api/posts?authorId=${profile.id}&limit=50`);
      const data = await res.json();
      const active = (data.posts || []).filter(
        (p: PostWithAuthor) => p.expires_at && p.expires_at > now
      );
      setActiveMediaCount(active.length);

      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
      const recentVideos = (data.posts || []).filter(
        (p: PostWithAuthor) => p.video_url && p.created_at > twelveHoursAgo
      );
      setVideoPostsInWindow(recentVideos.length);
    } catch { /* silent */ }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remaining = MAX_PHOTOS_PER_POST - selectedFiles.length;
    const toAdd = files.slice(0, remaining);
    for (const file of toAdd) {
      const error = validateImageFile(file);
      if (error) { toast.error(error); continue; }
      setSelectedFiles((prev) => [...prev, file]);
      setPreviewUrls((prev) => [...prev, createPreviewUrl(file)]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
    setMenuOpen(false);
  };

  const handleCameraPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const error = validateImageFile(file);
    if (error) { toast.error(error); return; }
    setSelectedFiles((prev) => [...prev, file]);
    setPreviewUrls((prev) => [...prev, createPreviewUrl(file)]);
    if (cameraPhotoRef.current) cameraPhotoRef.current.value = "";
    setMenuOpen(false);
  };

  const handleCameraVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Process same as video file select
    if (file.size > 50 * 1024 * 1024) {
      toast.error("Vídeo muito grande (máx 50MB)");
      return;
    }
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      if (video.duration > MAX_VIDEO_DURATION) {
        toast.error(`Vídeo muito longo (máx ${MAX_VIDEO_DURATION}s)`);
        URL.revokeObjectURL(video.src);
        return;
      }
      setVideoDuration(video.duration);
      setSelectedVideo(file);
      setVideoPreview(URL.createObjectURL(file));
      URL.revokeObjectURL(video.src);
    };
    video.src = URL.createObjectURL(file);
    if (cameraVideoRef.current) cameraVideoRef.current.value = "";
    setMenuOpen(false);
  };

  const removeSelectedFile = (index: number) => {
    revokePreviewUrl(previewUrls[index]);
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["video/mp4", "video/webm", "video/quicktime"].includes(file.type)) {
      toast.error("Tipo não suportado. Use MP4, WebM ou MOV.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error("Vídeo muito grande (máx 50MB)");
      return;
    }
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      if (video.duration > MAX_VIDEO_DURATION) {
        toast.error(`Vídeo muito longo (máx ${MAX_VIDEO_DURATION}s)`);
        URL.revokeObjectURL(video.src);
        return;
      }
      setVideoDuration(video.duration);
      setSelectedVideo(file);
      setVideoPreview(URL.createObjectURL(file));
      URL.revokeObjectURL(video.src);
    };
    video.src = URL.createObjectURL(file);
    if (videoInputRef.current) videoInputRef.current.value = "";
    setMenuOpen(false);
  };

  const handleAudioSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["audio/mpeg", "audio/mp4", "audio/webm", "audio/ogg", "audio/wav", "audio/x-m4a"].includes(file.type)) {
      toast.error("Tipo não suportado. Use MP3, M4A, WebM, OGG ou WAV.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Áudio muito grande (máx 10MB)");
      return;
    }
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      if (audio.duration > MAX_AUDIO_DURATION) {
        toast.error(`Áudio muito longo (máx ${MAX_AUDIO_DURATION}s)`);
        URL.revokeObjectURL(audio.src);
        return;
      }
      setAudioDuration(audio.duration);
      setSelectedAudio(file);
      setAudioPreview(URL.createObjectURL(file));
      URL.revokeObjectURL(audio.src);
    };
    audio.src = URL.createObjectURL(file);
    if (audioInputRef.current) audioInputRef.current.value = "";
    setMenuOpen(false);
  };

  // ═══════ Direct audio recording ═══════
  const startAudioRecording = async () => {
    setMenuOpen(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // Choose best supported mimeType
      let mimeType = "audio/webm";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "audio/webm;codecs=opus";
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "audio/mp4";
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        const ext = mimeType.includes("mp4") ? "m4a" : "webm";
        const file = new File([blob], `gravação.${ext}`, { type: mimeType });
        const url = URL.createObjectURL(file);

        // Get duration
        const tempAudio = document.createElement("audio");
        tempAudio.preload = "metadata";
        tempAudio.onloadedmetadata = () => {
          const dur = tempAudio.duration;
          setAudioDuration(dur);
          setSelectedAudio(file);
          setAudioPreview(url);
          URL.revokeObjectURL(tempAudio.src);
        };
        tempAudio.src = url;

        // Stop all tracks
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((t) => t.stop());
          mediaStreamRef.current = null;
        }
        mediaRecorderRef.current = null;
        setIsRecordingAudio(false);
      };

      mediaRecorder.start(1000);
      setIsRecordingAudio(true);
      setRecordingSeconds(0);

      // Timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev + 1 >= MAX_AUDIO_DURATION) {
            stopAudioRecording();
            return MAX_AUDIO_DURATION;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      toast.error("Não foi possível acessar o microfone. Verifique as permissões.");
    }
  };

  const stopAudioRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  const cancelAudioRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    setIsRecordingAudio(false);
    setRecordingSeconds(0);
  };

  const clearMedia = () => {
    setSelectedFiles([]);
    previewUrls.forEach(revokePreviewUrl);
    setPreviewUrls([]);
    setSelectedVideo(null);
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    setVideoPreview(null);
    setVideoDuration(0);
    setSelectedAudio(null);
    if (audioPreview) URL.revokeObjectURL(audioPreview);
    setAudioPreview(null);
    setAudioDuration(0);
    cancelAudioRecording();
  };

  const uploadPhotos = async (): Promise<string[]> => {
    const urls: string[] = [];
    for (const file of selectedFiles) {
      try {
        const compressed = await compressImage(file, { maxWidth: 800, maxHeight: 800, quality: 0.55, maxSizeKB: 150 });
        const formData = new FormData();
        formData.append("file", compressed, "photo.webp");
        formData.append("folder", "posts");
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (data.url) urls.push(data.url);
        else toast.error(data.error || "Erro ao enviar foto");
      } catch { toast.error("Erro ao processar foto"); }
    }
    return urls;
  };

  const uploadVideo = async (file: File): Promise<string | null> => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "posts");
      const res = await fetch("/api/upload/video", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) return data.url;
      toast.error(data.error || "Erro ao enviar vídeo");
      return null;
    } catch { toast.error("Erro ao enviar vídeo"); return null; }
  };

  const uploadAudio = async (file: File): Promise<string | null> => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "posts");
      const res = await fetch("/api/upload/audio", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) return data.url;
      toast.error(data.error || "Erro ao enviar áudio");
      return null;
    } catch { toast.error("Erro ao enviar áudio"); return null; }
  };

  const handlePost = async () => {
    if (!content.trim() || !profile) return;
    const hasMedia = selectedFiles.length > 0 || selectedVideo || selectedAudio;

    if (hasMedia && activeMediaCount >= MAX_ACTIVE_MEDIA_POSTS) {
      toast.error(`Você já tem ${MAX_ACTIVE_MEDIA_POSTS} posts com mídia ativos. Aguarde a expiração.`);
      return;
    }
    if (selectedVideo && videoPostsInWindow >= MAX_VIDEO_POSTS_PER_12H) {
      toast.error(`Você já postou ${MAX_VIDEO_POSTS_PER_12H} vídeos nas últimas 12h.`);
      return;
    }

    setUploading(true);
    try {
      let imageUrls: string[] = [];
      let videoUrl: string | null = null;
      let audioUrl: string | null = null;

      if (selectedFiles.length > 0) {
        imageUrls = await uploadPhotos();
        if (imageUrls.length === 0 && selectedFiles.length > 0) {
          toast.error("Falha ao enviar fotos.");
          setUploading(false);
          return;
        }
      }
      if (selectedVideo) {
        videoUrl = await uploadVideo(selectedVideo);
        if (!videoUrl) { setUploading(false); return; }
      }
      if (selectedAudio) {
        audioUrl = await uploadAudio(selectedAudio);
        if (!audioUrl) { setUploading(false); return; }
      }

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          neighborhood: profile.neighborhood,
          imageUrls,
          videoUrl,
          audioUrl,
          audioDuration,
          videoDuration,
          visibility,
        }),
      });
      const data = await res.json();
      if (data.post) {
        setPosts((prev) => [{ ...data.post, comment_count: data.post.comment_count || 0 }, ...prev]);
        setContent("");
        clearMedia();
        fetchMediaCounts();
        toast.success("Post publicado!");
      } else if (data.error) { toast.error(data.error); }
    } catch { toast.error("Erro ao publicar"); }
    setUploading(false);
  };

  const handleRepost = async (post: PostWithAuthor) => {
    if (!profile) return;
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: repostContent.trim() || `Compartilhado de @${post.author.username}`,
          neighborhood: profile.neighborhood,
          imageUrls: [],
          videoUrl: null,
          audioUrl: null,
          visibility: "public",
          sharedPostId: post.id,
        }),
      });
      const data = await res.json();
      if (data.post) {
        setPosts((prev) => [{ ...data.post, comment_count: data.post.comment_count || 0, shared_post: post }, ...prev]);
        setRepostingPost(null);
        setRepostContent("");
        toast.success("Compartilhado no feed!");
      } else if (data.error) { toast.error(data.error); }
    } catch { toast.error("Erro ao compartilhar"); }
  };

  const handleReaction = async (postId: string, type: string) => {
    if (!profile) return;
    try {
      const res = await fetch("/api/posts/reaction", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId, type }) });
      const data = await res.json();
      if (data.reacted !== undefined) {
        setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, reactions: data.reacted ? [...p.reactions, { user_id: profile.id, type }] : p.reactions.filter((r) => !(r.user_id === profile.id && r.type === type)) } : p));
      }
    } catch { /* silent */ }
  };

  const handleDelete = async (postId: string) => {
    try {
      await fetch(`/api/posts?id=${postId}`, { method: "DELETE" });
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      toast.success("Post excluído");
      fetchMediaCounts();
    } catch { toast.error("Erro ao excluir"); }
  };

  const updateCommentCount = (postId: string, delta: number) => {
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, comment_count: Math.max(0, (p.comment_count || 0) + delta) } : p));
  };

  const openPhotoViewer = (photos: string[], index: number) => {
    setViewerPhotos(photos);
    setViewerIndex(index);
    setViewerOpen(true);
  };

  const hasPhotosInComposer = selectedFiles.length > 0;
  const hasVideoInComposer = !!selectedVideo;
  const hasAudioInComposer = !!selectedAudio;
  const canAddPhotos = !hasVideoInComposer && !hasAudioInComposer && selectedFiles.length < MAX_PHOTOS_PER_POST;
  const canAddVideo = !hasPhotosInComposer && !hasAudioInComposer && !hasVideoInComposer;
  const canAddAudio = !hasPhotosInComposer && !hasVideoInComposer && !hasAudioInComposer;

  if (loading) return <FeedSkeleton />;

  return (
    <div className="space-y-4">
      {/* ═══════ COMPOSER ═══════ */}
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <UserAvatar user={{ id: profile?.id || "", display_name: profile?.display_name || "?", avatar_url: profile?.avatar_url }} className="h-10 w-10 shrink-0" />
          <div className="flex-1 space-y-2">
            <textarea
              placeholder="O que está acontecendo no seu bairro?"
              value={content}
              onChange={(e) => setContent(e.target.value.slice(0, 500))}
              className="w-full min-h-[72px] resize-none rounded-xl border-0 bg-muted/50 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60"
              rows={2}
            />

            {/* Photo previews */}
            {hasPhotosInComposer && previewUrls.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {previewUrls.map((url, i) => (
                  <div key={i} className="relative group">
                    <img src={url} alt={`Preview ${i + 1}`} className="h-20 w-20 rounded-xl object-cover border shadow-sm" />
                    <button onClick={() => removeSelectedFile(i)} className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Video preview */}
            {hasVideoInComposer && videoPreview && (
              <div className="relative">
                <video src={videoPreview} className="w-full max-h-48 rounded-xl object-cover" playsInline muted />
                <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-black/60 backdrop-blur-sm px-2 py-0.5 text-[10px] text-white">
                  <Video className="h-3 w-3" /> {formatDuration(videoDuration)}
                </div>
                <button onClick={() => { setSelectedVideo(null); if (videoPreview) URL.revokeObjectURL(videoPreview); setVideoPreview(null); setVideoDuration(0); }} className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            {/* Audio preview */}
            {hasAudioInComposer && audioPreview && (
              <div className="relative rounded-xl border bg-primary/5 p-3">
                <div className="flex items-center gap-2">
                  <Mic className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium">Áudio</span>
                  <span className="text-[10px] text-muted-foreground">{formatDuration(audioDuration)}</span>
                </div>
                <audio src={audioPreview} controls className="mt-2 w-full h-8" />
                <button onClick={() => { setSelectedAudio(null); if (audioPreview) URL.revokeObjectURL(audioPreview); setAudioPreview(null); setAudioDuration(0); }} className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            )}

            {/* Audio recording indicator */}
            {isRecordingAudio && (
              <div className="relative rounded-xl border border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500 text-white animate-pulse">
                    <Mic className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-red-600 dark:text-red-400">Gravando áudio...</span>
                      <span className="text-sm font-bold tabular-nums text-red-600 dark:text-red-400">{formatDuration(recordingSeconds)}</span>
                      <span className="text-[10px] text-muted-foreground">/ {formatDuration(MAX_AUDIO_DURATION)}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 bg-red-200 dark:bg-red-900 rounded-full overflow-hidden">
                      <div className="h-full bg-red-500 rounded-full transition-all" style={{ width: `${(recordingSeconds / MAX_AUDIO_DURATION) * 100}%` }} />
                    </div>
                  </div>
                  <button onClick={stopAudioRecording} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500 text-white shadow-md hover:bg-red-600 transition-colors" title="Parar gravação">
                    <Square className="h-4 w-4" />
                  </button>
                  <button onClick={cancelAudioRecording} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors" title="Cancelar">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ═══════ ACTION BAR ═══════ */}
            <div className="flex items-center justify-between pt-1">
              {/* Menu button */}
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${menuOpen ? "bg-primary/10 text-primary" : "text-primary hover:bg-primary/10"}`}
                >
                  <Plus className="h-4 w-4" />
                  <span>Menu</span>
                  <ChevronDown className={`h-3 w-3 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
                </button>

                {/* Dropdown menu - opens DOWNWARD */}
                {menuOpen && (
                  <div className="absolute left-0 top-full mt-1 w-56 rounded-xl border bg-card p-1.5 shadow-xl z-50 animate-in fade-in-0 zoom-in-95">
                    {/* Camera photo */}
                    <button
                      onClick={() => { if (canAddPhotos) cameraPhotoRef.current?.click(); }}
                      disabled={!canAddPhotos}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors ${canAddPhotos ? "hover:bg-accent" : "text-muted-foreground/40 cursor-not-allowed"}`}
                    >
                      <Camera className={`h-4 w-4 ${canAddPhotos ? "text-primary" : ""}`} />
                      <span>Tirar foto</span>
                    </button>

                    {/* Gallery photos */}
                    <button
                      onClick={() => { if (canAddPhotos) fileInputRef.current?.click(); }}
                      disabled={!canAddPhotos}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors ${canAddPhotos ? "hover:bg-accent" : "text-muted-foreground/40 cursor-not-allowed"}`}
                    >
                      <ImagePlus className={`h-4 w-4 ${canAddPhotos ? "text-primary" : ""}`} />
                      <span>Escolher fotos</span>
                    </button>

                    <div className="my-1 h-px bg-border" />

                    {/* Camera video */}
                    <button
                      onClick={() => { if (canAddVideo && videoPostsInWindow < MAX_VIDEO_POSTS_PER_12H) cameraVideoRef.current?.click(); }}
                      disabled={!canAddVideo || videoPostsInWindow >= MAX_VIDEO_POSTS_PER_12H}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors ${canAddVideo && videoPostsInWindow < MAX_VIDEO_POSTS_PER_12H ? "hover:bg-accent" : "text-muted-foreground/40 cursor-not-allowed"}`}
                    >
                      <Video className={`h-4 w-4 ${canAddVideo && videoPostsInWindow < MAX_VIDEO_POSTS_PER_12H ? "text-primary" : ""}`} />
                      <span>Gravar vídeo</span>
                    </button>

                    {/* Video from file */}
                    <button
                      onClick={() => { if (canAddVideo && videoPostsInWindow < MAX_VIDEO_POSTS_PER_12H) videoInputRef.current?.click(); }}
                      disabled={!canAddVideo || videoPostsInWindow >= MAX_VIDEO_POSTS_PER_12H}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors ${canAddVideo && videoPostsInWindow < MAX_VIDEO_POSTS_PER_12H ? "hover:bg-accent" : "text-muted-foreground/40 cursor-not-allowed"}`}
                    >
                      <Video className={`h-4 w-4 ${canAddVideo && videoPostsInWindow < MAX_VIDEO_POSTS_PER_12H ? "text-muted-foreground" : ""}`} />
                      <span>Escolher vídeo</span>
                    </button>

                    <div className="my-1 h-px bg-border" />

                    {/* Record audio (direct) */}
                    <button
                      onClick={() => { if (canAddAudio && !isRecordingAudio) startAudioRecording(); }}
                      disabled={!canAddAudio || isRecordingAudio}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors ${canAddAudio && !isRecordingAudio ? "hover:bg-accent" : "text-muted-foreground/40 cursor-not-allowed"}`}
                    >
                      <Mic className={`h-4 w-4 ${canAddAudio && !isRecordingAudio ? "text-primary" : ""}`} />
                      <span>Gravar áudio</span>
                    </button>

                    {/* Audio from file */}
                    <button
                      onClick={() => { if (canAddAudio) audioInputRef.current?.click(); }}
                      disabled={!canAddAudio}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors ${canAddAudio ? "hover:bg-accent" : "text-muted-foreground/40 cursor-not-allowed"}`}
                    >
                      <Music className={`h-4 w-4 ${canAddAudio ? "text-muted-foreground" : ""}`} />
                      <span>Escolher áudio</span>
                    </button>

                    <div className="my-1 h-px bg-border" />

                    {/* Visibility toggle */}
                    <button
                      onClick={() => setVisibility((v) => v === "public" ? "followers" : "public")}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-accent"
                    >
                      {visibility === "public" ? (
                        <Globe className="h-4 w-4 text-primary" />
                      ) : (
                        <UsersIcon className="h-4 w-4 text-amber-500" />
                      )}
                      <span>{visibility === "public" ? "Público" : "Seguidores"}</span>
                    </button>
                  </div>
                )}

                {/* Hidden inputs */}
                <input ref={cameraPhotoRef} type="file" accept="image/*" capture="environment" onChange={handleCameraPhotoSelect} className="hidden" />
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={handleFileSelect} className="hidden" />
                <input ref={cameraVideoRef} type="file" accept="video/*" capture="environment" onChange={handleCameraVideoSelect} className="hidden" />
                <input ref={videoInputRef} type="file" accept="video/mp4,video/webm,video/quicktime" onChange={handleVideoSelect} className="hidden" />
                <input ref={audioInputRef} type="file" accept="audio/mpeg,audio/mp4,audio/webm,audio/ogg,audio/wav,audio/x-m4a" onChange={handleAudioSelect} className="hidden" />
              </div>

              {/* Publish button */}
              <div className="flex items-center gap-2">
                <span className={`text-[10px] ${content.length > 450 ? "text-destructive" : "text-muted-foreground"}`}>
                  {content.length}/500
                </span>
                <Button size="sm" disabled={!content.trim() || uploading} onClick={handlePost} className="rounded-full px-5 shadow-sm">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publicar"}
                </Button>
              </div>
            </div>

            {activeMediaCount >= MAX_ACTIVE_MEDIA_POSTS && (
              <div className="flex items-center gap-1 text-[10px] text-amber-500 mt-1">
                <Clock className="h-3 w-3" /> {activeMediaCount}/{MAX_ACTIVE_MEDIA_POSTS} posts com mídia ativos
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Repost dialog */}
      {repostingPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => { setRepostingPost(null); setRepostContent(""); }}>
          <div className="w-full max-w-md mx-4 rounded-2xl border bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold mb-3">Compartilhar no feed</h3>
            <div className="rounded-xl border bg-muted/30 p-3 mb-3">
              <div className="flex items-center gap-2 mb-1">
                <UserAvatar user={repostingPost.author} className="h-6 w-6" />
                <span className="text-xs font-semibold">{repostingPost.author.display_name}</span>
                <span className="text-[10px] text-muted-foreground">@{repostingPost.author.username}</span>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-3">{repostingPost.content}</p>
            </div>
            <textarea
              placeholder="Adicione um comentário (opcional)..."
              value={repostContent}
              onChange={(e) => setRepostContent(e.target.value.slice(0, 200))}
              className="w-full min-h-[60px] resize-none rounded-xl border-0 bg-muted/50 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60"
              rows={2}
            />
            <div className="flex items-center gap-2 mt-3">
              <Button variant="outline" size="sm" onClick={() => { setRepostingPost(null); setRepostContent(""); }} className="rounded-full">Cancelar</Button>
              <Button size="sm" onClick={() => handleRepost(repostingPost)} className="rounded-full gap-1.5">
                <Repeat2 className="h-3.5 w-3.5" /> Compartilhar
              </Button>
            </div>
          </div>
        </div>
      )}

      {posts.length === 0 && (
        <div className="py-16 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <MessageCircle className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">Nenhum post ainda. Seja o primeiro a publicar!</p>
        </div>
      )}

      {posts.map((post) => (
        <PostThread
          key={post.id}
          post={post}
          profile={profile}
          onReaction={handleReaction}
          onDelete={handleDelete}
          onUpdateCommentCount={updateCommentCount}
          openUserProfile={navigateToProfile}
          onPhotoClick={(index) => openPhotoViewer(post.image_urls || [], index)}
          onRepost={(p) => { setRepostingPost(p); setRepostContent(""); }}
          shareMenuOpen={shareMenuOpen}
          setShareMenuOpen={setShareMenuOpen}
        />
      ))}

      {viewerOpen && <PhotoViewer photos={viewerPhotos} initialIndex={viewerIndex} onClose={() => setViewerOpen(false)} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// PostThread
// ═══════════════════════════════════════════════════════════
function PostThread({
  post, profile, onReaction, onDelete, onUpdateCommentCount, openUserProfile, onPhotoClick, onRepost, shareMenuOpen, setShareMenuOpen,
}: {
  post: PostWithAuthor;
  profile: Profile | null;
  onReaction: (postId: string, type: string) => void;
  onDelete: (postId: string) => void;
  onUpdateCommentCount: (postId: string, delta: number) => void;
  openUserProfile?: (userId: string) => void;
  onPhotoClick?: (index: number) => void;
  onRepost: (post: PostWithAuthor) => void;
  shareMenuOpen: string | null;
  setShareMenuOpen: (id: string | null) => void;
}) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [showReactions, setShowReactions] = useState(false);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const shareRef = useRef<HTMLDivElement>(null);

  const reactionGroups = buildReactionGroups(post.reactions || []);
  const commentCount = post.comment_count || 0;
  const hasPhotos = post.image_urls && post.image_urls.length > 0;
  const hasVideo = !!post.video_url;
  const hasAudio = !!post.audio_url;
  const isOwnPost = post.author_id === profile?.id;

  const [expirationLabel, setExpirationLabel] = useState<string>("");
  useEffect(() => {
    if (!post.expires_at) return;
    const update = () => setExpirationLabel(getExpirationLabel(post.expires_at!));
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [post.expires_at]);

  // Close share menu on outside click
  useEffect(() => {
    if (shareMenuOpen !== post.id) return;
    const handler = (e: MouseEvent) => {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) {
        setShareMenuOpen(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [shareMenuOpen, post.id, setShareMenuOpen]);

  const fetchComments = async () => {
    setCommentsLoading(true);
    try {
      const res = await fetch(`/api/posts/${post.id}/comments`);
      const data = await res.json();
      if (data.comments) setComments(data.comments);
    } catch { /* silent */ }
    setCommentsLoading(false);
  };

  const toggleComments = () => {
    if (!showComments && comments.length === 0) fetchComments();
    setShowComments(!showComments);
  };

  const openAndFocus = () => {
    if (!showComments) {
      if (comments.length === 0) fetchComments();
      setShowComments(true);
    }
    setTimeout(() => commentInputRef.current?.focus(), 100);
  };

  const handleReply = (comment: Comment) => {
    setReplyTo(comment);
    if (!showComments) {
      if (comments.length === 0) fetchComments();
      setShowComments(true);
    }
    setTimeout(() => commentInputRef.current?.focus(), 100);
  };

  const submitComment = async () => {
    if (!commentInput.trim() || !profile || submitting) return;
    setSubmitting(true);
    try {
      const body: { content: string; parentId?: string } = { content: commentInput.trim() };
      if (replyTo) body.parentId = replyTo.id;
      const res = await fetch(`/api/posts/${post.id}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (data.comment) {
        setComments((prev) => [...prev, data.comment]);
        setCommentInput("");
        setReplyTo(null);
        onUpdateCommentCount(post.id, 1);
        if (!showComments) setShowComments(true);
      } else if (data.error) toast.error(data.error);
    } catch { toast.error("Erro ao comentar"); }
    setSubmitting(false);
  };

  const deleteComment = async (commentId: string) => {
    try {
      const res = await fetch(`/api/posts/${post.id}/comments?commentId=${commentId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
        onUpdateCommentCount(post.id, -1);
      }
    } catch { toast.error("Erro ao excluir comentário"); }
  };

  const handleCommentReaction = async (commentId: string, type: string) => {
    if (!profile) return;
    try {
      const res = await fetch("/api/comments/reaction", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ commentId, type }) });
      const data = await res.json();
      if (data.reacted !== undefined) {
        setComments((prev) => prev.map((c) => {
          if (c.id !== commentId) return c;
          const reactions = data.reacted ? [...(c.reactions || []), { user_id: profile.id, type }] : (c.reactions || []).filter((r: any) => !(r.user_id === profile.id && r.type === type));
          return { ...c, reactions };
        }));
      }
    } catch { /* silent */ }
  };

  const buildCommentTree = (flatComments: Comment[]) => {
    const map = new Map<string, Comment[]>();
    const roots: Comment[] = [];
    for (const c of flatComments) {
      if (c.parent_id) { const children = map.get(c.parent_id) || []; children.push(c); map.set(c.parent_id, children); }
      else roots.push(c);
    }
    return { roots, map };
  };

  const { roots: commentRoots, map: commentMap } = buildCommentTree(comments);

  return (
    <div className={`rounded-2xl border bg-card shadow-sm overflow-hidden transition-shadow hover:shadow-md ${isOwnPost ? "border-primary/10" : ""}`}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <button onClick={() => openUserProfile?.(post.author.id)} className="shrink-0 group">
            <UserAvatar user={post.author} className="h-11 w-11 hover:opacity-80 transition-opacity ring-2 ring-background shadow-sm" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => openUserProfile?.(post.author.id)} className="text-sm font-bold hover:underline underline-offset-2 transition-all">
                {post.author.display_name}
              </button>
              <span className="text-xs text-muted-foreground">@{post.author.username}</span>
              {post.author.neighborhood && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-0.5">
                  <MapPin className="h-2.5 w-2.5" />{post.author.neighborhood}
                </Badge>
              )}
              {post.visibility === "followers" && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-0.5 text-amber-500 border-amber-500/30">
                  <UsersIcon className="h-2.5 w-2.5" />Seguidores
                </Badge>
              )}
              {isOwnPost && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-0.5 text-primary/60 border-primary/20">
                  Seu post
                </Badge>
              )}
              <span className="text-[10px] text-muted-foreground/60">·</span>
              <span className="text-[10px] text-muted-foreground">{timeAgo(post.created_at)}</span>
            </div>

            {/* Content */}
            <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>

            {/* Shared post (repost) */}
            {post.shared_post && (
              <div className="mt-2.5 rounded-xl border bg-muted/20 p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <Repeat2 className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">Compartilhado de</span>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <button onClick={() => openUserProfile?.(post.shared_post!.author.id)} className="shrink-0">
                    <UserAvatar user={post.shared_post.author} className="h-6 w-6" />
                  </button>
                  <button onClick={() => openUserProfile?.(post.shared_post!.author.id)} className="text-xs font-semibold hover:underline">
                    {post.shared_post.author.display_name}
                  </button>
                  <span className="text-[10px] text-muted-foreground">@{post.shared_post.author.username}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">{post.shared_post.content}</p>
                {post.shared_post.image_urls && post.shared_post.image_urls.length > 0 && (
                  <div className="mt-1.5 flex gap-1 overflow-x-auto">
                    {post.shared_post.image_urls.slice(0, 2).map((url, i) => (
                      <img key={i} src={url} alt="" className="h-16 w-16 rounded-lg object-cover shrink-0" />
                    ))}
                    {post.shared_post.image_urls.length > 2 && (
                      <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center text-xs text-muted-foreground shrink-0">
                        +{post.shared_post.image_urls.length - 2}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Media */}
            {hasPhotos && <PhotoGrid photos={post.image_urls!} onPhotoClick={onPhotoClick} />}
            {hasVideo && <VideoPlayer src={post.video_url!} />}
            {hasAudio && <AudioPlayer src={post.audio_url!} />}

            {/* Expiration */}
            {post.expires_at && expirationLabel && (
              <div className="mt-2.5 flex items-center gap-1.5 text-[10px] text-amber-500 bg-amber-500/5 rounded-full px-2.5 py-1 w-fit">
                <Clock className="h-3 w-3" />
                <span>{expirationLabel}</span>
              </div>
            )}

            {/* ═══════ ACTION BAR ═══════ */}
            <div className="mt-3 flex items-center gap-0.5">
              {/* Reactions */}
              <div className="relative">
                <button
                  onClick={() => setShowReactions(!showReactions)}
                  className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs transition-colors ${post.reactions?.some((r) => r.user_id === profile?.id) ? "text-primary bg-primary/10 font-medium" : "text-muted-foreground hover:bg-accent hover:text-primary"}`}
                >
                  <Heart className="h-4 w-4" />
                  {post.reactions?.length > 0 && <span>{post.reactions.length}</span>}
                </button>
                {showReactions && (
                  <div className="absolute bottom-full left-0 mb-1.5 flex gap-0.5 rounded-xl border bg-card p-1.5 shadow-xl z-20">
                    {REACTION_EMOJIS.map(({ type, emoji, label }) => {
                      const isActive = post.reactions?.some((r) => r.user_id === profile?.id && r.type === type);
                      return (
                        <button
                          key={type}
                          onClick={() => { onReaction(post.id, type); setShowReactions(false); }}
                          className={`rounded-lg p-1.5 text-lg transition-all hover:scale-125 ${isActive ? "bg-primary/10 ring-1 ring-primary" : ""}`}
                          title={label}
                        >
                          {emoji}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Reaction summary pills */}
              {reactionGroups.length > 0 && (
                <div className="flex gap-0.5 ml-0.5">
                  {reactionGroups.slice(0, 3).map((g, i) => (
                    <span key={i} className="inline-flex items-center gap-0.5 rounded-full bg-muted/60 px-1.5 py-0.5 text-[10px]">
                      {g.emoji} {g.count}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex-1" />

              {/* Comment */}
              <button onClick={openAndFocus} className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-primary">
                <MessageCircle className="h-4 w-4" />
                {commentCount > 0 && commentCount}
              </button>

              {/* Share/Repost */}
              <div className="relative" ref={shareRef}>
                <button
                  onClick={() => setShareMenuOpen(shareMenuOpen === post.id ? null : post.id)}
                  className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
                >
                  <Share2 className="h-4 w-4" />
                </button>
                {shareMenuOpen === post.id && (
                  <ShareMenu
                    post={post}
                    onClose={() => setShareMenuOpen(null)}
                    onRepost={onRepost}
                    triggerRef={shareRef}
                  />
                )}
              </div>

              {/* Delete (own posts only) */}
              {isOwnPost && (
                <button onClick={() => onDelete(post.id)} className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Comments toggle */}
      {(commentCount > 0 || comments.length > 0) && (
        <button onClick={toggleComments} className="flex w-full items-center justify-center gap-1.5 border-t py-2.5 text-xs text-muted-foreground transition-colors hover:bg-accent/50 hover:text-primary">
          {showComments ? <>Ocultar comentários <ChevronUp className="h-3 w-3" /></> : <>{commentCount || comments.length} comentário{(commentCount || comments.length) !== 1 ? "s" : ""} <ChevronDown className="h-3 w-3" /></>}
        </button>
      )}

      {/* Comments section */}
      {showComments && (
        <div className="border-t bg-muted/10">
          <div className="max-h-72 overflow-y-auto px-4 py-3 custom-scrollbar">
            {commentsLoading ? (
              <div className="space-y-3">{[1, 2].map((i) => (<div key={i} className="flex gap-2.5 animate-pulse"><div className="h-6 w-6 rounded-full bg-muted" /><div className="flex-1 space-y-1.5"><div className="h-3 w-24 rounded bg-muted" /><div className="h-3 w-full rounded bg-muted" /></div></div>))}</div>
            ) : comments.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-2">Nenhum comentário ainda. Seja o primeiro!</p>
            ) : (
              <div className="space-y-3">
                {commentRoots.map((comment) => (
                  <CommentItem key={comment.id} comment={comment} replies={commentMap.get(comment.id) || []} profile={profile} commentMap={commentMap} onDelete={deleteComment} onReply={handleReply} onReaction={handleCommentReaction} openUserProfile={openUserProfile} depth={0} />
                ))}
              </div>
            )}
          </div>

          {profile && (
            <div className="border-t px-4 py-2.5">
              {replyTo && (
                <div className="flex items-center gap-1.5 mb-1.5 text-xs text-muted-foreground">
                  <Reply className="h-3 w-3" />
                  <span>Respondendo a <strong>@{replyTo.author.display_name}</strong></span>
                  <button onClick={() => setReplyTo(null)} className="text-destructive hover:underline ml-1">Cancelar</button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <UserAvatar user={{ id: profile.id, display_name: profile.display_name, avatar_url: profile.avatar_url }} className="h-6 w-6 shrink-0" />
                <Input ref={commentInputRef} placeholder={replyTo ? `Responder @${replyTo.author.display_name}...` : "Escreva um comentário..."} value={commentInput} onChange={(e) => setCommentInput(e.target.value.slice(0, 300))} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && submitComment()} className="h-8 text-xs border-0 bg-muted/50 focus-visible:ring-1" />
                <Button size="icon" onClick={submitComment} disabled={!commentInput.trim() || submitting} className="h-8 w-8 shrink-0 rounded-full"><Send className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick comment (when comments hidden) */}
      {!showComments && profile && (
        <div className="flex items-center gap-2 border-t px-4 py-2.5">
          <UserAvatar user={{ id: profile.id, display_name: profile.display_name, avatar_url: profile.avatar_url }} className="h-6 w-6 shrink-0" />
          <Input placeholder="Escreva um comentário..." value={commentInput} onChange={(e) => setCommentInput(e.target.value.slice(0, 300))} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && commentInput.trim()) openAndFocus(); }} onFocus={openAndFocus} className="h-8 text-xs border-0 bg-muted/50 focus-visible:ring-1" />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// CommentItem
// ═══════════════════════════════════════════════════════════
function CommentItem({ comment, replies, profile, commentMap, onDelete, onReply, onReaction, openUserProfile, depth }: {
  comment: Comment; replies: Comment[]; profile: Profile | null; commentMap: Map<string, Comment[]>;
  onDelete: (commentId: string) => void; onReply: (comment: Comment) => void;
  onReaction: (commentId: string, type: string) => void; openUserProfile?: (userId: string) => void; depth: number;
}) {
  return (
    <div className={depth > 0 ? "ml-6 border-l-2 border-primary/20 pl-3" : ""}>
      <div className="flex gap-2.5">
        <button onClick={() => openUserProfile?.(comment.author.id)} className="shrink-0">
          <UserAvatar user={comment.author} className="h-6 w-6 hover:opacity-80 transition-opacity" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <button onClick={() => openUserProfile?.(comment.author.id)} className="text-xs font-semibold hover:underline underline-offset-2 transition-all">{comment.author.display_name}</button>
            <span className="text-[10px] text-muted-foreground">{timeAgo(comment.created_at)}</span>
          </div>
          <p className="text-xs leading-relaxed">{comment.content}</p>
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            {REACTION_EMOJIS.slice(0, 4).map(({ type, emoji }) => {
              const isActive = comment.reactions?.some((r) => r.user_id === profile?.id && r.type === type);
              const count = comment.reactions?.filter((r) => r.type === type).length || 0;
              if (count === 0 && !isActive) return null;
              return (
                <button key={type} onClick={() => onReaction(comment.id, type)} className={`text-[10px] transition-colors ${isActive ? "text-primary font-semibold" : "hover:text-primary"}`}>
                  {emoji}{count > 0 && ` ${count}`}
                </button>
              );
            })}
            <button onClick={() => onReply(comment)} className="text-[10px] text-muted-foreground hover:text-primary transition-colors">
              <Reply className="h-2.5 w-2.5 inline" /> Responder
            </button>
            {comment.author_id === profile?.id && (
              <button onClick={() => onDelete(comment.id)} className="text-[10px] text-muted-foreground hover:text-destructive">
                <Trash2 className="h-2.5 w-2.5" />
              </button>
            )}
          </div>
        </div>
      </div>
      {replies.map((reply) => (
        <CommentItem key={reply.id} comment={reply} replies={commentMap.get(reply.id) || []} profile={profile} commentMap={commentMap} onDelete={onDelete} onReply={onReply} onReaction={onReaction} openUserProfile={openUserProfile} depth={depth + 1} />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// FeedSkeleton
// ═══════════════════════════════════════════════════════════
function FeedSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl border bg-card p-4 animate-pulse">
          <div className="flex gap-3">
            <div className="h-11 w-11 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 rounded bg-muted" />
              <div className="h-3 w-full rounded bg-muted" />
              <div className="h-3 w-3/4 rounded bg-muted" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
