// Malex Blog — artigo individual com Markdown, SEO, compartilhamento e posts relacionados.
import React, { useState, useEffect, useCallback } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MalexLogo, Icon, MALEX_CONTACT } from "../components/Primitives.jsx";
import { getPublishedPost, getRelatedPosts } from "../lib/blog.js";

const SITE_URL = "https://malex.com.br";

function fmtDate(v) {
  if (!v) return "";
  const d = new Date(v);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function buildJsonLd(post, url) {
  const base = {
    "@context": "https://schema.org",
    name: post.seo_title || post.title,
    url,
    description: post.meta_description || post.summary || "",
    image: post.cover_image_url || undefined,
    author: { "@type": "Organization", name: "Malex" },
    publisher: {
      "@type": "Organization", name: "Malex",
      logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.svg` },
    },
    datePublished: post.published_at || undefined,
    dateModified: post.updated_at || post.published_at || undefined,
  };
  if (post.schema_type === "FAQ") {
    return JSON.stringify({
      "@type": "FAQPage",
      ...base,
      mainEntity: extractFaqItems(post.body),
    });
  }
  if (post.schema_type === "LocalBusiness") {
    return JSON.stringify({ "@type": "LocalBusiness", ...base });
  }
  return JSON.stringify({ "@type": "Article", ...base });
}

function extractFaqItems(body) {
  const items = [];
  const re = /^##\s+(.+)\n([\s\S]*?)(?=^##\s|\Z)/gm;
  let m;
  while ((m = re.exec(body || "")) !== null) {
    items.push({
      "@type": "Question",
      name: m[1].trim(),
      acceptedAnswer: { "@type": "Answer", text: m[2].trim() },
    });
  }
  return items;
}

function BlogNav() {
  const [drawer, setDrawer] = useState(false);
  return (
    <header className="nav">
      <div className="nav-inner">
        <Link to="/" className="nav-logo" aria-label="Malex — início">
          <MalexLogo height={24} />
        </Link>
        <nav className="nav-links" aria-label="Principal">
          <a href="/#como">Como funciona</a>
          <a href="/#precos">Preços</a>
          <a href="/#unidades">Unidades</a>
          <Link to="/blog" className="blog-nav-active">Blog</Link>
          <a href="/#contato">Contato</a>
        </nav>
        <div className="nav-cta">
          <a className="btn btn-primary btn-cta btn-sm" href="/">Reservar locker</a>
        </div>
        <button className="nav-burger" aria-label="Abrir menu" aria-expanded={drawer} onClick={() => setDrawer(true)}>
          <Icon name="menu" size={26} color="var(--cream-500)" />
        </button>
      </div>
      <div className={`drawer-scrim${drawer ? " open" : ""}`} onClick={() => setDrawer(false)} />
      <aside className={`drawer${drawer ? " open" : ""}`} aria-hidden={!drawer} role="dialog" aria-label="Menu">
        <div className="drawer-top">
          <MalexLogo height={22} />
          <button className="drawer-close" aria-label="Fechar menu" onClick={() => setDrawer(false)}>
            <Icon name="close" size={24} color="var(--cream-500)" />
          </button>
        </div>
        <nav className="drawer-links">
          <a href="/#como" onClick={() => setDrawer(false)}>Como funciona</a>
          <a href="/#precos" onClick={() => setDrawer(false)}>Preços</a>
          <a href="/#unidades" onClick={() => setDrawer(false)}>Unidades</a>
          <Link to="/blog" onClick={() => setDrawer(false)}>Blog</Link>
          <a href="/#contato" onClick={() => setDrawer(false)}>Contato</a>
        </nav>
        <a className="btn btn-primary btn-cta btn-block" href="/">Reservar locker</a>
      </aside>
    </header>
  );
}

function ShareBar({ url, title }) {
  const [copied, setCopied] = useState(false);
  const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(title + " " + url)}`;
  const copy = useCallback(() => {
    navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }, [url]);
  return (
    <div className="blog-share">
      <span className="blog-share-label">Compartilhar:</span>
      <a className="blog-share-btn" href={waUrl} target="_blank" rel="noopener noreferrer" aria-label="Compartilhar no WhatsApp">
        <Icon name="message-circle" size={17} color="currentColor" /> WhatsApp
      </a>
      <button className="blog-share-btn" onClick={copy} aria-label="Copiar link">
        <Icon name={copied ? "check" : "copy"} size={17} color="currentColor" />
        {copied ? "Copiado!" : "Copiar link"}
      </button>
    </div>
  );
}

function RelatedCard({ post }) {
  return (
    <Link to={`/blog/${post.slug}`} className="blog-related-card">
      <div className="blog-related-img">
        {post.cover_image_url
          ? <img src={post.cover_image_url} alt={post.cover_image_alt || post.title} loading="lazy" />
          : <div className="blog-related-img-placeholder"><Icon name="package" size={24} color="var(--navy-400)" /></div>
        }
      </div>
      <div className="blog-related-body">
        <span className="blog-cat-pill blog-cat-pill-sm">{post.category}</span>
        <p className="blog-related-title">{post.title}</p>
        <span className="blog-related-meta">
          <Icon name="clock" size={12} color="var(--navy-400)" /> {post.read_time_min ?? 1} min
        </span>
      </div>
    </Link>
  );
}

export default function BlogPost() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setLoading(true); setNotFound(false); setPost(null); setRelated([]);
    getPublishedPost(slug).then(({ data, error }) => {
      if (error || !data) { setNotFound(true); setLoading(false); return; }
      setPost(data);
      setLoading(false);
      getRelatedPosts(data.category, slug, 3).then(setRelated);
    });
  }, [slug]);

  if (loading) {
    return (
      <>
        <BlogNav />
        <main>
          <div className="blog-post-skeleton-wrap container">
            <div className="skeleton blog-post-skeleton-title" />
            <div className="skeleton blog-post-skeleton-body" />
          </div>
        </main>
      </>
    );
  }

  if (notFound) {
    return (
      <>
        <BlogNav />
        <main>
          <div className="blog-empty container" style={{ paddingTop: 80, paddingBottom: 80 }}>
            <Icon name="package" size={48} color="var(--navy-400)" />
            <p className="t-body" style={{ color: "var(--navy-300)" }}>Artigo não encontrado.</p>
            <Link to="/blog" className="blog-filter-btn on" style={{ marginTop: 8 }}>← Voltar ao blog</Link>
          </div>
        </main>
      </>
    );
  }

  const pageUrl = `${SITE_URL}/blog/${post.slug}`;
  const pageTitle = post.seo_title || post.title;
  const pageDesc = post.meta_description || post.summary || "";
  const jsonLd = buildJsonLd(post, pageUrl);

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDesc} />
        <link rel="canonical" href={pageUrl} />
        {post.main_keyword && <meta name="keywords" content={[post.main_keyword, ...(post.secondary_keywords || [])].join(", ")} />}
        <meta property="og:type" content="article" />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDesc} />
        <meta property="og:url" content={pageUrl} />
        {post.cover_image_url && <meta property="og:image" content={post.cover_image_url} />}
        {post.published_at && <meta property="article:published_time" content={post.published_at} />}
        <script type="application/ld+json">{jsonLd}</script>
      </Helmet>

      <BlogNav />

      <main>
        {/* Breadcrumb */}
        <div className="blog-breadcrumb on-navy">
          <div className="container blog-breadcrumb-inner">
            <Link to="/">Início</Link>
            <Icon name="chevron-right" size={13} color="var(--navy-400)" />
            <Link to="/blog">Blog</Link>
            <Icon name="chevron-right" size={13} color="var(--navy-400)" />
            <span>{post.category}</span>
          </div>
        </div>

        {/* Cover image */}
        {post.cover_image_url && (
          <div className="blog-post-cover on-navy">
            <div className="container">
              <img src={post.cover_image_url} alt={post.cover_image_alt || post.title} className="blog-post-cover-img" />
            </div>
          </div>
        )}

        {/* Article header */}
        <section className="blog-post-header on-navy">
          <div className="container blog-post-header-inner">
            <span className="blog-cat-pill">{post.category}</span>
            <h1 className="t-display blog-post-title">{post.title}</h1>
            {post.summary && <p className="blog-post-summary">{post.summary}</p>}
            <div className="blog-post-meta">
              {post.published_at && (
                <span className="blog-card-meta-item">
                  <Icon name="calendar-check" size={14} color="var(--navy-400)" />
                  {fmtDate(post.published_at)}
                </span>
              )}
              <span className="blog-card-meta-item">
                <Icon name="clock" size={14} color="var(--navy-400)" />
                {post.read_time_min ?? 1} min de leitura
              </span>
              <span className="blog-card-meta-item">
                <Icon name="user" size={14} color="var(--navy-400)" />
                {post.author || "Malex"}
              </span>
            </div>
            {post.tags?.length > 0 && (
              <div className="blog-post-tags">
                {post.tags.map((t) => <span key={t} className="blog-tag">#{t}</span>)}
              </div>
            )}
          </div>
        </section>

        {/* Article body */}
        <section className="blog-post-body-section on-navy">
          <div className="container blog-post-layout">
            <article className="blog-md">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.body || ""}</ReactMarkdown>
            </article>
          </div>
        </section>

        {/* Share bar */}
        <section className="blog-post-share-section on-navy">
          <div className="container">
            <ShareBar url={pageUrl} title={post.title} />
          </div>
        </section>

        {/* CTA band */}
        <section className="blog-cta-band on-navy">
          <div className="container blog-cta-band-inner">
            <div className="blog-cta-band-text">
              <span className="t-overline" style={{ color: "var(--orange-400)" }}>Guarde sem estresse</span>
              <h2 className="blog-cta-band-title">Reserve seu locker agora</h2>
              <p className="t-body" style={{ color: "var(--navy-200)" }}>Deixe a bagagem com a gente e aproveite cada minuto da sua viagem.</p>
            </div>
            <div className="blog-cta-band-actions">
              <a className="btn btn-primary btn-cta" href="/">Reservar locker</a>
              <a className="btn btn-ghost" href={MALEX_CONTACT.whatsapp} target="_blank" rel="noopener noreferrer">Falar no WhatsApp</a>
            </div>
          </div>
        </section>

        {/* Related posts */}
        {related.length > 0 && (
          <section className="blog-related-section on-navy">
            <div className="container">
              <h2 className="blog-related-heading">Você também pode gostar</h2>
              <div className="blog-related-grid">
                {related.map((r) => <RelatedCard key={r.id} post={r} />)}
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="blog-footer on-navy">
        <div className="container blog-footer-inner">
          <MalexLogo height={20} />
          <span className="t-body-sm" style={{ color: "var(--navy-300)" }}>© {new Date().getFullYear()} Malex. Todos os direitos reservados.</span>
          <div className="blog-footer-links">
            <Link to="/">Site</Link>
            <a href={MALEX_CONTACT.whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp</a>
          </div>
        </div>
      </footer>
    </>
  );
}
