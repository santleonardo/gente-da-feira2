"use client";

import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Shield,
  Lock,
  EyeOff,
  UserCheck,
  UserX,
  Bell,
  Mic,
  Video,
  Users,
  Ban,
  Trash2,
  Loader2,
} from "lucide-react";
import { UserAvatar } from "./UserAvatar";
import { toast } from "sonner";

export function SettingsView({ embedded = false }: { embedded?: boolean }) {
  const { profile, updateProfile, setProfileSubView } = useStore();

  const [isPrivate, setIsPrivate] = useState(profile?.is_private || false);
  const [hideFollowing, setHideFollowing] = useState(profile?.hide_following || false);
  const [hideFollowers, setHideFollowers] = useState(profile?.hide_followers || false);
  const [approveFollowers, setApproveFollowers] = useState(profile?.approve_followers || false);
  const [privacyLoading, setPrivacyLoading] = useState(false);

  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);

  const [showFollowersDialog, setShowFollowersDialog] = useState(false);
  const [followers, setFollowers] = useState<any[]>([]);
  const [followersLoading, setFollowersLoading] = useState(false);
  const [removingFollowerId, setRemovingFollowerId] = useState<string | null>(null);

  const [showBlockedDialog, setShowBlockedDialog] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [blockedLoading, setBlockedLoading] = useState(false);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    if (profile) {
      setIsPrivate(profile.is_private || false);
      setHideFollowing(profile.hide_following || false);
      setHideFollowers(profile.hide_followers || false);
      setApproveFollowers(profile.approve_followers || false);
    }
  }, [profile?.is_private, profile?.hide_following, profile?.hide_followers, profile?.approve_followers]);

  useEffect(() => {
    if (!profile) return;
    const fetchRequests = () => {
      fetch("/api/follows/requests")
        .then((r) => r.json())
        .then((data) => {
          if (data.requests) setPendingRequests(data.requests);
        })
        .catch(() => {});
    };
    fetchRequests();
    const interval = setInterval(fetchRequests, 30000);
    return () => clearInterval(interval);
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((data) => {
        if (data.notifications) setNotifications(data.notifications);
      })
      .catch(() => {});
  }, [profile]);

  const handlePrivacyChange = async (field: "is_private" | "hide_following" | "hide_followers" | "approve_followers", value: boolean) => {
    if (!profile) return;
    setPrivacyLoading(true);
    if (field === "is_private") setIsPrivate(value);
    if (field === "hide_following") setHideFollowing(value);
    if (field === "hide_followers") setHideFollowers(value);
    if (field === "approve_followers") setApproveFollowers(value);

    try {
      const res = await fetch(`/api/users/${profile.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      const data = await res.json();
      if (data.user) {
        updateProfile(data.user);
        const messages: Record<string, { on: string; off: string }> = {
          is_private: { on: "Perfil agora é privado", off: "Perfil agora é público" },
          hide_following: { on: "Lista de seguindo oculta", off: "Lista de seguindo visível" },
          hide_followers: { on: "Lista de seguidores oculta", off: "Lista de seguidores visível" },
          approve_followers: { on: "Aprovação de seguidores ativada", off: "Solicitações pendentes foram aceitas automaticamente" },
        };
        const msg = messages[field];
        toast.success(value ? msg.on : msg.off);
        if (field === "approve_followers" && !value) {
          setPendingRequests([]);
        }
      } else {
        if (field === "is_private") setIsPrivate(!value);
        if (field === "hide_following") setHideFollowing(!value);
        if (field === "hide_followers") setHideFollowers(!value);
        if (field === "approve_followers") setApproveFollowers(!value);
        toast.error("Erro ao atualizar privacidade");
      }
    } catch {
      if (field === "is_private") setIsPrivate(!value);
      if (field === "hide_following") setHideFollowing(!value);
      if (field === "hide_followers") setHideFollowers(!value);
      if (field === "approve_followers") setApproveFollowers(!value);
      toast.error("Erro ao atualizar privacidade");
    }
    setPrivacyLoading(false);
  };

  const handleRequestAction = async (requestId: string, action: "accept" | "reject") => {
    setRequestsLoading(true);
    try {
      const res = await fetch("/api/follows/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action }),
      });
      const data = await res.json();
      if (data.accepted) {
        setPendingRequests((prev) => prev.filter((r: any) => r.id !== requestId));
        toast.success("Solicitação aceita!");
      } else if (data.rejected) {
        setPendingRequests((prev) => prev.filter((r: any) => r.id !== requestId));
        toast.success("Solicitação rejeitada");
      } else {
        toast.error(data.error || "Erro ao processar solicitação");
      }
    } catch {
      toast.error("Erro ao processar solicitação");
    }
    setRequestsLoading(false);
  };

  const openFollowersDialog = async () => {
    if (!profile) return;
    setShowFollowersDialog(true);
    setFollowersLoading(true);
    try {
      const res = await fetch(`/api/follows?userId=${profile.id}`);
      const data = await res.json();
      if (data.followers) {
        setFollowers(data.followers.map((f: any) => f.follower).filter(Boolean));
      }
    } catch {
      setFollowers([]);
    }
    setFollowersLoading(false);
  };

  const handleRemoveFollower = async (followerId: string) => {
    setRemovingFollowerId(followerId);
    try {
      const res = await fetch(`/api/follows?followerId=${followerId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.removed) {
        setFollowers((prev) => prev.filter((f: any) => f.id !== followerId));
        toast.success("Seguidor removido");
      } else {
        toast.error(data.error || "Erro ao remover seguidor");
      }
    } catch {
      toast.error("Erro ao remover seguidor");
    }
    setRemovingFollowerId(null);
  };

  const openBlockedDialog = async () => {
    if (!profile) return;
    setShowBlockedDialog(true);
    setBlockedLoading(true);
    try {
      const res = await fetch("/api/blocks");
      const data = await res.json();
      if (data.blocks) {
        setBlockedUsers(data.blocks.map((b: any) => ({ ...b.blocked, blockId: b.id })).filter((u: any) => u.id));
      }
    } catch {
      setBlockedUsers([]);
    }
    setBlockedLoading(false);
  };

  const handleUnblock = async (targetId: string) => {
    setUnblockingId(targetId);
    try {
      const res = await fetch("/api/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: targetId }),
      });
      const data = await res.json();
      if (data.blocked === false) {
        setBlockedUsers((prev) => prev.filter((u: any) => u.id !== targetId));
        toast.success("Usuário desbloqueado");
      } else {
        toast.error(data.error || "Erro ao desbloquear");
      }
    } catch {
      toast.error("Erro ao desbloquear");
    }
    setUnblockingId(null);
  };

  const requestPermission = async (type: "notifications" | "microphone" | "camera") => {
    try {
      if (type === "notifications") {
        const result = await Notification.requestPermission();
        if (result === "granted") toast.success("Notificações ativadas!");
        else toast.error("Permissão de notificação negada");
      } else if (type === "microphone") {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
        toast.success("Microfone permitido!");
      } else if (type === "camera") {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach((t) => t.stop());
        toast.success("Câmera permitida!");
      }
    } catch {
      toast.error(`Permissão de ${type === "microphone" ? "microfone" : type === "camera" ? "câmera" : "notificação"} negada`);
    }
  };

  if (!profile) return null;

  return (
    <div className={embedded ? "space-y-4" : "space-y-6"}>
      {!embedded && (
        <div className="flex items-center gap-3">
          <button
            onClick={() => setProfileSubView("profile")}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-bold">Configurações</h2>
        </div>
      )}

      {/* PRIVACIDADE */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-4 w-4 text-[#0A4D5C]" />
            <h3 className="text-sm font-semibold text-[#000305]">Privacidade</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-[#0A4D5C]/40" />
                  <p className="text-sm font-medium text-[#000305]">Perfil privado</p>
                </div>
                <p className="text-xs text-[#0A4D5C]/40 mt-0.5">Quem não te segue não verá seus posts e informações</p>
              </div>
              <Switch checked={isPrivate} onCheckedChange={(v) => handlePrivacyChange("is_private", v)} disabled={privacyLoading} />
            </div>
            <div className="border-t border-[#0A4D5C]/8" />
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5 text-[#0A4D5C]/40" />
                  <p className="text-sm font-medium text-[#000305]">Aprovar seguidores</p>
                </div>
                <p className="text-xs text-[#0A4D5C]/40 mt-0.5">Quem quiser te seguir precisará da sua aprovação</p>
              </div>
              <Switch checked={approveFollowers} onCheckedChange={(v) => handlePrivacyChange("approve_followers", v)} disabled={privacyLoading} />
            </div>
            <div className="border-t border-[#0A4D5C]/8" />
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <EyeOff className="h-3.5 w-3.5 text-[#0A4D5C]/40" />
                  <p className="text-sm font-medium text-[#000305]">Esconder seguindo</p>
                </div>
                <p className="text-xs text-[#0A4D5C]/40 mt-0.5">Ninguém verá quem você está seguindo, inclusive seus seguidores</p>
              </div>
              <Switch checked={hideFollowing} onCheckedChange={(v) => handlePrivacyChange("hide_following", v)} disabled={privacyLoading} />
            </div>
            <div className="border-t border-[#0A4D5C]/8" />
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <EyeOff className="h-3.5 w-3.5 text-[#0A4D5C]/40" />
                  <p className="text-sm font-medium text-[#000305]">Esconder seguidores</p>
                </div>
                <p className="text-xs text-[#0A4D5C]/40 mt-0.5">Ninguém verá seus seguidores, inclusive quem já te segue</p>
              </div>
              <Switch checked={hideFollowers} onCheckedChange={(v) => handlePrivacyChange("hide_followers", v)} disabled={privacyLoading} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SOLICITAÇÕES PENDENTES */}
      {approveFollowers && pendingRequests.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-3">
              <UserCheck className="h-4 w-4 text-[#0A4D5C]" />
              <h3 className="text-sm font-semibold text-[#000305]">Solicitações para seguir</h3>
              <Badge variant="secondary" className="text-[10px] px-1.5 bg-[#f7f75e]/30 text-[#0A4D5C] border-0">{pendingRequests.length}</Badge>
            </div>
            <div className="space-y-2">
              {pendingRequests.map((req: any) => (
                <div key={req.id} className="flex items-center gap-3 rounded-lg border border-[#0A4D5C]/8 p-2.5">
                  <UserAvatar
                    user={{ id: req.follower?.id || req.follower_id, display_name: req.follower?.display_name || "?", avatar_url: req.follower?.avatar_url }}
                    className="h-10 w-10"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-[#000305]">{req.follower?.display_name}</p>
                    <p className="text-[11px] text-[#0A4D5C]/40 truncate">@{req.follower?.username}</p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button size="sm" variant="default" onClick={() => handleRequestAction(req.id, "accept")} disabled={requestsLoading} className="h-7 px-2.5 gap-1 text-[11px] bg-[#0A4D5C] hover:bg-[#0A4D5C]/90">
                      <UserCheck className="h-3 w-3" /> Aceitar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleRequestAction(req.id, "reject")} disabled={requestsLoading} className="h-7 px-2.5 gap-1 text-[11px] border-[#0A4D5C]/10">
                      <UserX className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* GERENCIAR */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-[#0A4D5C]" />
            <h3 className="text-sm font-semibold text-[#000305]">Gerenciar</h3>
          </div>
          <div className="space-y-2">
            <Button variant="outline" size="sm" onClick={openFollowersDialog} className="w-full justify-start gap-2 border-[#0A4D5C]/10 text-[#0A4D5C]">
              <UserX className="h-4 w-4" /> Remover seguidores
            </Button>
            <Button variant="outline" size="sm" onClick={openBlockedDialog} className="w-full justify-start gap-2 border-[#0A4D5C]/10 text-[#0A4D5C]">
              <Ban className="h-4 w-4" /> Usuários bloqueados
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* NOTIFICAÇÕES RECENTES */}
      {notifications.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-3">
              <Bell className="h-4 w-4 text-[#0A4D5C]" />
              <h3 className="text-sm font-semibold text-[#000305]">Notificações recentes</h3>
            </div>
            <div className="space-y-2">
              {notifications.slice(0, 5).map((notif: any) => (
                <div key={notif.id} className={`flex items-center gap-3 rounded-lg border p-2.5 ${!notif.read ? "bg-[#f7f75e]/10 border-[#f7f75e]/30" : "border-[#0A4D5C]/8"}`}>
                  <UserAvatar
                    user={{ id: notif.from_user?.id || "", display_name: notif.from_user?.display_name || "?", avatar_url: notif.from_user?.avatar_url }}
                    className="h-8 w-8"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-medium text-[#000305]">{notif.from_user?.display_name}</span>{" "}
                      <span className="text-[#0A4D5C]/40">{notif.content}</span>
                    </p>
                    <p className="text-[10px] text-[#0A4D5C]/40">
                      {new Date(notif.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                    </p>
                  </div>
                  {!notif.read && <div className="h-2 w-2 rounded-full bg-[#0A4D5C] shrink-0" />}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* PERMISSÕES DO DISPOSITIVO */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="h-4 w-4 text-[#0A4D5C]" />
            <h3 className="text-sm font-semibold text-[#000305]">Permissões do dispositivo</h3>
          </div>
          <div className="space-y-2">
            <Button variant="outline" size="sm" onClick={() => requestPermission("notifications")} className="w-full justify-start gap-2 border-[#0A4D5C]/10 text-[#0A4D5C]">
              <Bell className="h-4 w-4" /> Notificações
            </Button>
            <Button variant="outline" size="sm" onClick={() => requestPermission("microphone")} className="w-full justify-start gap-2 border-[#0A4D5C]/10 text-[#0A4D5C]">
              <Mic className="h-4 w-4" /> Microfone
            </Button>
            <Button variant="outline" size="sm" onClick={() => requestPermission("camera")} className="w-full justify-start gap-2 border-[#0A4D5C]/10 text-[#0A4D5C]">
              <Video className="h-4 w-4" /> Câmera
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* DIALOG: REMOVER SEGUIDORES */}
      <Dialog open={showFollowersDialog} onOpenChange={setShowFollowersDialog}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserX className="h-4 w-4" /> Remover seguidores
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto custom-scrollbar">
            {followersLoading ? (
              <div className="space-y-2 py-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-2.5 animate-pulse">
                    <div className="h-8 w-8 rounded-full bg-[#0A4D5C]/10" />
                    <div className="h-3 w-24 rounded bg-[#0A4D5C]/10" />
                  </div>
                ))}
              </div>
            ) : followers.length === 0 ? (
              <div className="py-8 text-center">
                <Users className="h-8 w-8 text-[#0A4D5C]/20 mx-auto mb-2" />
                <p className="text-xs text-[#0A4D5C]/40">Nenhum seguidor</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {followers.map((u: any) => (
                  <div key={u.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
                    <UserAvatar user={{ id: u.id, display_name: u.display_name, avatar_url: u.avatar_url }} className="h-8 w-8" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate text-[#000305]">{u.display_name}</div>
                      <div className="text-[11px] text-[#0A4D5C]/40 truncate">@{u.username}</div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleRemoveFollower(u.id)} disabled={removingFollowerId === u.id} className="h-7 px-2 text-[#0A4D5C]/40 hover:text-red-500">
                      {removingFollowerId === u.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* DIALOG: USUÁRIOS BLOQUEADOS */}
      <Dialog open={showBlockedDialog} onOpenChange={setShowBlockedDialog}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="h-4 w-4" /> Usuários bloqueados
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto custom-scrollbar">
            {blockedLoading ? (
              <div className="space-y-2 py-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-2.5 animate-pulse">
                    <div className="h-8 w-8 rounded-full bg-[#0A4D5C]/10" />
                    <div className="h-3 w-24 rounded bg-[#0A4D5C]/10" />
                  </div>
                ))}
              </div>
            ) : blockedUsers.length === 0 ? (
              <div className="py-8 text-center">
                <Ban className="h-8 w-8 text-[#0A4D5C]/20 mx-auto mb-2" />
                <p className="text-xs text-[#0A4D5C]/40">Nenhum usuário bloqueado</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {blockedUsers.map((u: any) => (
                  <div key={u.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
                    <UserAvatar user={{ id: u.id, display_name: u.display_name, avatar_url: u.avatar_url }} className="h-8 w-8" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate text-[#000305]">{u.display_name}</div>
                      <div className="text-[11px] text-[#0A4D5C]/40 truncate">@{u.username}</div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleUnblock(u.id)} disabled={unblockingId === u.id} className="h-7 px-2.5 text-[11px] border-[#0A4D5C]/10">
                      {unblockingId === u.id ? <Loader2 className="h-3 w-3.5 animate-spin" /> : "Desbloquear"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
