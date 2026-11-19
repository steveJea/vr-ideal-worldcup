# Deploy the VR world cup preview

This project is a static site plus one Cloudflare Worker. The Worker serves the pages, the per-heroine link preview at `/r/:id`, and the global #1 ranking API. It does not attach `wcup.mbbs.kr`. Do not add a `routes` or `custom_domain` entry for that host.

## Channel links

Edit only `js/config.js`.

- `channels`: each item needs `id`, `label`, and `url`. An empty `url` hides that channel. If every url is empty, the official-channel section stays hidden.
- `kakaoJsKey`: leave empty. The KakaoTalk button stays hidden and the Kakao SDK is not loaded. Put a Kakao JavaScript key here later and the result screen shows 카카오톡. The phone share sheet can already offer KakaoTalk without that key.
- `publicOrigin` and `apiBase`: leave empty so links and the ranking API use the site the visitor is on.

## What the ranking stores

D1 database `vr-wcup-ranking`, binding `DB`. Migration: `migrations/0001_init.sql`.

Tables:

- `open_runs`: random run id issued when a tournament starts, plus a timestamp.
- `counted_runs`: that run id after one successful finish. The same run cannot increment again.
- `heroine_wins`: heroine id and win count.
- `rate_buckets`: short-lived counters keyed by a hash of the connection address. The address itself is not stored.

A finish counts only when the run is at least `MIN_RUN_MS` old (default 2500). Defaults are 30 new runs and 40 finishes per hour for one address hash. If the API cannot be reached, the tournament still finishes on the phone.

Character ages stay in `VR_DATA.csv` and are removed before the catalog, the page, the share card, the ranking, and link previews are built.

## Preview on a phone

From this repo, with Wrangler 4.102 or newer:

```sh
npm install
npm run deploy:preview
```

`deploy:preview` rebuilds `data/catalog.json` and `img/og/*.jpg`, then runs `wrangler deploy --temporary`. Wrangler prints a `*.workers.dev` URL and a claim URL. Open the workers.dev URL on a phone. Claim the temporary account within 60 minutes if the deployment should be kept; otherwise Cloudflare deletes it. The claim URL is a secret for the site owner.

The Worker name is `vr-wcup-preview`. The first deploy creates the D1 database when `database_id` is omitted. After that, apply the migration to the remote database:

```sh
npx wrangler d1 migrations apply vr-wcup-ranking --remote
```

Local check:

```sh
npm run catalog
npm run og:home
npx wrangler d1 migrations apply vr-wcup-ranking --local
npx wrangler dev
```

Open `http://127.0.0.1:8787`.

## If deploy cannot log in

Nothing in this repo can authenticate to the owner's Cloudflare account by itself. Either:

1. Use the temporary deploy above and claim it, or
2. On the owner's machine run `npx wrangler login`, or create an API token with Workers Scripts edit and D1 edit, export it as `CLOUDFLARE_API_TOKEN`, then run `npm run deploy:preview` without `--temporary` by calling `npx wrangler deploy`.

Do not point the Worker at `wcup.mbbs.kr` until the owner chooses to replace the live site. Adding that domain is a separate step in the Cloudflare dashboard or a `routes` change that this preview intentionally does not include.

Link previews need the generated JPEGs. `npm run og` writes `img/home-og.jpg` and `img/og/<id>.jpg`. The per-heroine files are gitignored and must be generated before deploy. If a JPEG is missing, `/r/:id` falls back to the portrait WebP.

The title screen and `img/home-og.jpg` feature 임유리 (id 10325). A finished result still previews that winner. Nothing in the ranking API prefers her; the board is only real win counts.
