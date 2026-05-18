"use client";

import { useState, useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, LogOut, Edit3, Camera, Settings, Lock, Bell, Play, Pause, Video as VideoIcon, X, Music, Volume2, Clock } from "lucide-react";
import { getInitials, getAvatarColor, timeAgo, BAIRROS } from "@/lib/constants";
import { UserAvatar } from "./UserAvatar";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

// ═══════════════════════════════════════════════════════════
// Helper: format duration (mm:ss)
// ═══════════════════════════════════════════════════════════
function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
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
    <div className="mt-2.5 relative rounded-3xl overflow-hidden bg-[#000305] shadow-lg group">
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
        <div className="absolute inset-0 flex items-center justify-center bg-[#000305]/30 cursor-pointer" onClick={toggle}>
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#0A4D5C] shadow-lg transition-transform hover:scale-110">
            <Play className="h-8 w-8 text-[#f7f9fa] fill-[#f7f9fa] ml-1" />
          </div>
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#000305]/70 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <div className="flex items-center gap-2">
          <button onClick={toggle} className="text-[#f7f9fa]">
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <div className="flex-1 h-1 bg-[#f7f9fa]/30 rounded-full overflow-hidden cursor-pointer" onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            if (videoRef.current && duration) videoRef.current.currentTime = pct * duration;
          }}>
            <div className="h-full bg-[#f7f75e] rounded-full transition-all" style={{ width: duration ? `${(currentTime / duration) * 100}%` : "0%" }} />
          </div>
          <span className="text-[10px] text-[#f7f9fa]/80 tabular-nums">{formatDuration(currentTime)}/{formatDuration(duration)}</span>
        </div>
      </div>
      <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 rounded-full bg-[#f7f75e] backdrop-blur-sm px-2.5 py-1 text-[10px] font-semibold text-[#000305]">
        <VideoIcon className="h-3 w-3" /> Vídeo
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
    <div className="mt-2.5 rounded-3xl bg-[#0A4D5C]/[0.06] p-4 shadow-sm border border-[#0A4D5C]/10">
      <div className="flex items-center gap-3.5">
        <button onClick={toggle} className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-[#0A4D5C] text-[#f7f9fa] shadow-md hover:bg-[#0A4D5C]/90 transition-all hover:scale-105">
          {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Music className="h-3.5 w-3.5 text-[#0A4D5C]/50" />
            <span className="text-[11px] font-semibold text-[#000305]/70 tabular-nums">{formatDuration(currentTime)}</span>
            <span className="text-[10px] text-[#0A4D5C]/30">/</span>
            <span className="text-[11px] text-[#0A4D5C]/40 tabular-nums">{formatDuration(duration)}</span>
          </div>
          <div className="h-1.5 bg-[#0A4D5C]/20 rounded-full overflow-hidden cursor-pointer" onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            if (audioRef.current && duration) audioRef.current.currentTime = pct * duration;
          }}>
            <div className="h-full bg-[#0A4D5C] rounded-full transition-all" style={{ width: duration ? `${(currentTime / duration) * 100}%` : "0%" }} />
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
      <button onClick={() => onPhotoClick?.(0)} className="mt-2.5 w-full overflow-hidden rounded-3xl shadow-lg">
        <img src={photos[0]} alt="Foto do post" className="w-full max-h-80 object-cover hover:opacity-95 transition-opacity" loading="lazy" />
      </button>
    );
  }
  if (count === 2) {
    return (
      <div className="mt-2.5 grid grid-cols-2 gap-1 overflow-hidden rounded-3xl shadow-lg">
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
      <div className="mt-2.5 grid grid-cols-2 gap-1 overflow-hidden rounded-3xl shadow-lg">
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
    <div className="mt-2.5 grid grid-cols-2 gap-1 overflow-hidden rounded-3xl shadow-lg">
      {photos.slice(0, 4).map((url, i) => (
        <button key={i} onClick={() => onPhotoClick?.(i)} className="relative overflow-hidden">
          <img src={url} alt={`Foto ${i + 1}`} className="w-full h-44 object-cover hover:opacity-95 transition-opacity" loading="lazy" />
          {i === 3 && count > 4 && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#000305]/50 text-[#f7f9fa] font-bold text-lg">+{count - 4}</div>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#000305]/90 backdrop-blur-sm" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-[#f7f9fa]/10 text-[#f7f9fa] hover:bg-[#f7f75e] hover:text-[#000305] transition-colors"><X className="h-5 w-5" /></button>
      {photos.length > 1 && (
        <>
          <button onClick={(e) => { e.stopPropagation(); setCurrentIndex((i) => (i > 0 ? i - 1 : photos.length - 1)); }} className="absolute left-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-[#f7f9fa]/10 text-[#f7f9fa] hover:bg-[#f7f75e] hover:text-[#000305] transition-colors">&#8249;</button>
          <button onClick={(e) => { e.stopPropagation(); setCurrentIndex((i) => (i < photos.length - 1 ? i + 1 : 0)); }} className="absolute right-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-[#f7f9fa]/10 text-[#f7f9fa] hover:bg-[#f7f75e] hover:text-[#000305] transition-colors">&#8250;</button>
        </>
      )}
      <img src={photos[currentIndex]} alt={`Foto ${currentIndex + 1}`} className="max-h-[90vh] max-w-[95vw] object-contain" onClick={(e) => e.stopPropagation()} />
      {photos.length > 1 && <div className="absolute bottom-4 text-[#f7f9fa]/70 text-sm">{currentIndex + 1} / {photos.length}</div>}
    </div>
  );
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
  const [photoViewerState, setPhotoViewerState] = useState<{ photos: string[]; index: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!profile) return;
    fetch(`/api/users/${profile.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setPostCount(data.user._count?.posts || 0);
        }
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

    fetch(`/api/users/${profile.id}/posts`)
      .then((r) => r.json())
      .then((data) => {
        if (data.posts) setMyPosts(data.posts);
      })
      .catch(() => {});
  }, [profile]);

  const handleSave = async () => {
    if (!profile) return;
    try {
      const res = await fetch(`/api/users/${profile.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim().slice(0, 50),
          bio: bio.trim().slice(0, 300),
          neighborhood,
        }),
      });
      const data = await res.json();
      if (data.user) {
        updateProfile(data.user);
        setEditing(false);
        toast.success("Perfil atualizado!");
      }
    } catch { toast.error("Erro ao salvar"); }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx 2MB)");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", profile.id);
      const res = await fetch("/api/users/avatar", { method: "POST", body: formData });
      const data = await res.json();
      if (data.avatar_url) {
        updateProfile({ avatar_url: data.avatar_url });
        toast.success("Avatar atualizado!");
      } else {
        toast.error(data.error || "Erro ao enviar avatar");
      }
    } catch {
      toast.error("Erro ao enviar avatar");
    }
    setUploading(false);
  };

  const handleLogout = async () => {
    try {
      const supabase = createClient();
      await supabase.removeAllChannels();
      await supabase.auth.signOut();
      logout();
    } catch {
      toast.error("Erro ao sair");
    }
  };

  if (loading) return <div className="space-y-4">{[1,2].map(i=><div key={i} className="h-24 rounded-xl bg-[#01386A]/[0.04] animate-pulse"/>)}</div>;

  const isPrivate = profile?.is_private || false;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="relative">
                <UserAvatar
                  user={{ id: profile?.id || "", display_name: profile?.display_name || "?", avatar_url: profile?.avatar_url }}
                  className="h-16 w-16"
                />
                <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#f7f9fa] bg-[#01386A] text-[#f7f9fa] shadow-sm transition-colors hover:bg-[#01386A]/90">
                  <Camera className="h-3.5 w-3.5" />
                </button>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleAvatarUpload} className="hidden" />
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

      {/* Meus Posts */}
      {myPosts.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-[#000305]">Meus posts</h3>
          <div className="space-y-3">
            {myPosts.map((post: any) => {
              // Merge legacy image_url into image_urls array
              const allPhotos = [
                ...(post.image_urls || []),
                ...(post.image_url && (!post.image_urls || post.image_urls.length === 0) ? [post.image_url] : []),
              ];
              const hasPhotos = allPhotos.length > 0;
              const hasVideo = !!post.video_url;
              const hasAudio = !!post.audio_url;
              const hasMedia = hasPhotos || hasVideo || hasAudio;
              const hasSharedPost = !!post.shared_post;

              return (
                <div key={post.id} className="rounded-2xl border border-[#01386A]/8 bg-[#f7f9fa] p-3 shadow-sm">
                  {/* Text content */}
                  {post.content && (
                    <p className="text-sm text-[#000305] whitespace-pre-wrap">{post.content}</p>
                  )}

                  {/* Photos */}
                  {hasPhotos && (
                    <PhotoGrid
                      photos={allPhotos}
                      onPhotoClick={(index) => setPhotoViewerState({ photos: allPhotos, index })}
                    />
                  )}

                  {/* Video */}
                  {hasVideo && <VideoPlayer src={post.video_url} />}

                  {/* Audio */}
                  {hasAudio && <AudioPlayer src={post.audio_url} />}

                  {/* Shared / Reposted post */}
                  {hasSharedPost && (
                    <div className="mt-2.5 rounded-2xl border border-[#01386A]/10 bg-white/60 p-2.5">
                      <div className="flex items-center gap-2 mb-1.5">
                        <UserAvatar
                          user={{
                            id: post.shared_post.author?.id || "",
                            display_name: post.shared_post.author?.display_name || "?",
                            avatar_url: post.shared_post.author?.avatar_url,
                          }}
                          className="h-5 w-5"
                        />
                        <span className="text-xs font-medium text-[#000305]">
                          {post.shared_post.author?.display_name || "Usuário"}
                        </span>
                        <span className="text-[10px] text-[#01386A]/40">{timeAgo(post.shared_post.created_at)}</span>
                      </div>
                      {post.shared_post.content && (
                        <p className="text-xs text-[#000305] whitespace-pre-wrap">{post.shared_post.content}</p>
                      )}
                      {post.shared_post.image_urls && post.shared_post.image_urls.length > 0 && (
                        <PhotoGrid
                          photos={post.shared_post.image_urls}
                          onPhotoClick={(index) => setPhotoViewerState({ photos: post.shared_post.image_urls, index })}
                        />
                      )}
                    </div>
                  )}

                  {/* Meta info */}
                  <div className="mt-1.5 flex items-center gap-2 text-[10px] text-[#01386A]/40">
                    <span>{timeAgo(post.created_at)}</span>
                    {post.neighborhood && <span>· {post.neighborhood}</span>}
                    {post.expires_at && hasMedia && (
                      <>
                        <span>·</span>
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          {getExpirationLabel(post.expires_at)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Full-screen photo viewer */}
          {photoViewerState && (
            <PhotoViewer
              photos={photoViewerState.photos}
              initialIndex={photoViewerState.index}
              onClose={() => setPhotoViewerState(null)}
            />
          )}
        </div>
      )}

      <Button variant="destructive" onClick={handleLogout} className="w-full gap-2">
        <LogOut className="h-4 w-4" /> Sair da conta
      </Button>
    </div>
  );
}
