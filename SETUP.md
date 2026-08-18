# Elsewhere setup

This walkthrough takes Elsewhere from the included local preview to a private shared Brad + Sam workspace hosted on Vercel with Supabase persistence.

## 1. Test the local preview first

You can open `index.html` directly, but some browsers are friendlier to locally served pages.

From the project folder, one easy option if Python is installed is:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

Because `config.js` initially contains no Supabase credentials, Elsewhere will announce **Local preview** in the lower-left status area.

Try these before doing any cloud setup:

1. Explore Brad / Sam / Us.
2. Save a possibility.
3. Switch **Exploring as** between Brad and Sam and give the same possibility different reactions.
4. Add a field note.
5. Confirm the place thread begins showing evidence.
6. Export JSON.

If those mechanics feel right, move on.

---

## 2. Create the Supabase project

1. Create a Supabase account/project.
2. Give the project a recognizable name such as `elsewhere`.
3. Choose a database region reasonably close to where the app will normally be used.
4. Save the database password somewhere appropriate; the browser app does not need it.

### Run the schema

Open Supabase **SQL Editor**, create a new query, paste the complete contents of:

```text
supabase/schema.sql
```

Run it once.

This creates:

- `profiles`
- `workspaces`
- `workspace_members`
- `possibilities`
- `reactions`
- `observations`
- profile creation trigger
- workspace create/join functions
- Row Level Security policies

### Authentication

Elsewhere V1 uses email + password authentication.

Hosted Supabase projects normally enable email confirmation by default. You can leave that enabled. If you do, Brad and Sam each confirm their email before the first sign-in.

For a private two-person experiment, you may choose to disable email confirmation in Supabase Auth settings while testing, then turn it back on later.

Do not enable anonymous access for Elsewhere.

---

## 3. Add the browser-safe Supabase values

In the Supabase dashboard, find the project's API connection information and copy:

- Project URL
- Publishable key (or legacy anon key if that is what your project displays)

Edit `config.js`:

```javascript
supabase: {
  url: "https://YOUR-PROJECT.supabase.co",
  publishableKey: "YOUR-PUBLISHABLE-KEY"
}
```

### Never use the service-role key here

The publishable/anon key is expected to be present in a browser application. Row Level Security determines what an authenticated browser user can actually access.

The service-role/secret key bypasses RLS and must never be committed into this frontend.

---

## 4. Test shared mode locally

Serve the folder again:

```bash
python -m http.server 8000
```

Open `http://localhost:8000`.

Elsewhere should now show the sign-in dialog.

### First person

1. Choose **Create account**.
2. Enter name, email, and password.
3. Confirm email if Supabase asks for confirmation.
4. Sign in.
5. Choose **Create Elsewhere**.
6. Open **Backup** and note the workspace join code.

### Second person

1. Create the second account.
2. Confirm/sign in.
3. Choose **Join it**.
4. Enter the first person's join code.

Now both accounts belong to the same workspace.

The schema intentionally allows each account to belong to only one Elsewhere workspace in V1.

---

## 5. Put the source in GitHub

Create a new repository for this app—something like:

```text
elsewhere
```

From the project directory:

```bash
git init
git add .
git commit -m "Launch Elsewhere v1"
git branch -M main
git remote add origin <YOUR-GITHUB-REPOSITORY-URL>
git push -u origin main
```

If you already create the GitHub repository with a README, pull/reconcile that history first rather than blindly overwriting it.

---

## 6. Deploy to Vercel

1. Sign in to Vercel.
2. Choose **Add New → Project**.
3. Import the GitHub `elsewhere` repository.
4. Vercel should treat this as a static project. No framework or build command is required.
5. Deploy.

Vercel will give the deployment a generated HTTPS URL.

Each later push to the connected Git repository can automatically create another deployment; production behavior is controlled by the Git/Vercel project settings.

---

## 7. Update Supabase Auth URLs

Once the production Vercel URL exists, open Supabase authentication URL settings.

Set the production site URL to the Vercel address, for example:

```text
https://elsewhere-your-project.vercel.app
```

Also add any development URL you want to continue using as an allowed redirect, such as:

```text
http://localhost:8000
```

This matters for account-confirmation links and future password-reset flows.

---

## 8. First real shared test

Use two browsers, browser profiles, or devices.

Brad:

1. Sign in.
2. Save a possibility.
3. React to it.

Sam:

1. Sign in.
2. Confirm the possibility is visible.
3. Add a different reaction.
4. Add a note.

Brad:

1. Refresh.
2. Confirm Sam's reaction and note appear.

V1 deliberately uses refresh/load synchronization rather than realtime subscriptions. Realtime can be added later if it proves useful.

---

## 9. What to edit first

Most early tinkering should happen in `config.js`, not `app.js`.

That is where you can change:

- regions
- search vocabulary
- career lenses
- reaction labels
- regional starter notes

The visual identity lives in `style.css` plus the small files under `assets/`.

The data model and persistence behavior live in `app.js` and `supabase/schema.sql`.

---

## 10. Recommended next enhancements only after using V1

Let actual use tell us which of these matters:

- edit existing possibilities
- realtime updates
- richer place dossiers
- a true shortlist view
- property/housing search presets by acreage and price
- scouting-trip planning
- map visualization
- import from Elsewhere JSON
- optional role-fit / bridge notes for Brad job postings
- richer ecosystem records for Sam
- uploaded photos/screenshots

Do not add them merely because they are possible.
