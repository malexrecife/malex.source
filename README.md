# Malex — Você, livre de malas.

Site institucional + wizard de reserva de locker da Malex. Construído em **React + Vite**.
As reservas confirmadas são persistidas no **Supabase**.

> Implementado a partir do handoff de design do Claude Design. O briefing original está em [`docs/HANDOFF.md`](docs/HANDOFF.md).

---

## Stack

- **React 18** + **Vite 5** (build estático)
- **Supabase** (Postgres) para gravar as reservas
- CSS próprio com os tokens da marca (Space Grotesk + Open Sauce One)

## Rodar localmente

Requer **Node.js 18+**.

```bash
npm install            # 1ª vez
cp .env.example .env   # crie seu .env (veja "Variáveis de ambiente")
npm run dev            # http://localhost:5173
```

Outros scripts:

```bash
npm run build      # gera o dist/ (build de produção)
npm run preview    # serve o dist/ em http://localhost:4173
```

## Variáveis de ambiente

| Variável | Onde achar (Supabase → Project Settings → API) |
|---|---|
| `VITE_SUPABASE_URL` | **Project URL** |
| `VITE_SUPABASE_ANON_KEY` | chave **`anon` / `public`** (pública — nunca a `service_role`) |

Sem essas variáveis, o app roda em **modo demo**: o wizard funciona até o fim e mostra a
confirmação, mas **não grava nada** no banco.

> A `anon key` é pública por design e fica embutida no bundle do front-end. A segurança vem
> do **RLS** (veja abaixo): com a política aplicada, o cliente só consegue *inserir* reservas,
> nunca *ler*/editar as dos outros.

## Supabase (banco)

1. Crie um projeto em [supabase.com](https://supabase.com) (região **South America / São Paulo**).
2. **SQL Editor → New query** → cole o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
   Isso cria a tabela `reservations` e o RLS (apenas INSERT anônimo).
3. Copie URL + anon key para o seu `.env` (local) e para o painel de deploy (produção).

**Dados de cartão nunca são gravados** — apenas `pay_method` (`pix`/`card`) e `status`.
Para cobrança real, integre um gateway (Stripe/Mercado Pago) e guarde só o `payment_id`/status.

## Deploy

O `dist/` é estático e pode ser hospedado em qualquer lugar. Duas rotas recomendadas:

### Vercel (conectado ao GitHub)
1. Suba este repositório no GitHub.
2. [vercel.com](https://vercel.com) → **Add New… → Project** → importe o repo.
3. Framework **Vite** é detectado automaticamente (config em `vercel.json`).
4. **Settings → Environment Variables** → adicione `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
5. **Deploy.** Cada `git push` re-publica.

### Netlify (conectado ao GitHub)
1. Suba o repositório no GitHub.
2. [netlify.com](https://netlify.com) → **Add new site → Import an existing project**.
3. Build/publish já vêm de `netlify.toml` (`npm run build` → `dist`).
4. **Site settings → Environment variables** → adicione as duas variáveis acima.
5. **Deploy.**

> Deploy rápido sem Git: `npm run build` e arraste a pasta `dist/` em
> [app.netlify.com/drop](https://app.netlify.com/drop). Nesse caso as credenciais ficam
> embutidas no bundle local (a anon key é pública, então tudo bem — desde que o RLS esteja ativo).

## Estrutura

```
index.html              # entry do Vite
vite.config.js
netlify.toml / vercel.json
.env.example
supabase/schema.sql     # tabela + RLS
src/
  main.jsx              # monta o React + importa os CSS
  App.jsx               # composição da página + wizard
  icons.js              # set de ícones da marca
  lib/supabase.js       # cliente + saveReservation()
  components/
    Primitives.jsx      # logo, ícones, botões, pills, stickers, config
    Site.jsx            # Nav, Hero, Ticker, Como Funciona
    Sections.jsx        # Preços, Sobre, Contato, Footer
    Reservar.jsx        # wizard de reserva (6 passos)
  styles/               # colors_and_type.css, components.css, styles.css
public/
  fonts/  assets/       # fontes e imagens
docs/HANDOFF.md         # briefing original do design
```

## A trocar antes de produção

Em `src/components/Primitives.jsx` (topo): `MALEX_CONTACT` (WhatsApp, telefone, e-mail,
endereço — hoje placeholders) e `MALEX_PRICING` (valores **ilustrativos**).
