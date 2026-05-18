"use client";

import { useState, useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  MapPin,
  LogOut,
  Edit3,
  Camera,
  Settings,
  Lock,
  Loader2,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  ChevronDown,
  Type,
  Plus,
  ImagePlus,
  Video,
  Mic,
  Music,
  X,
  Globe,
  Users as UsersIcon,
  Play,
  Pause,
  Send,
  FileText,
  PenSquare,
} from "lucide-react";
import { getInitials, getAvatarColor, timeAgo, BAIRROS } from "@/lib/constants";
import { UserAvatar } from "./UserAvatar";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  compressImage,
  validateImageFile,
  createPreviewUrl,
  revokePreviewUrl,
} from "@/lib/image-compression";

// ═══════════════════════════════════════════════════════════
// Post-it colors — TONS MÉDIOS (nem forte nem fraco)
// ═══════════════════════════════════════════════════════════
const POST_IT_COLORS = [
  { bg: "#fef9c3", text: "#854d0e", border: "#fde68a", label: "Amarelo" },
  { bg: "#fce7f3", text: "#9d174d", border: "#fbcfe8", label: "Rosa" },
  { bg: "#dbeafe", text: "#1e40af", border: "#bfdbfe", label: "Azul" },
  { bg: "#dcfce7", text: "#166534", border: "#bbf7d0", label: "Verde" },
  { bg: "#ffedd5", text: "#9a3412", border: "#fed7aa", label: "Laranja" },
  { bg: "#ede9fe", text: "#5b21b6", border: "#ddd6fe", label: "Roxo" },
  { bg: "#fee2e2", text: "#991b1b", border: "#fecaca", label: "Coral" },
  { bg: "#d1fae5", text: "#065f46", border: "#a7f3d0", label: "Menta" },
  { bg: "#e0e7ff", text: "#3730a3", border: "#c7d2fe", label: "Lavanda" },
  { bg: "#fef3c7", text: "#92400e", border: "#fde68a", label: "Pêssego" },
  { bg: "#ffffff", text: "#374151", border: "#d1d5db", label: "Branco" },
  { bg: "#f3f4f6", text: "#4b5563", border: "#d1d5db", label: "Cinza" },
] as const;

// ═══════════════════════════════════════════════════════════
// Fontes disponíveis
// ═══════════════════════════════════════════════════════════
const FONTS = [
  { name: "Nunito", value: "Nunito" },
  { name: "Quicksand", value: "Quicksand" },
  { name: "Poppins", value: "Poppins" },
  { name: "Inter", value: "Inter" },
  { name: "Comfortaa", value: "Comfortaa" },
  { name: "Montserrat", value: "Montserrat" },
  { name: "Lato", value: "Lato" },
  { name: "Raleway", value: "Raleway" },
  { name: "DM Sans", value: "DM Sans" },
  { name: "Work Sans", value: "Work Sans" },
] as const;

const MAX_PHOTOS_PER_POST = 5;
const MAX_VIDEO_DURATION = 30;
const MAX_AUDIO_DURATION = 60;

