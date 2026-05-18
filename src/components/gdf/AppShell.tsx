"use client";

import { useEffect, useState, useCallback } from "react";
import { useStore } from "@/lib/store";
import { AuthForm } from "@/components/gdf/AuthForm";
import { FeedView } from "@/components/gdf/FeedView";
import { RoomsView } from "@/components/gdf/RoomsView";
import { DMsView } from "@/components/gdf/DMsView";
import { ProfileView } from "@/components/gdf/ProfileView";
import { SettingsView } from "@/components/gdf/SettingsView";
import { DiscoverView } from "@/components/gdf/DiscoverView";
import { UserProfileDialog } from "@/components/gdf/UserProfileDialog";
import { PostDetailDialog } from "@/components/gdf/PostDetailDialog";
import { createClient } from "@/lib/supabase/client";
import { Home, Users, MessageSquare, Compass, User, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { id: "feed" as const, icon: Home },
  { id: "rooms" as const, icon: Users },
  { id: "dms" as const, icon: MessageSquare },
  { id: "discover" as const, icon: Compass },
  { id: "profile" as const, icon: User },
];

export function AppShell() {
  const { profile, tab, setTab, profileSubView, selectedRoom, selectedDM, setSelectedRoom, setSelectedDM, setProfile, logout } = useStore();
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [profileDialogUserId, setProfileDialogUserId] = useState<string | null>(null);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [postDetailPost, setPostDetailPost] = useState<any>(null);
  const [postDetailOpen, setPostDetailOpen] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      const userId = e.detail?.userId;
      if (userId) {
        setProfileDialogUserId(userId);
        setProfileDialogOpen(true);
      }
    };
    window.addEventListener("openUserProfile", handler);
    return () => window.removeEventListener("openUserProfile", handler);
  }, []);

  useEffect(() => {
    const handler = (e: any) => {
      const post = e.detail?.post;
      if (post) {
        setPostDetailPost(post);
        setPostDetailOpen(true);
      }
    };
    window.addEventListener("openPostDetail", handler);
    return () => window.removeEventListener("openPostDetail", handler);
  }, []);

  const openUserProfile = useCallback((userId: string) => {
    setProfileDialogUserId(userId);
    setProfileDialogOpen(true);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const initAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).single();
        if (prof) setProfile(prof);
      }
      setCheckedAuth(true);
    };
    initAuth();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === "SIGNED_OUT") {
        try { await supabase.removeAllChannels(); } catch { /* silent */ }
        logout();
      }
    });
    return () => subscription.unsubscribe();
  }, [setProfile, logout]);

  useEffect(() => {
    if (!profile) return;
    const fetchUnread = () => {
      fetch("/api/notifications")
        .then((r) => r.json())
        .then((data) => {
          if (typeof data.unreadCount === "number") {
            useStore.getState().setUnreadNotifications(data.unreadCount);
          }
        })
        .catch(() => {});
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 60000);
    return () => clearInterval(interval);
  }, [profile]);

  if (!checkedAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f9fa]">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0A4D5C] animate-pulse">
            <span className="text-xl font-bold text-[#f7f9fa]">G</span>
          </div>
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-[#0A4D5C]/40" />
            <p className="text-sm text-[#0A4D5C]/40">Carregando...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) return <AuthForm />;

  const inChat = (tab === "rooms" && selectedRoom) || (tab === "dms" && selectedDM);

  const renderProfileContent = () => {
    if (profileSubView === "settings") return <SettingsView />;
    return <ProfileView />;
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#f7f9fa]">
      <header className="sticky top-0 z-40 hidden md:flex items-center justify-between border-b border-[#0A4D5C]/10 px-6 py-2.5 bg-[#f7f9fa]/90 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0A4D5C] shadow-sm">
            <span className="text-sm font-bold text-[#f7f9fa]">G</span>
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight tracking-tight text-[#000305]">GDF Chat</h1>
            <p className="text-[10px] text-[#0A4D5C]/40 leading-none">Feira de Santana</p>
          </div>
        </div>
        <nav className="flex items-center gap-1 bg-[#0A4D5C]/[0.04] rounded-full p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                if (t.id === "rooms") setSelectedRoom(null);
                if (t.id === "dms") setSelectedDM(null);
                if (t.id === "profile") useStore.getState().setProfileSubView("profile");
                setTab(t.id);
              }}
              className={cn(
                "flex items-center justify-center rounded-full p-2.5 transition-all duration-200",
                tab === t.id ? "bg-[#0A4D5C] text-[#f7f9fa] shadow-sm" : "text-[#0A4D5C]/50 hover:text-[#000305]"
              )}
              title={t.id.charAt(0).toUpperCase() + t.id.slice(1)}
            >
              <t.icon className="h-5 w-5" />
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-full bg-[#2EC4B6]/30 flex items-center justify-center">
            <span className="text-[10px] font-bold text-[#0A4D5C]">{profile.display_name?.charAt(0)?.toUpperCase()}</span>
          </div>
          <span className="text-sm font-medium text-[#000305]">{profile.display_name}</span>
        </div>
      </header>

      <main className="flex-1 pb-20 md:pb-6">
        <div className={cn("mx-auto px-4 py-4 md:py-6", inChat ? "max-w-2xl" : "max-w-lg")}>
          {tab === "feed" && <FeedView openUserProfile={openUserProfile} />}
          {tab === "rooms" && <RoomsView openUserProfile={openUserProfile} />}
          {tab === "dms" && <DMsView openUserProfile={openUserProfile} />}
          {tab === "discover" && <DiscoverView openUserProfile={openUserProfile} />}
          {tab === "profile" && renderProfileContent()}
        </div>
      </main>

      <UserProfileDialog userId={profileDialogUserId} open={profileDialogOpen} onOpenChange={setProfileDialogOpen} />

      <PostDetailDialog post={postDetailPost} open={postDetailOpen} onOpenChange={setPostDetailOpen} />

      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden">
        <div className="mx-3 mb-3 flex items-center justify-around rounded-2xl border border-[#0A4D5C]/10 bg-[#f7f9fa]/95 backdrop-blur-xl shadow-lg px-2 py-1.5">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                if (t.id === "rooms") setSelectedRoom(null);
                if (t.id === "dms") setSelectedDM(null);
                if (t.id === "profile") useStore.getState().setProfileSubView("profile");
                setTab(t.id);
              }}
              className={cn(
                "flex items-center justify-center rounded-xl p-2.5 transition-all duration-200",
                tab === t.id ? "bg-[#0A4D5C] text-[#f7f9fa]" : "text-[#0A4D5C]/40 active:scale-95"
              )}
            >
              <t.icon className={cn("h-5 w-5", tab === t.id && "stroke-[2.5px]")} />
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
