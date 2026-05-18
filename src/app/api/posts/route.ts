// ============================================================
// API de Posts - com suporte a fotos, vídeos, áudios, visibilidade e compartilhamento
// - Posts com foto: máx 5 fotos, expiram em 12h
// - Posts com vídeo: máx 5 vídeos/12h, 30s max, expiram em 12h
// - Posts com áudio: expiram em 12h, máx 60s
// - Visibilidade: "public" (todos veem) ou "followers" (só seguidores mútuos)
// - Compartilhamento: shared_post_id referencia um post original
// - Máx 5 posts com mídia expirável ativos por usuário
// - Limpeza automática de posts expirados
// - Suporte a post_style (fonte, bold, itálico, alinhamento, cor do post-it)
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

const MAX_PHOTOS_PER_POST = 5;
const MAX_ACTIVE_MEDIA_POSTS = 5;
const MEDIA_EXPIRATION_HOURS = 12;
const MAX_VIDEO_POSTS_PER_12H = 5;
const MAX_AUDIO_DURATION_SECONDS = 60;
const MAX_VIDEO_DURATION_SECONDS = 30;

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);
    const neighborhood = searchParams.get("neighborhood");
    const limit = parseInt(searchParams.get("limit") || "20");
    const authorId = searchParams.get("authorId");
    const { data: { user: authUser } } = await supabase.auth.getUser();

    let query = supabase
      .from("posts")
      .select(`
        *,
        author:profiles(id, display_name, username, avatar_url, neighborhood),
        reactions(user_id, type),
        comments(count),
        shared_post:posts!shared_post_id(id, content, image_urls, video_url, audio_url, created_at, author:profiles(id, display_name, username, avatar_url, neighborhood))
      `)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (authorId) query = query.eq("author_id", authorId);
    if (neighborhood && neighborhood !== "all") {
      query = query.or(`neighborhood.eq.${neighborhood},neighborhood.is.null`);
    }

    const { data: posts, error } = await query;
    if (error) throw error;

    const now = new Date().toISOString();

    // Get viewer's follows if logged in (for visibility filtering)
    let viewerFollowingIds = new Set<string>();
    let viewerFollowerIds = new Set<string>();
    if (authUser && !authorId) {
      const { data: following } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", authUser.id)
        .eq("status", "accepted");
      if (following) viewerFollowingIds = new Set(following.map((f: any) => f.following_id));

      const { data: followers } = await supabase
        .from("follows")
        .select("follower_id")
        .eq("following_id", authUser.id)
        .eq("status", "accepted");
      if (followers) viewerFollowerIds = new Set(followers.map((f: any) => f.follower_id));
    }

    const filteredPosts = (posts || []).map((p: any) => ({
      ...p,
      comment_count: p.comments?.[0]?.count || 0,
      comments: undefined,
      shared_post: p.shared_post && !Array.isArray(p.shared_post) ? p.shared_post : (Array.isArray(p.shared_post) ? p.shared_post[0] : null),
    })).filter((p: any) => {
      // Filter expired posts
      if (p.expires_at && p.expires_at < now) return false;

      // Filter by visibility
      if (p.visibility === "followers" && authUser) {
        if (p.author_id === authUser.id) return true;
        const viewerFollowsAuthor = viewerFollowingIds.has(p.author_id);
        const authorFollowsViewer = viewerFollowerIds.has(p.author_id);
        return viewerFollowsAuthor && authorFollowsViewer;
      } else if (p.visibility === "followers" && !authUser) {
        return false;
      }

      return true;
    });

    // Limpar posts expirados em background
    cleanupExpiredPosts().catch(() => {});

    return NextResponse.json({ posts: filteredPosts });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function cleanupExpiredPosts() {
  try {
    const admin = createAdminClient();
    const now = new Date().toISOString();

    const { data: expiredPosts } = await admin
      .from("posts")
      .select("id, image_urls, video_url, audio_url")
      .lt("expires_at", now)
      .eq("is_deleted", false);

    if (!expiredPosts || expiredPosts.length === 0) return;

    const expiredIds = expiredPosts.map((p: any) => p.id);
    await admin.from("posts").update({ is_deleted: true }).in("id", expiredIds);

    for (const post of expiredPosts) {
      if (post.image_urls && post.image_urls.length > 0) {
        const paths = extractStoragePaths(post.image_urls, "post-photos");
        if (paths.length > 0) await admin.storage.from("post-photos").remove(paths).catch(() => {});
      }
      if (post.video_url) {
        const paths = extractStoragePaths([post.video_url], "post-videos");
        if (paths.length > 0) await admin.storage.from("post-videos").remove(paths).catch(() => {});
      }
      if (post.audio_url) {
        const paths = extractStoragePaths([post.audio_url], "post-audios");
        if (paths.length > 0) await admin.storage.from("post-audios").remove(paths).catch(() => {});
      }
    }
  } catch { /* Silent */ }
}