// ═══════════════════════════════════════════════════════════
// Interface do estilo do post
// ═══════════════════════════════════════════════════════════
interface PostStyle {
  font?: string | null;
  bold?: boolean;
  italic?: boolean;
  alignment?: "left" | "center" | "right" | "justify";
  postItColor?: number | null;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function ProfileView() {
  const { profile, logout, updateProfile, setProfileSubView, unreadNotifications } = useStore();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile?.display_name || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [neighborhood, setNeighborhood] = useState(profile?.neighborhood || "");
  const [postCount, setPostCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [myPosts, setMyPosts] = useState<any[]>([]);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // ═══════ Tab state ═══════
  const [activeTab, setActiveTab] = useState<"posts" | "postar">("posts");

  // ═══════ Composer state ═══════
  const [content, setContent] = useState("");
  const [postStyle, setPostStyle] = useState<PostStyle>({
    font: null,
    bold: false,
    italic: false,
    alignment: "left",
    postItColor: 0,
  });
  const [publishing, setPublishing] = useState(false);
  const [fontMenuOpen, setFontMenuOpen] = useState(false);
  const fontMenuRef = useRef<HTMLDivElement>(null);

  // Media state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [selectedAudio, setSelectedAudio] = useState<File | null>(null);
  const [audioPreview, setAudioPreview] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [visibility, setVisibility] = useState<"public" | "followers">("public");
  const [mediaMenuOpen, setMediaMenuOpen] = useState(false);
  const mediaMenuRef = useRef<HTMLDivElement>(null);

  // Audio recording
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isPausedRecording, setIsPausedRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Input refs
  const photoInputRef = useRef<HTMLInputElement>(null);
  const cameraPhotoRef = useRef<HTMLInputElement>(null);
  const cameraVideoRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // Derived
  const hasPhotosInComposer = selectedFiles.length > 0;
  const hasVideoInComposer = !!selectedVideo;
  const hasAudioInComposer = !!selectedAudio;
  const hasMediaInComposer = hasPhotosInComposer || hasVideoInComposer || hasAudioInComposer;
  const canPost = !!profile && (content.trim().length > 0 || hasMediaInComposer);
  const canAddPhotos = !hasVideoInComposer && !hasAudioInComposer && selectedFiles.length < MAX_PHOTOS_PER_POST;
  const canAddVideo = !hasPhotosInComposer && !hasAudioInComposer && !hasVideoInComposer;
  const canAddAudio = !hasPhotosInComposer && !hasVideoInComposer && !hasAudioInComposer;

  // Carregar Google Fonts
  useEffect(() => {
    const fontsParam = FONTS.map(
      (f) => `family=${f.value.replace(/ /g, "+")}:wght@400;700`
    ).join("&");
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?${fontsParam}&display=swap`;
    document.head.appendChild(link);
  }, []);

  // Fechar menus ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (fontMenuOpen && fontMenuRef.current && !fontMenuRef.current.contains(e.target as Node)) {
        setFontMenuOpen(false);
      }
      if (mediaMenuOpen && mediaMenuRef.current && !mediaMenuRef.current.contains(e.target as Node)) {
        setMediaMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [fontMenuOpen, mediaMenuOpen]);

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (!profile) return;
    fetch(`/api/users/${profile.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.user) setPostCount(data.user._count?.posts || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    fetch(`/api/follows?userId=${profile.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) {
          setFollowingCount(data.followingCount || 0);
          setFollowersCount(data.followersCount || 0);
        }
      })
      .catch(() => {});

    fetchMyPosts();
  }, [profile]);

  const fetchMyPosts = () => {
    if (!profile) return;
    fetch(`/api/users/${profile.id}/posts`)
      .then((r) => r.json())
      .then((data) => {
        if (data.posts) setMyPosts(data.posts);
      })
      .catch(() => {});
  };

  // ═══════ Media handlers ═══════
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remaining = MAX_PHOTOS_PER_POST - selectedFiles.length;
    const toAdd = files.slice(0, remaining);
    for (const file of toAdd) {
      const error = validateImageFile(file);
      if (error) { toast.error(error); continue; }
      setSelectedFiles((prev) => [...prev, file]);
      setPreviewUrls((prev) => [...prev, createPreviewUrl(file)]);
    }
    if (photoInputRef.current) photoInputRef.current.value = "";
    setMediaMenuOpen(false);
  };

  const handleCameraPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const error = validateImageFile(file);
    if (error) { toast.error(error); return; }
    setSelectedFiles((prev) => [...prev, file]);
    setPreviewUrls((prev) => [...prev, createPreviewUrl(file)]);
    if (cameraPhotoRef.current) cameraPhotoRef.current.value = "";
    setMediaMenuOpen(false);
  };

  const removePhoto = (index: number) => {
    revokePreviewUrl(previewUrls[index]);
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { toast.error("Vídeo muito grande (máx 50MB)"); return; }
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      if (video.duration > MAX_VIDEO_DURATION) { toast.error(`Vídeo muito longo (máx ${MAX_VIDEO_DURATION}s)`); URL.revokeObjectURL(video.src); return; }
      setVideoDuration(video.duration);
      setSelectedVideo(file);
      setVideoPreview(URL.createObjectURL(file));
      URL.revokeObjectURL(video.src);
    };
    video.src = URL.createObjectURL(file);
    setMediaMenuOpen(false);
  };

  const handleAudioSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Áudio muito grande (máx 10MB)"); return; }
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      if (audio.duration > MAX_AUDIO_DURATION) { toast.error(`Áudio muito longo (máx ${MAX_AUDIO_DURATION}s)`); URL.revokeObjectURL(audio.src); return; }
      setAudioDuration(audio.duration);
      setSelectedAudio(file);
      setAudioPreview(URL.createObjectURL(file));
      URL.revokeObjectURL(audio.src);
    };
    audio.src = URL.createObjectURL(file);
    setMediaMenuOpen(false);
  };

  // ═══════ Audio recording ═══════
  const startAudioRecording = async () => {
    setMediaMenuOpen(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      let mimeType = "audio/webm";
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = "audio/webm;codecs=opus";
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = "audio/mp4";
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        const ext = mimeType.includes("mp4") ? "m4a" : "webm";
        const file = new File([blob], `gravação.${ext}`, { type: mimeType });
        const url = URL.createObjectURL(file);
        const tempAudio = document.createElement("audio");
        tempAudio.preload = "metadata";
        tempAudio.onloadedmetadata = () => {
          setAudioDuration(tempAudio.duration);
          setSelectedAudio(file);
          setAudioPreview(url);
          URL.revokeObjectURL(tempAudio.src);
        };
        tempAudio.src = url;
        if (mediaStreamRef.current) { mediaStreamRef.current.getTracks().forEach((t) => t.stop()); mediaStreamRef.current = null; }
        mediaRecorderRef.current = null;
        setIsRecordingAudio(false);
        setIsPausedRecording(false);
      };
      mediaRecorder.start(1000);
      setIsRecordingAudio(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => { if (prev + 1 >= MAX_AUDIO_DURATION) { stopAudioRecording(); return MAX_AUDIO_DURATION; } return prev + 1; });
      }, 1000);
    } catch { toast.error("Não foi possível acessar o microfone."); }
  };

  const stopAudioRecording = () => {
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") mediaRecorderRef.current.stop();
  };

  const cancelAudioRecording = () => {
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") { mediaRecorderRef.current.onstop = null; mediaRecorderRef.current.stop(); }
    if (mediaStreamRef.current) { mediaStreamRef.current.getTracks().forEach((t) => t.stop()); mediaStreamRef.current = null; }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    setIsRecordingAudio(false);
    setIsPausedRecording(false);
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

  // ═══════ Upload helpers ═══════
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

  // ═══════ Profile handlers ═══════
  const handleSave = async () => {
    if (!profile) return;
    try {
      const res = await fetch(`/api/users/${profile.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim().slice(0, 50), bio: bio.trim().slice(0, 300), neighborhood }),
      });
      const data = await res.json();
      if (data.user) { updateProfile(data.user); setEditing(false); toast.success("Perfil atualizado!"); }
    } catch { toast.error("Erro ao salvar"); }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Imagem muito grande (máx 2MB)"); return; }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", profile.id);
      const res = await fetch("/api/users/avatar", { method: "POST", body: formData });
      const data = await res.json();
      if (data.avatar_url) { updateProfile({ avatar_url: data.avatar_url }); toast.success("Avatar atualizado!"); }
      else toast.error(data.error || "Erro ao enviar avatar");
    } catch { toast.error("Erro ao enviar avatar"); }
    setUploading(false);
  };

  const handleLogout = async () => {
    try {
      const supabase = createClient();
      await supabase.removeAllChannels();
      await supabase.auth.signOut();
      logout();
    } catch { toast.error("Erro ao sair"); }
  };

  // ═══════ Publicar post com estilo e mídia ═══════
  const handlePublish = async () => {
    if (!profile) return;
    if (!content.trim() && !hasMediaInComposer) return;
    setPublishing(true);
    try {
      let imageUrls: string[] = [];
      let videoUrl: string | null = null;
      let audioUrl: string | null = null;

      if (selectedFiles.length > 0) {
        imageUrls = await uploadPhotos();
        if (imageUrls.length === 0 && selectedFiles.length > 0) { toast.error("Falha ao enviar fotos."); setPublishing(false); return; }
      }
      if (selectedVideo) {
        videoUrl = await uploadVideo(selectedVideo);
        if (!videoUrl) { setPublishing(false); return; }
      }
      if (selectedAudio) {
        audioUrl = await uploadAudio(selectedAudio);
        if (!audioUrl) { setPublishing(false); return; }
      }

      const postContent = content.trim() || (
        selectedFiles.length > 0 ? "📷" :
        selectedVideo ? "🎥" :
        selectedAudio ? "🎙️" : ""
      );

      const styleToSend: PostStyle = { ...postStyle };
      if (!styleToSend.font) delete styleToSend.font;
      if (!styleToSend.bold) delete styleToSend.bold;
      if (!styleToSend.italic) delete styleToSend.italic;
      if (styleToSend.alignment === "left") delete styleToSend.alignment;
      if (styleToSend.postItColor === null || styleToSend.postItColor === undefined) delete styleToSend.postItColor;

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: postContent,
          neighborhood: profile.neighborhood,
          imageUrls,
          videoUrl,
          audioUrl,
          audioDuration,
          videoDuration,
          visibility,
          postStyle: styleToSend,
        }),
      });
      const data = await res.json();
      if (data.post) {
        setContent("");
        setPostStyle({ font: null, bold: false, italic: false, alignment: "left", postItColor: 0 });
        clearMedia();
        toast.success("Post publicado!");
        fetchMyPosts();
        setActiveTab("posts");
      } else if (data.error) {
        toast.error(data.error);
      }
    } catch { toast.error("Erro ao publicar"); }
    setPublishing(false);
  };

  if (loading) return <div className="space-y-4">{[1,2].map(i=><div key={i} className="h-24 rounded-xl bg-[#01386A]/[0.04] animate-pulse"/>)}</div>;

  const isPrivate = profile?.is_private || false;
  const selectedColor = POST_IT_COLORS[postStyle.postItColor ?? 0];

  return (
    <div className="space-y-4">
      {/* ═══════ CARD DO PERFIL ═══════ */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="relative">
                <UserAvatar
                  user={{ id: profile?.id || "", display_name: profile?.display_name || "?", avatar_url: profile?.avatar_url }}
                  className="h-16 w-16"
                />
                <button onClick={() => avatarInputRef.current?.click()} disabled={uploading} className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#f7f9fa] bg-[#01386A] text-[#f7f9fa] shadow-sm transition-colors hover:bg-[#01386A]/90">
                  <Camera className="h-3.5 w-3.5" />
                </button>
                <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleAvatarUpload} className="hidden" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h2 className="text-lg font-bold text-[#000305]">{profile?.display_name}</h2>
                  {isPrivate && <Lock className="h-4 w-4 text-[#01386A]/40" />}
                </div>
                <p className="text-sm text-[#01386A]/40">@{profile?.username}</p>
                {profile?.neighborhood && (
                  <Badge variant="secondary" className="mt-1.5 gap-1 bg-[#01386A]/10 text-[#01386A] border-0">
                    <MapPin className="h-3 w-3" /> {profile.neighborhood}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {!editing ? (
            <div className="mt-4">
              {profile?.bio ? <p className="text-sm text-[#000305]">{profile.bio}</p> : <p className="text-sm text-[#01386A]/40 italic">Sem bio ainda</p>}
              <div className="flex gap-2 mt-3">
                <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-1.5 border-[#01386A]/10 text-[#01386A] hover:bg-[#f7f75e]/20">
                  <Edit3 className="h-3.5 w-3.5" /> Editar perfil
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="space-y-1.5"><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={50} /></div>
              <div className="space-y-1.5"><Label>Bio</Label><Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={300} /><span className="text-xs text-[#01386A]/40">{bio.length}/300</span></div>
              <div className="space-y-1.5">
                <Label>Bairro</Label>
                <select value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} className="flex h-10 w-full rounded-md border border-[#01386A]/10 bg-[#f7f9fa] px-3 py-2 text-sm">
                  <option value="">Nenhum</option>
                  {BAIRROS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSave} size="sm" className="bg-[#01386A] text-[#f7f9fa] hover:bg-[#01386A]/90 border-0">Salvar</Button>
                <Button variant="outline" size="sm" onClick={() => setEditing(false)} className="border-[#01386A]/10 text-[#01386A]">Cancelar</Button>
              </div>
            </div>
          )}

          <div className="mt-6 flex gap-6">
            <div className="text-center"><p className="text-lg font-bold text-[#000305]">{postCount}</p><p className="text-xs text-[#01386A]/40">Posts</p></div>
            <div className="text-center"><p className="text-lg font-bold text-[#000305]">{followingCount}</p><p className="text-xs text-[#01386A]/40">Seguindo</p></div>
            <div className="text-center"><p className="text-lg font-bold text-[#000305]">{followersCount}</p><p className="text-xs text-[#01386A]/40">Seguidores</p></div>
          </div>
        </CardContent>
      </Card>

      {/* ═══════ ABAS: Meus Posts / Postar ═══════ */}
      <div className="flex rounded-xl bg-[#0A4D5C]/[0.06] p-1">
        <button
          onClick={() => setActiveTab("posts")}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${activeTab === "posts" ? "bg-[#f7f9fa] text-[#0A4D5C] shadow-sm" : "text-[#0A4D5C]/50 hover:text-[#0A4D5C]/70"}`}
        >
          <FileText className="h-3.5 w-3.5" />
          Meus Posts
        </button>
        <button
          onClick={() => setActiveTab("postar")}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${activeTab === "postar" ? "bg-[#f7f9fa] text-[#0A4D5C] shadow-sm" : "text-[#0A4D5C]/50 hover:text-[#0A4D5C]/70"}`}
        >
          <PenSquare className="h-3.5 w-3.5" />
          Postar
        </button>
      </div>

      {/* ═══════ CONTEÚDO DAS ABAS ═══════ */}
      {activeTab === "posts" ? (
        <>
          {/* Meus Posts */}
          {myPosts.length > 0 ? (
            <div className="space-y-2">
              {myPosts.map((post: any) => {
                const postStyleData: PostStyle | null = post.post_style;
                const isTextOnly = !post.image_urls?.length && !post.video_url && !post.audio_url;
                const colorIdx = postStyleData?.postItColor ?? 0;
                const postItColor = isTextOnly ? POST_IT_COLORS[colorIdx >= 0 && colorIdx < POST_IT_COLORS.length ? colorIdx : 0] : POST_IT_COLORS[0];

                return (
                  <div
                    key={post.id}
                    className="rounded-xl p-3 transition-shadow hover:shadow-sm"
                    style={{
                      backgroundColor: isTextOnly ? postItColor.bg : "#f7f9fa",
                      border: isTextOnly ? `1px solid ${postItColor.border}` : "1px solid rgba(10,77,92,0.08)",
                      color: isTextOnly ? postItColor.text : "#000305",
                    }}
                  >
                    <p
                      className="text-sm whitespace-pre-wrap"
                      style={{
                        fontFamily: postStyleData?.font ? `'${postStyleData.font}', sans-serif` : isTextOnly ? "serif" : undefined,
                        fontWeight: postStyleData?.bold ? 700 : undefined,
                        fontStyle: postStyleData?.italic ? "italic" : undefined,
                        textAlign: postStyleData?.alignment || undefined,
                      }}
                    >
                      {post.content}
                    </p>
                    <div className="mt-1 flex items-center gap-2" style={{ color: isTextOnly ? `${postItColor.text}80` : "rgba(1,56,106,0.4)" }}>
                      <span className="text-[10px]">{timeAgo(post.created_at)}</span>
                      {post.neighborhood && <span className="text-[10px]">· {post.neighborhood}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="h-10 w-10 text-[#0A4D5C]/15 mb-2" />
              <p className="text-sm text-[#0A4D5C]/40">Nenhum post ainda</p>
              <button onClick={() => setActiveTab("postar")} className="mt-2 text-xs font-semibold text-[#0A4D5C] hover:underline">
                Criar primeiro post
              </button>
            </div>
          )}

          {/* Configurações */}
          <Card className="cursor-pointer hover:bg-[#f7f75e]/10 transition-colors border-[#01386A]/8" onClick={() => setProfileSubView("settings")}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f7f75e]/30">
                    <Settings className="h-4 w-4 text-[#01386A]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#000305]">Configurações</p>
                    <p className="text-xs text-[#01386A]/40">Privacidade, seguidores e permissões</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {unreadNotifications > 0 && (
                    <Badge variant="default" className="h-5 min-w-5 px-1.5 text-[10px] flex items-center justify-center bg-[#01386A] text-[#f7f9fa]">{unreadNotifications}</Badge>
                  )}
                  <span className="text-[#01386A]/30 text-sm">›</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button variant="destructive" onClick={handleLogout} className="w-full gap-2">
            <LogOut className="h-4 w-4" /> Sair da conta
          </Button>
        </>
      ) : (
        <>
          {/* ═══════ ABA POSTAR — MINI EDITOR VERTICAL COMPACTO ═══════ */}
          <div className="rounded-2xl bg-[#eef1f3] p-2.5 shadow-lg border border-[#0A4D5C]/8">
            {/* Textarea com visualização de estilo */}
            <div
              className="rounded-xl border border-[#0A4D5C]/8 overflow-hidden transition-all"
              style={{ backgroundColor: selectedColor.bg }}
            >
              <textarea
                placeholder="Escreva algo bonito..."
                value={content}
                onChange={(e) => setContent(e.target.value.slice(0, 500))}
                className="w-full min-h-[52px] resize-none border-0 bg-transparent px-2.5 py-2 text-sm focus:outline-none placeholder:opacity-40"
                style={{
                  color: selectedColor.text,
                  fontFamily: postStyle.font ? `'${postStyle.font}', sans-serif` : undefined,
                  fontWeight: postStyle.bold ? 700 : 400,
                  fontStyle: postStyle.italic ? "italic" : "normal",
                  textAlign: postStyle.alignment || "left",
                }}
                rows={2}
              />
            </div>

            {/* Media previews */}
            {hasPhotosInComposer && previewUrls.length > 0 && (
              <div className="flex gap-1.5 flex-wrap mt-1.5">
                {previewUrls.map((url, i) => (
                  <div key={i} className="relative group">
                    <img src={url} alt={`Preview ${i + 1}`} className="h-12 w-12 rounded-lg object-cover shadow-sm border border-[#f7f9fa]" />
                    <button onClick={() => removePhoto(i)} className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#0A4D5C] text-[#f7f9fa] opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {hasVideoInComposer && videoPreview && (
              <div className="relative rounded-lg overflow-hidden mt-1.5">
                <video src={videoPreview} className="w-full max-h-24 object-cover" playsInline muted />
                <div className="absolute top-1 left-1 flex items-center gap-1 rounded-full bg-[#f7f75e] px-1.5 py-0.5 text-[9px] font-semibold text-[#000305]">
                  <Video className="h-2.5 w-2.5" /> {formatDuration(videoDuration)}
                </div>
                <button onClick={() => { setSelectedVideo(null); if (videoPreview) URL.revokeObjectURL(videoPreview); setVideoPreview(null); setVideoDuration(0); }} className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#0A4D5C] text-[#f7f9fa]">
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            )}

            {hasAudioInComposer && audioPreview && (
              <div className="relative rounded-lg bg-[#0A4D5C]/[0.06] p-1.5 border border-[#0A4D5C]/10 mt-1.5">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0A4D5C] text-[#f7f9fa]">
                    <Music className="h-3 w-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-medium text-[#000305]">Áudio</span>
                    <span className="text-[9px] text-[#0A4D5C]/40 ml-1">{formatDuration(audioDuration)}</span>
                  </div>
                  <button onClick={() => { setSelectedAudio(null); if (audioPreview) URL.revokeObjectURL(audioPreview); setAudioPreview(null); setAudioDuration(0); }} className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0A4D5C] text-[#f7f9fa]">
                    <X className="h-2 w-2" />
                  </button>
                </div>
                <audio src={audioPreview} controls className="mt-1 w-full h-6" />
              </div>
            )}

            {/* ═══════ TOOLBAR — LINHA ÚNICA DE FORMATO ═══════ */}
            <div className="flex items-center gap-px mt-1.5 flex-wrap">
              <button
                onClick={() => setPostStyle((s) => ({ ...s, bold: !s.bold }))}
                className={`flex items-center justify-center rounded-md h-6 w-6 shrink-0 transition-colors ${postStyle.bold ? "bg-[#0A4D5C] text-[#f7f9fa]" : "bg-[#0A4D5C]/[0.06] text-[#0A4D5C] hover:bg-[#0A4D5C]/10"}`}
                title="Negrito"
              >
                <Bold className="h-3 w-3" />
              </button>
              <button
                onClick={() => setPostStyle((s) => ({ ...s, italic: !s.italic }))}
                className={`flex items-center justify-center rounded-md h-6 w-6 shrink-0 transition-colors ${postStyle.italic ? "bg-[#0A4D5C] text-[#f7f9fa]" : "bg-[#0A4D5C]/[0.06] text-[#0A4D5C] hover:bg-[#0A4D5C]/10"}`}
                title="Itálico"
              >
                <Italic className="h-3 w-3" />
              </button>

              <div className="w-px h-3.5 bg-[#0A4D5C]/10 mx-0.5 shrink-0" />

              {([
                { align: "left" as const, Icon: AlignLeft, label: "Esq" },
                { align: "center" as const, Icon: AlignCenter, label: "Centro" },
                { align: "right" as const, Icon: AlignRight, label: "Dir" },
                { align: "justify" as const, Icon: AlignJustify, label: "Just" },
              ]).map(({ align, Icon }) => (
                <button
                  key={align}
                  onClick={() => setPostStyle((s) => ({ ...s, alignment: align }))}
                  className={`flex items-center justify-center rounded-md h-6 w-6 shrink-0 transition-colors ${postStyle.alignment === align ? "bg-[#0A4D5C] text-[#f7f9fa]" : "bg-[#0A4D5C]/[0.06] text-[#0A4D5C] hover:bg-[#0A4D5C]/10"}`}
                  title={align}
                >
                  <Icon className="h-3 w-3" />
                </button>
              ))}

              <div className="w-px h-3.5 bg-[#0A4D5C]/10 mx-0.5 shrink-0" />

              {/* Fonte dropdown */}
              <div className="relative shrink-0" ref={fontMenuRef}>
                <button
                  onClick={() => setFontMenuOpen(!fontMenuOpen)}
                  className={`flex items-center gap-0.5 rounded-md h-6 px-1 text-[9px] font-medium transition-colors ${fontMenuOpen ? "bg-[#0A4D5C] text-[#f7f9fa]" : "bg-[#0A4D5C]/[0.06] text-[#0A4D5C] hover:bg-[#0A4D5C]/10"}`}
                >
                  <Type className="h-2.5 w-2.5" />
                  <span className="max-w-[36px] truncate">{postStyle.font || "Fonte"}</span>
                  <ChevronDown className={`h-2 w-2 transition-transform ${fontMenuOpen ? "rotate-180" : ""}`} />
                </button>
                {fontMenuOpen && (
                  <div className="absolute left-0 top-full mt-1 z-50 w-36 rounded-xl bg-[#f7f9fa] p-1 shadow-lg border border-[#0A4D5C]/10 animate-in fade-in-0 zoom-in-95 max-h-[180px] overflow-y-auto">
                    <button
                      onClick={() => { setPostStyle((s) => ({ ...s, font: null })); setFontMenuOpen(false); }}
                      className={`w-full text-left rounded-lg px-2 py-1 text-[10px] transition-colors ${!postStyle.font ? "bg-[#0A4D5C] text-[#f7f9fa]" : "text-[#0A4D5C] hover:bg-[#0A4D5C]/10"}`}
                    >
                      Padrão
                    </button>
                    {FONTS.map((f) => (
                      <button
                        key={f.value}
                        onClick={() => { setPostStyle((s) => ({ ...s, font: f.value })); setFontMenuOpen(false); }}
                        className={`w-full text-left rounded-lg px-2 py-1 text-[10px] transition-colors ${postStyle.font === f.value ? "bg-[#0A4D5C] text-[#f7f9fa]" : "text-[#0A4D5C] hover:bg-[#0A4D5C]/10"}`}
                        style={{ fontFamily: `'${f.value}', sans-serif` }}
                      >
                        {f.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Espaçador flex */}
              <div className="flex-1" />

              {/* Menu de mídias (inline) */}
              <div className="relative" ref={mediaMenuRef}>
                <button
                  onClick={() => setMediaMenuOpen(!mediaMenuOpen)}
                  className={`flex items-center justify-center rounded-md h-6 w-6 transition-colors ${mediaMenuOpen ? "bg-[#f7f75e] text-[#0A4D5C]" : "bg-[#f7f75e]/60 text-[#0A4D5C] hover:bg-[#f7f75e]"}`}
                  title="Mídia"
                >
                  <Plus className="h-3 w-3" />
                </button>

                {mediaMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 z-50 flex flex-col items-center gap-px rounded-2xl bg-[#f7f9fa] p-1 shadow-lg border border-[#0A4D5C]/10 animate-in fade-in-0 zoom-in-95">
                    <button onClick={() => { if (canAddPhotos) cameraPhotoRef.current?.click(); }} disabled={!canAddPhotos} title="Tirar foto" className={`flex items-center justify-center rounded-full p-1.5 transition-colors ${canAddPhotos ? "text-[#0A4D5C] hover:bg-[#f7f75e]/30" : "text-[#0A4D5C]/25 cursor-not-allowed"}`}>
                      <Camera className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => { if (canAddPhotos) photoInputRef.current?.click(); }} disabled={!canAddPhotos} title="Galeria" className={`flex items-center justify-center rounded-full p-1.5 transition-colors ${canAddPhotos ? "text-[#0A4D5C] hover:bg-[#f7f75e]/30" : "text-[#0A4D5C]/25 cursor-not-allowed"}`}>
                      <ImagePlus className="h-3.5 w-3.5" />
                    </button>
                    <div className="w-6 h-px bg-[#0A4D5C]/10" />
                    <button onClick={() => { if (canAddVideo) cameraVideoRef.current?.click(); }} disabled={!canAddVideo} title="Gravar vídeo" className={`flex items-center justify-center rounded-full p-1.5 transition-colors ${canAddVideo ? "text-[#0A4D5C] hover:bg-[#f7f75e]/30" : "text-[#0A4D5C]/25 cursor-not-allowed"}`}>
                      <Video className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => { if (canAddVideo) videoInputRef.current?.click(); }} disabled={!canAddVideo} title="Escolher vídeo" className={`flex items-center justify-center rounded-full p-1.5 transition-colors ${canAddVideo ? "text-[#0A4D5C]/70 hover:bg-[#f7f75e]/30" : "text-[#0A4D5C]/25 cursor-not-allowed"}`}>
                      <Video className="h-3.5 w-3.5" />
                    </button>
                    <div className="w-6 h-px bg-[#0A4D5C]/10" />
                    <button onClick={() => { if (canAddAudio && !isRecordingAudio) startAudioRecording(); }} disabled={!canAddAudio || isRecordingAudio} title="Gravar áudio" className={`flex items-center justify-center rounded-full p-1.5 transition-colors ${canAddAudio && !isRecordingAudio ? "text-[#0A4D5C] hover:bg-[#f7f75e]/30" : "text-[#0A4D5C]/25 cursor-not-allowed"}`}>
                      <Mic className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => { if (canAddAudio) audioInputRef.current?.click(); }} disabled={!canAddAudio} title="Escolher áudio" className={`flex items-center justify-center rounded-full p-1.5 transition-colors ${canAddAudio ? "text-[#0A4D5C]/70 hover:bg-[#f7f75e]/30" : "text-[#0A4D5C]/25 cursor-not-allowed"}`}>
                      <Music className="h-3.5 w-3.5" />
                    </button>
                    <div className="w-6 h-px bg-[#0A4D5C]/10" />
                    <button onClick={() => setVisibility((v) => v === "public" ? "followers" : "public")} title={visibility === "public" ? "Público" : "Seguidores"} className="flex items-center justify-center rounded-full p-1.5 text-[#0A4D5C] transition-colors hover:bg-[#f7f75e]/30">
                      {visibility === "public" ? <Globe className="h-3.5 w-3.5" /> : <UsersIcon className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                )}

                {/* Hidden inputs */}
                <input ref={cameraPhotoRef} type="file" accept="image/*" capture="environment" onChange={handleCameraPhoto} className="hidden" />
                <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={handlePhotoSelect} className="hidden" />
                <input ref={cameraVideoRef} type="file" accept="video/*" capture="environment" onChange={handleVideoSelect} className="hidden" />
                <input ref={videoInputRef} type="file" accept="video/mp4,video/webm,video/quicktime" onChange={handleVideoSelect} className="hidden" />
                <input ref={audioInputRef} type="file" accept="audio/mpeg,audio/mp4,audio/webm,audio/ogg,audio/wav,audio/x-m4a" onChange={handleAudioSelect} className="hidden" />
              </div>

              {/* Visibilidade inline */}
              <button
                onClick={() => setVisibility((v) => v === "public" ? "followers" : "public")}
                className={`flex items-center justify-center rounded-md h-6 w-6 transition-colors ${visibility === "followers" ? "bg-[#0A4D5C] text-[#f7f9fa]" : "bg-[#0A4D5C]/[0.06] text-[#0A4D5C] hover:bg-[#0A4D5C]/10"}`}
                title={visibility === "public" ? "Público" : "Seguidores"}
              >
                {visibility === "public" ? <Globe className="h-3 w-3" /> : <UsersIcon className="h-3 w-3" />}
              </button>

              {/* Contagem */}
              {content.trim().length > 0 && (
                <span className={`text-[8px] shrink-0 ${content.length > 450 ? "text-red-500" : "text-[#0A4D5C]/30"}`}>
                  {content.length}/500
                </span>
              )}

              {/* Publicar */}
              <button
                disabled={!canPost || publishing}
                onClick={handlePublish}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-[#2EC4B6] text-[#f7f9fa] shadow-md hover:bg-[#25b0a3] active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100 shrink-0"
                title="Publicar"
              >
                {publishing ? <Loader2 className="h-3 w-3 animate-spin" /> : <span className="text-xs">💬</span>}
              </button>
            </div>

            {/* ═══════ CORES — GRID 2 LINHAS × 6 ═══════ */}
            <div className="grid grid-cols-6 gap-1 mt-1.5">
              {POST_IT_COLORS.map((color, i) => (
                <button
                  key={i}
                  onClick={() => setPostStyle((s) => ({ ...s, postItColor: i }))}
                  className={`h-5 rounded-full border-2 transition-all hover:scale-105 ${postStyle.postItColor === i ? "border-[#0A4D5C] scale-105 shadow-sm" : "border-[#0A4D5C]/10"}`}
                  style={{ backgroundColor: color.bg }}
                  title={color.label}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Recording overlay */}
      {isRecordingAudio && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#000305]/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-5 p-6">
            <div className={`flex h-20 w-20 items-center justify-center rounded-full bg-[#0A4D5C] text-[#f7f9fa] shadow-2xl ${isPausedRecording ? "" : "animate-pulse"}`}>
              <Mic className="h-10 w-10" />
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-[#f7f9fa] tabular-nums">{formatDuration(recordingSeconds)}</p>
              <p className="text-[10px] text-[#f7f9fa]/50 mt-0.5">{isPausedRecording ? "Pausado" : "Gravando..."}</p>
            </div>
            <div className="w-36 h-1.5 bg-[#f7f9fa]/20 rounded-full overflow-hidden">
              <div className="h-full bg-[#f7f75e] rounded-full transition-all" style={{ width: `${(recordingSeconds / MAX_AUDIO_DURATION) * 100}%` }} />
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => { if (!mediaRecorderRef.current) return; if (isPausedRecording) { mediaRecorderRef.current.resume(); setIsPausedRecording(false); recordingTimerRef.current = setInterval(() => { setRecordingSeconds((prev) => { if (prev + 1 >= MAX_AUDIO_DURATION) { stopAudioRecording(); return MAX_AUDIO_DURATION; } return prev + 1; }); }, 1000); } else { mediaRecorderRef.current.pause(); setIsPausedRecording(true); if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; } } }} className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f7f9fa]/10 text-[#f7f9fa] hover:bg-[#f7f9fa]/20 transition-colors" title={isPausedRecording ? "Continuar" : "Pausar"}>
                {isPausedRecording ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </button>
              <button onClick={stopAudioRecording} className="flex h-12 w-12 items-center justify-center rounded-full bg-[#2EC4B6] text-[#f7f9fa] shadow-lg hover:bg-[#25b0a3] transition-colors" title="Enviar">
                <Send className="h-5 w-5" />
              </button>
              <button onClick={cancelAudioRecording} className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f7f9fa]/10 text-[#f7f9fa] hover:bg-red-500/80 transition-colors" title="Cancelar">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
