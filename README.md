# GQA App

App Expo (React Native) que envia um documento ao backend GQA e apresenta as questões de múltipla escolha geradas, com correção e explicação.

## Como rodar

```bash
npm install
npm start          # depois: "a" (Android), "i" (iOS) ou "w" (web) — ou escaneie o QR no Expo Go
```

Backend (`G:\Projects\gqa`): `npm start` com o `.env` preenchido (porta 3000).

### Login (Supabase Auth)
O app autentica direto no Supabase, guarda a sessão no armazenamento seguro e renova o token automaticamente. O `user.id` é enviado como `userId` no `/upload`, e o `access_token` vai em `Authorization: Bearer` nas chamadas à API.

Recursos (`src/services/auth.ts`):
- **Entrar** com e-mail e senha — tela `login`.
- **Criar conta** — tela `signup` (com confirmação de e-mail, se estiver ativa no Supabase; link de volta em `auth/confirm`).
- **Entrar com Google** — OAuth + PKCE no navegador do sistema (`expo-web-browser`); retorno em `auth/google`.
- **Recuperar senha** — telas `forgot-password` (envia o e-mail) e `reset-password` (define a nova senha pelo link).

Configure `.env.local` (veja `.env.example`) com `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_KEY` (chave publishable/anon — nunca a service key). Após alterar, reinicie com `npx expo start --clear`.

#### Configuração necessária no Supabase / Google
1. **Supabase → Authentication → URL Configuration → Redirect URLs**: adicione
   - `gqa-app://**` (builds de desenvolvimento/produção)
   - `exp://**` (Expo Go, se usar)
   - `http://localhost:8081/**` (web, se usar)
2. **Google Cloud → OAuth Web client → Authorized redirect URIs**: `https://<seu-projeto>.supabase.co/auth/v1/callback`.
3. **Supabase → Authentication → Providers → Google**: ativado com o Client ID/Secret do cliente **Web**.
4. (Opcional) **Authentication → Email Templates**: personalize os e-mails de confirmação e recuperação.

### Endereço da API
Por padrão o app usa o backend em produção: **https://gqa-backend.onrender.com** (pode ser trocado com `EXPO_PUBLIC_API_URL` no `.env.local`). No plano gratuito do Render o servidor "dorme" após inatividade, então a primeira chamada pode levar cerca de um minuto.

Para testar com o backend local, abra **Configurações** (engrenagem), toque em **Local** e use **Testar conexão**:

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

