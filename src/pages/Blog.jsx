// Malex Blog — listagem de artigos com filtro por categoria.
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { MalexLogo, Icon, MALEX_CONTACT } from "../components/Primitives.jsx";
import { listPublishedPosts, BLOG_CATEGORIES } from "../lib/blog.js";

const SITE_URL = "https://malex.com.br";

function fmtDate(v) {
  if (!v) return "";
  const d = new Date(v);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
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

function PostCard({ post }) {
  return (
    <Link to={`/blog/${post.slug}`} className="blog-card">
      <div className="blog-card-img">
        {post.cover_image_url
          ? <img src={post.cover_image_url} alt={post.cover_image_alt || post.title} loading="lazy" />
          : <div className="blog-card-img-placeholder"><Icon name="package" size={36} color="var(--navy-400)" /></div>
        }
      </div>
      <div className="blog-card-body">
        <span className="blog-cat-pill">{post.category}</span>
        <h2 className="blog-card-title">{post.title}</h2>
        {post.summary && <p className="blog-card-summary">{post.summary}</p>}
        <div className="blog-card-meta">
          <span className="blog-card-meta-item">
            <Icon name="clock" size={13} color="var(--navy-400)" />
            {post.read_time_min ?? 1} min
          </span>
          {post.published_at && (
            <span className="blog-card-meta-item">
              <Icon name="calendar-check" size={13} color="var(--navy-400)" />
              {fmtDate(post.published_at)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function Blog() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState(null);

  useEffect(() => {
    setLoading(true);
    listPublishedPosts(cat).then(({ data }) => { setPosts(data); setLoading(false); });
  }, [cat]);

  const title = "Blog Malex — Dicas de viagem, aeroportos e guarda-volumes";
  const description = "Artigos sobre guarda-volumes, lockers, guias de aeroportos, roteiros de viagem e muito mais. Viaje mais leve com a Malex.";

  return (
    <>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={`${SITE_URL}/blog`} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={`${SITE_URL}/blog`} />
      </Helmet>

      <BlogNav />

      <main>
        <section className="blog-hero on-navy">
          <div className="container blog-hero-inner">
            <span className="t-overline" style={{ color: "var(--orange-400)" }}>Blog Malex</span>
            <h1 className="t-display blog-hero-title">Viaje mais leve.<br />Leia mais.</h1>
            <p className="t-body-lg blog-hero-sub">Dicas de aeroportos, roteiros, guarda-volumes e tudo que você precisa saber pra viajar sem estresse.</p>
          </div>
        </section>

        <section className="blog-filter-bar on-navy">
          <div className="container">
            <div className="blog-filters">
              <button className={`blog-filter-btn${cat === null ? " on" : ""}`} onClick={() => setCat(null)}>Todos</button>
              {BLOG_CATEGORIES.map((c) => (
                <button key={c} className={`blog-filter-btn${cat === c ? " on" : ""}`} onClick={() => setCat(c)}>{c}</button>
              ))}
            </div>
          </div>
        </section>

        <section className="blog-grid-section on-navy">
          <div className="container">
            {loading ? (
              <div className="blog-grid">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="blog-card-skeleton skeleton" style={{ animationDelay: `${i * 0.08}s` }} />
                ))}
              </div>
            ) : posts.length === 0 ? (
              <div className="blog-empty">
                <Icon name="package" size={40} color="var(--navy-400)" />
                <p className="t-body" style={{ color: "var(--navy-300)" }}>Nenhum artigo publicado ainda{cat ? ` em "${cat}"` : ""}.</p>
                {cat && <button className="blog-filter-btn on" onClick={() => setCat(null)}>Ver todos</button>}
              </div>
            ) : (
              <div className="blog-grid">
                {posts.map((p) => <PostCard key={p.id} post={p} />)}
              </div>
            )}
          </div>
        </section>
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
