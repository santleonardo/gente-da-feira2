"use client";

import { useState, useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, LogOut, Edit3, Camera, Settings, Lock, Bell } from "lucide-react";
import { getInitials, getAvatarColor, timeAgo, BAIRROS } from "@/lib/constants";
import { renderContentWithLinks } from "@/lib/link-utils";
import { UserAvatar } from "./UserAvatar";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

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
          <div className="space-y-2">
            {myPosts.map((post: any) => (
              <div key={post.id} className="rounded-lg border border-[#01386A]/8 bg-[#f7f9fa] p-3 cursor-pointer hover:bg-[#f7f75e]/10 transition-colors" onClick={() => window.dispatchEvent(new CustomEvent("openPostDetail", { detail: { post } }))}>
                <p className="text-sm text-[#000305]">{renderContentWithLinks(post.content)}</p>
                <div className="mt-1 flex items-center gap-2 text-[10px] text-[#01386A]/40">
                  <span>{timeAgo(post.created_at)}</span>
                  {post.neighborhood && <span>· {post.neighborhood}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Button variant="destructive" onClick={handleLogout} className="w-full gap-2">
        <LogOut className="h-4 w-4" /> Sair da conta
      </Button>
    </div>
  );
}
