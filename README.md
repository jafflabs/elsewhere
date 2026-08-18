# Elsewhere

**We get to choose.**

Elsewhere is a small shared exploration app for Brad + Sam: careers, places, houses, organizations, communities, scouting ideas, and whatever else starts making a possible future feel visible.

It intentionally avoids pretending to be a relocation decision engine. The core workflow is:

**Explore → Save a possibility → React → Connect it to a place → Revisit what keeps showing up**

The Australian Agreement Tangle is a first-class feature:

- **Yeah, nah** — pass / no
- **Nah, yeah** — yes
- **Yeah, nah, yeah** — yes after hesitation / growing on me
- **♥** — love
- **Hmm** — needs more research

## What is in this package

```text
elsewhere-v1.1/
├── index.html
├── style.css
├── config.js
├── app.js
├── assets/
│   ├── elsewhere-logo.png
│   ├── elsewhere-mark.png
│   ├── favicon.png
│   ├── henry.jpg
│   ├── perez.jpg
│   ├── banana.jpg
│   ├── nadja.jpg
│   └── cat-family-reference.jpg
├── vercel.json
├── README.md
├── SETUP.md
└── supabase/
    └── schema.sql
```

## Visual identity

The first polish pass adds the Elsewhere compass/path logo and four small cat “sightings” around the app. The cat portraits are ordinary image assets with a reusable `.cat-easter` CSS treatment rather than bespoke layout code. `assets/cat-family-reference.jpg` preserves the approved family illustration for future art tweaks but is not loaded by the app.

## Two operating modes

### 1. Local preview mode

Open the site before configuring Supabase and it works immediately using browser `localStorage`.

A small **Exploring as Brad / Sam** selector lets one browser simulate the two-person reaction model. This is useful for design tinkering and testing.

### 2. Shared mode

Add a Supabase Project URL and **publishable key** to `config.js` and the app automatically switches to shared mode.

Shared mode provides:

- email/password sign-in
- one shared Elsewhere workspace
- a one-time join code for the second person
- shared possibilities
- separate Brad/Sam reactions
- shared field notes
- database-backed persistence
- Row Level Security

## Important security rule

`config.js` may contain the Supabase **publishable/anon key** used by the browser. Do **not** put a Supabase `service_role` or secret server key in this project.

Database access is restricted by the Row Level Security policies in `supabase/schema.sql`.

## App structure

The project deliberately remains vanilla HTML/CSS/JavaScript for V1. There is no build system and no frontend framework to learn or maintain.

`config.js` contains the editable exploration vocabulary:

- Brad search lenses
- Sam search lenses
- shared life/search lenses
- regions
- reactions

`app.js` contains behavior and two persistence adapters:

- `LocalStore`
- `SupabaseStore`

That boundary is intentional. The application can evolve without tying the UI directly to one storage mechanism.

## Deployment

See [SETUP.md](SETUP.md) for the full Supabase + GitHub + Vercel walkthrough.

Official references:

- Supabase JavaScript: https://supabase.com/docs/reference/javascript/installing
- Supabase Auth: https://supabase.com/docs/guides/auth
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Vercel Git deployments: https://vercel.com/docs/git

## V1 intentionally does not include

- realtime subscriptions
- maps
- automatic job scraping
- AI agents
- numerical relocation scoring
- social/OAuth login
- a frontend framework

Those are future options, not missing requirements.
