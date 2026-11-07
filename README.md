# GQA App

App Expo (React Native) que envia um documento ao backend GQA e apresenta as questões de múltipla escolha geradas, com correção e explicação.

## Como rodar

```bash
npm install
npm start          # depois: "a" (Android), "i" (iOS) ou "w" (web) — ou escaneie o QR no Expo Go
```

Backend (`G:\Projects\gqa`): `npm start` com o `.env` preenchido (porta 3000).

### Login (Supabase Auth)
O app autentica por e-mail/senha direto no Supabase (`/auth/v1/token?grant_type=password`), guarda a sessão no armazenamento seguro e renova o token automaticamente. O `user.id` retornado é enviado como `userId` no `/upload`, e o `access_token` vai em `Authorization: Bearer` nas chamadas à API.

Configure `.env.local` (veja `.env.example`) com `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_KEY` (chave publishable/anon — nunca a service key). Após alterar, reinicie com `npx expo start --clear`.

### Endereço da API
O app detecta automaticamente o IP do computador (mesmo usado pelo Metro) e usa `http://<ip>:3000`.
Se precisar, ajuste em **Configurações** (ícone de engrenagem) e use **Testar conexão**:

| Ambiente | Endereço |
| --- | --- |
| Celular físico (Expo Go) | `http://<IP-do-PC>:3000` (mesma rede Wi-Fi) |
| Emulador Android | `http://10.0.2.2:3000` |
| iOS Simulator / Web | `http://localhost:3000` |

## Endpoints usados
- `GET /health`
- `POST /upload` — multipart: `file`, `userId` → `{ document_id }`
- `POST /gerar-questao` — JSON: `document_id`, `nivelDificuldade` (`facil|medio|dificil`), `tema?` → `{ enunciado, alternativas[4], resposta_correta, comentario }`

## Estrutura (`src/`)
- `app/` — rotas (Expo Router): `index` (upload), `quiz/[documentId]`, `settings`
- `components/` — Button, Layout, OptionItem, DifficultySelector, QuestionSkeleton, ErrorBanner
- `services/` — `api.ts` (HTTP/upload com progresso), `filePicker.ts`
- `context/AppContext.tsx` — URL da API, userId e documentos recentes (AsyncStorage)
- `theme/` — tema claro/escuro (styled-components)

## Scripts
`npm run lint` · `npm run typecheck`