function extractStoragePaths(urls: string[], bucket: string): string[] {
  return urls
    .map((url: string) => {
      try {
        const urlObj = new URL(url);
        const parts = urlObj.pathname.split("/");
        const bucketIndex = parts.indexOf(bucket);
        if (bucketIndex >= 0) return parts.slice(bucketIndex + 1).join("/");
        return null;
      } catch { return null; }
    })
    .filter(Boolean) as string[];
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { content, neighborhood, imageUrls, videoUrl, audioUrl, audioDuration, videoDuration, visibility, sharedPostId, postStyle } = await req.json();

    if (!content || !content.trim()) {
      return NextResponse.json({ error: "Conteúdo é obrigatório" }, { status: 400 });
    }
    if (content.trim().length > 500) {
      return NextResponse.json({ error: "Post muito longo (máx 500 chars)" }, { status: 400 });
    }

    // Validate postStyle if provided
    const validFonts = ["Nunito", "Quicksand", "Poppins", "Inter", "Comfortaa", "Montserrat", "Lato", "Raleway", "DM Sans", "Work Sans"];
    const validAlignments = ["left", "center", "right", "justify"];
    let validatedStyle: any = null;
    if (postStyle && typeof postStyle === "object") {
      validatedStyle = {
        font: validFonts.includes(postStyle.font) ? postStyle.font : null,
        bold: typeof postStyle.bold === "boolean" ? postStyle.bold : false,
        italic: typeof postStyle.italic === "boolean" ? postStyle.italic : false,
        alignment: validAlignments.includes(postStyle.alignment) ? postStyle.alignment : "left",
        postItColor: typeof postStyle.postItColor === "number" && postStyle.postItColor >= 0 && postStyle.postItColor <= 11 ? postStyle.postItColor : null,
      };
      // Remove null font to keep it clean
      if (!validatedStyle.font) delete validatedStyle.font;
      if (validatedStyle.postItColor === null) delete validatedStyle.postItColor;
    }

    // Validate visibility
    const validVisibility = visibility === "followers" ? "followers" : "public";

    let expiresAt: string | null = null;
    const hasPhotos = imageUrls && imageUrls.length > 0;
    const hasVideo = !!videoUrl;
    const hasAudio = !!audioUrl;
    const hasMedia = hasPhotos || hasVideo || hasAudio;

    if (hasPhotos && imageUrls.length > MAX_PHOTOS_PER_POST) {
      return NextResponse.json({ error: `Máximo ${MAX_PHOTOS_PER_POST} fotos por post` }, { status: 400 });
    }

    // Video duration validation
    if (hasVideo && videoDuration && videoDuration > MAX_VIDEO_DURATION_SECONDS) {
      return NextResponse.json({ error: `Vídeo muito longo (máx ${MAX_VIDEO_DURATION_SECONDS}s)` }, { status: 400 });
    }

    // Audio duration validation
    if (hasAudio && audioDuration && audioDuration > MAX_AUDIO_DURATION_SECONDS) {
      return NextResponse.json({ error: `Áudio muito longo (máx ${MAX_AUDIO_DURATION_SECONDS}s)` }, { status: 400 });
    }

    // Check video posts limit per 12h
    if (hasVideo) {
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
      const { data: recentVideoPosts } = await supabase
        .from("posts")
        .select("id")
        .eq("author_id", user.id)
        .eq("is_deleted", false)
        .not("video_url", "is", null)
        .gte("created_at", twelveHoursAgo);

      if (recentVideoPosts && recentVideoPosts.length >= MAX_VIDEO_POSTS_PER_12H) {
        return NextResponse.json({
          error: `Você já postou ${MAX_VIDEO_POSTS_PER_12H} vídeos nas últimas 12h. Aguarde para postar mais.`
        }, { status: 400 });
      }
    }

    // Check active media posts limit
    if (hasMedia) {
      const now = new Date().toISOString();
      const { data: activeMediaPosts } = await supabase
        .from("posts")
        .select("id")
        .eq("author_id", user.id)
        .eq("is_deleted", false)
        .gt("expires_at", now);

      if (activeMediaPosts && activeMediaPosts.length >= MAX_ACTIVE_MEDIA_POSTS) {
        const { data: nextExpiring } = await supabase
          .from("posts")
          .select("expires_at")
          .eq("author_id", user.id)
          .eq("is_deleted", false)
          .gt("expires_at", now)
          .order("expires_at", { ascending: true })
          .limit(1);

        const expiresIn = nextExpiring?.[0]?.expires_at ? getTimeUntil(nextExpiring[0].expires_at) : "em breve";
        return NextResponse.json({
          error: `Você já tem ${MAX_ACTIVE_MEDIA_POSTS} posts com mídia ativos. Próximo expira ${expiresIn}.`
        }, { status: 400 });
      }

      const expires = new Date();
      expires.setHours(expires.getHours() + MEDIA_EXPIRATION_HOURS);
      expiresAt = expires.toISOString();
    }

    // Validate sharedPostId if provided
    let validSharedPostId: string | null = null;
    if (sharedPostId) {
      const { data: sharedPost } = await supabase
        .from("posts")
        .select("id, is_deleted")
        .eq("id", sharedPostId)
        .eq("is_deleted", false)
        .single();
      if (sharedPost) {
        validSharedPostId = sharedPostId;
      }
    }

    const insertData: any = {
      content: content.trim(),
      neighborhood: neighborhood || null,
      author_id: user.id,
      image_urls: hasPhotos ? imageUrls : [],
      video_url: hasVideo ? videoUrl : null,
      audio_url: hasAudio ? audioUrl : null,
      audio_duration: hasAudio && audioDuration ? audioDuration : null,
      video_duration: hasVideo && videoDuration ? videoDuration : null,
      visibility: validVisibility,
      expires_at: expiresAt,
      shared_post_id: validSharedPostId,
      post_style: validatedStyle,
    };

    const { data: post, error } = await supabase
      .from("posts")
      .insert(insertData)
      .select(`
        *,
        author:profiles(id, display_name, username, avatar_url, neighborhood),
        reactions(user_id, type),
        shared_post:posts!shared_post_id(id, content, image_urls, video_url, audio_url, created_at, author:profiles(id, display_name, username, avatar_url, neighborhood))
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ post: { ...post, comment_count: 0, shared_post: post.shared_post && !Array.isArray(post.shared_post) ? post.shared_post : (Array.isArray(post.shared_post) ? post.shared_post[0] : null) } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function getTimeUntil(expiresAt: string): string {
  const now = Date.now();
  const expires = new Date(expiresAt).getTime();
  const diff = expires - now;
  if (diff <= 0) return "agora";
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hours > 0) return `em ${hours}h${mins > 0 ? ` ${mins}min` : ""}`;
  return `em ${mins}min`;
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const postId = searchParams.get("id");
    if (!postId) return NextResponse.json({ error: "ID necessário" }, { status: 400 });

    const admin = createAdminClient();
    const { data: post } = await admin
      .from("posts")
      .select("image_urls, video_url, audio_url")
      .eq("id", postId)
      .eq("author_id", user.id)
      .single();

    const { error } = await admin
      .from("posts")
      .update({ is_deleted: true })
      .eq("id", postId)
      .eq("author_id", user.id);

    if (error) throw error;

    // Clean up media files
    if (post?.image_urls && post.image_urls.length > 0) {
      const paths = extractStoragePaths(post.image_urls, "post-photos");
      if (paths.length > 0) await admin.storage.from("post-photos").remove(paths).catch(() => {});
    }
    if (post?.video_url) {
      const paths = extractStoragePaths([post.video_url], "post-videos");
      if (paths.length > 0) await admin.storage.from("post-videos").remove(paths).catch(() => {});
    }
    if (post?.audio_url) {
      const paths = extractStoragePaths([post.audio_url], "post-audios");
      if (paths.length > 0) await admin.storage.from("post-audios").remove(paths).catch(() => {});
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
