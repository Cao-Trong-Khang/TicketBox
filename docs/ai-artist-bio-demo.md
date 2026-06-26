# AI Artist Biography local demo

## Configure Gemini

Create a `.env` file in the repository root, next to `docker-compose.yml`:

```env
GEMINI_API_KEY=your_gemini_api_key
```

Do not add the real key to `.env.example` or commit it to Git. The `ai-bio-worker` service maps this value to `AI_API_KEY` and uses `AI_PROVIDER=gemini` with `AI_MODEL=gemini-2.5-flash`.

## Start the stack

```powershell
cd backend
npm install
npm run prisma:deploy
cd ..
docker compose up -d --build
```

The existing seed provides `org@gmail.com` / `12345678` and owned published concerts, so no extra feature-specific seed row is required. MinIO is available at `http://localhost:9000` (console `http://localhost:9001`) and the private bucket is `artist-documents`.

Confirm that the worker received the Gemini key without printing the key itself:

```powershell
docker compose exec ai-bio-worker node -e "console.log(process.env.AI_API_KEY ? 'Configured' : 'Missing')"
```

The expected result is `Configured`.

## Demo flow

1. Open `http://localhost:5173/login` and log in as the organizer with `org@gmail.com` / `12345678`.
2. Get an owned concert ID from `GET http://localhost:3000/concerts`.
3. Open `http://localhost:5173/admin/concerts/<concert-id>/artist-bio`, select a text-based PDF (10 MB maximum), and upload it.
4. The POST returns `202 { document_id, status: "uploaded" }`. The page polls every four seconds while the worker extracts the PDF and calls Gemini 2.5 Flash through the statuses `extracting`, `extracted`, and `generating`.
5. Confirm the terminal detail status is `done`, then open `GET /concerts/<concert-id>` and verify `artist_bio` is present.
6. Use **Edit Manually** and verify the public response changes immediately. Use **Regenerate** and verify a new document ID is returned with HTTP 202.
7. Upload an empty/scanned PDF to demonstrate terminal `failed` with `Could not extract text. Please upload a text-based PDF.`

## Verification commands

```powershell
cd backend
npm run lint
npm test
npm run build

cd ../frontend
npm run lint
npm test
npm run build

cd ..
docker compose ps
docker compose logs ai-bio-worker --tail 50
```

Gemini connectivity verified on 2026-06-22: `gemini-2.5-flash` returned HTTP 200 with the configured API key. The older `gemini-1.5-flash` model returned HTTP 404 and must not be used for this demo.
