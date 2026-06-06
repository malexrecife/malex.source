// Malex blog — Supabase CRUD para posts, imagens e categorias.
import { supabase } from "./supabase.js";

export const BLOG_CATEGORIES = [
  "Guarda-Volumes & Lockers",
  "Guias de Aeroportos",
  "Roteiros & Viagem",
  "Eventos & Feiras",
  "Viagem de Negócios",
  "Sobre a Malex",
];

export function calcReadTime(body) {
  const words = (body || "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

export function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim().replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/* ---------- PÚBLICO (site) ---------- */

export async function listPublishedPosts(category = null) {
  let q = supabase
    .from("blog_posts")
    .select("id,slug,title,seo_title,summary,category,tags,cover_image_url,cover_image_alt,published_at,read_time_min,author")
    .eq("status", "published")
    .order("published_at", { ascending: false });
  if (category) q = q.eq("category", category);
  const { data, error } = await q;
  return { data: data || [], error };
}

export async function getPublishedPost(slug) {
  return supabase
    .from("blog_posts")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .single();
}

export async function getRelatedPosts(category, excludeSlug, limit = 3) {
  const { data } = await supabase
    .from("blog_posts")
    .select("id,slug,title,summary,category,cover_image_url,cover_image_alt,published_at,read_time_min")
    .eq("status", "published")
    .eq("category", category)
    .neq("slug", excludeSlug)
    .order("published_at", { ascending: false })
    .limit(limit);
  return data || [];
}

/* ---------- ADMIN (CMS) ---------- */

export async function adminListPosts() {
  const { data, error } = await supabase
    .from("blog_posts")
    .select("id,slug,title,category,status,published_at,updated_at,cover_image_url,read_time_min")
    .order("updated_at", { ascending: false });
  return { data: data || [], error };
}

export async function adminGetPost(id) {
  return supabase.from("blog_posts").select("*").eq("id", id).single();
}

export async function adminSavePost(post) {
  const payload = { ...post };
  delete payload.id;
  payload.read_time_min = calcReadTime(post.body);
  payload.updated_at = new Date().toISOString();
  payload.author = "Malex";
  if (payload.status === "published" && !post.published_at) {
    payload.published_at = new Date().toISOString();
  }
  if (post.id) {
    return supabase.from("blog_posts").update(payload).eq("id", post.id).select().single();
  }
  return supabase.from("blog_posts").insert(payload).select().single();
}

export async function adminDeletePost(id) {
  return supabase.from("blog_posts").delete().eq("id", id);
}

export async function uploadCoverImage(file, slug) {
  const ext = file.name.split(".").pop().toLowerCase();
  const path = `covers/${slug || "post"}-${Date.now()}.${ext}`;
  const { data, error } = await supabase.storage
    .from("blog-images")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) return { url: null, error };
  const { data: pub } = supabase.storage.from("blog-images").getPublicUrl(data.path);
  return { url: pub.publicUrl, error: null };
}
