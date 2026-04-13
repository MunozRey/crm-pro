---
phase: 09-test-suite
plan: 6
title: "Complete i18n coverage — all 3 languages"
goal: "Every visible UI string goes through the translation system with full parity across es, en, and pt."
wave: 1
dependencies: []
requirements: [I18N-01, I18N-02]
---

# Plan 09-6: Complete i18n Coverage

## Goal
Replace every hardcoded Spanish/English string in the UI with `t.xxx` keys and add all missing keys to es.ts, en.ts, and pt.ts with full parity.

## Context
Phase 08 verified that en.ts had key parity with es.ts at the time — but the audit reveals 30+ keys that were never added to the i18n system at all (they exist only as hardcoded strings in components). The most affected files are: ForgotPassword.tsx, OrgSetup.tsx, AcceptInvite.tsx, Register.tsx, Inbox.tsx, Settings.tsx, EmailComposer.tsx.

A Portuguese translation file (pt.ts) also exists and must be kept in sync.

## Tasks

### Task 1: Read existing translation files
Read all three files before making any changes:
- `src/i18n/es.ts` — source of truth
- `src/i18n/en.ts`
- `src/i18n/pt.ts`
- `src/i18n/types.ts` — TranslationSchema type

### Task 2: Add missing keys to all 3 language files

Add the following key groups to `es.ts`, `en.ts`, and `pt.ts`. Keep the existing structure — append new sections where appropriate.

**`auth` section — add these keys:**
```
forgotPasswordTitle:   es="Recuperar contraseña"          en="Recover password"           pt="Recuperar senha"
checkEmailTitle:       es="Revisa tu correo"               en="Check your email"           pt="Verifique seu e-mail"
checkEmailSent:        es="Hemos enviado un enlace de recuperación a tu correo."  en="We've sent a recovery link to your email."  pt="Enviamos um link de recuperação para seu e-mail."
checkEmailInstructions:es="Introduce tu email y te enviaremos un enlace para restablecer tu contraseña."  en="Enter your email and we'll send you a link to reset your password."  pt="Insira seu e-mail e enviaremos um link para redefinir sua senha."
sendLink:              es="Enviar enlace"                  en="Send link"                  pt="Enviar link"
backToLogin:           es="Volver al inicio de sesión"     en="Back to login"              pt="Voltar ao login"
realAuthEnabled:       es="Autenticación real activa"      en="Real authentication enabled" pt="Autenticação real ativada"
emailPlaceholder:      es="tu@empresa.com"                 en="you@company.com"            pt="voce@empresa.com"
checkEmailConfirmation:es="Hemos enviado un enlace de confirmación a"  en="We sent a confirmation link to"  pt="Enviamos um link de confirmação para"
```

**`orgSetup` section — new section:**
```
title:              es="Crea tu organización"                              en="Create your organization"                        pt="Crie sua organização"
subtitle:           es="Configura el espacio de trabajo para tu equipo comercial"  en="Set up the workspace for your sales team"  pt="Configure o espaço de trabalho para sua equipe comercial"
orgNameLabel:       es="Nombre de la organización"                         en="Organization name"                               pt="Nome da organização"
orgNamePlaceholder: es="Acme Sales Team"                                   en="Acme Sales Team"                                 pt="Acme Sales Team"
slugLabel:          es="Slug (identificador único)"                        en="Slug (unique identifier)"                        pt="Slug (identificador único)"
slugHint:           es="Solo letras minúsculas, números y guiones"         en="Lowercase letters, numbers and hyphens only"     pt="Apenas letras minúsculas, números e hífens"
createButton:       es="Crear organización"                                en="Create organization"                             pt="Criar organização"
errorNameRequired:  es="El nombre de la organización es obligatorio"       en="Organization name is required"                   pt="O nome da organização é obrigatório"
errorSlugRequired:  es="El slug es obligatorio"                            en="Slug is required"                                pt="O slug é obrigatório"
errorNotConfigured: es="Supabase no está configurado"                      en="Supabase is not configured"                      pt="Supabase não está configurado"
errorNotAuthenticated: es="No autenticado"                                 en="Not authenticated"                               pt="Não autenticado"
```

**`invitations` section — new section:**
```
invalidToken:       es="Enlace de invitación inválido: falta el token."    en="Invalid invitation link: token missing."         pt="Link de convite inválido: token ausente."
invalidOrExpired:   es="Esta invitación no es válida o ha expirado."       en="This invitation is invalid or has expired."      pt="Este convite é inválido ou expirou."
alreadyAccepted:    es="Esta invitación ya fue aceptada."                  en="This invitation has already been accepted."      pt="Este convite já foi aceito."
expired:            es="Esta invitación ha expirado."                      en="This invitation has expired."                    pt="Este convite expirou."
```

**`errors` section — new section:**
```
supabaseNotConfigured: es="Supabase no está configurado"   en="Supabase is not configured"   pt="Supabase não está configurado"
gmailConnectionError:  es="Error al conectar Gmail"         en="Error connecting Gmail"        pt="Erro ao conectar Gmail"
invitationSendError:   es="Error al enviar la invitación"   en="Error sending invitation"      pt="Erro ao enviar o convite"
duplicateTag:          es="Etiqueta duplicada"              en="Duplicate tag"                 pt="Tag duplicada"
```

**`email` section — add to existing:**
```
gmailApiLabel:         es="Gmail API"                 en="Gmail API"                pt="Gmail API"
googleClientIdLabel:   es="Google OAuth Client ID"    en="Google OAuth Client ID"   pt="Google OAuth Client ID"
```

### Task 3: Update TranslationSchema type (types.ts)
Add the new sections (`orgSetup`, `invitations`, `errors`) to the TypeScript type so the compiler enforces parity. Read the current types.ts structure and append matching interface blocks.

### Task 4: Replace hardcoded strings in components

For each file below, read it first, then replace hardcoded strings with `t.xxx` calls using `const t = useTranslations()`.

**`src/pages/ForgotPassword.tsx`**
- Replace all 6 hardcoded strings with `t.auth.*` keys added in Task 2

**`src/pages/OrgSetup.tsx`**
- Add `useTranslations` import
- Replace all hardcoded strings with `t.orgSetup.*` keys

**`src/pages/AcceptInvite.tsx`**
- Add `useTranslations` import  
- Replace all 5 error strings with `t.invitations.*` keys

**`src/pages/Register.tsx`**
- Replace "Real authentication enabled" with `t.auth.realAuthEnabled`
- Replace "Check your email" heading with `t.auth.checkEmailTitle`
- Replace "We sent a confirmation link to" with `t.auth.checkEmailConfirmation`
- Replace placeholder "tu@empresa.com" with `t.auth.emailPlaceholder`

**`src/pages/Login.tsx`**
- Replace "Real authentication enabled" badge text with `t.auth.realAuthEnabled`
- Replace placeholder with `t.auth.emailPlaceholder`

**`src/pages/Settings.tsx`**
- Replace `'Duplicate tag'` with `t.errors.duplicateTag`
- Replace `'Error al conectar Gmail'` with `t.errors.gmailConnectionError`
- Replace `'Error al enviar la invitación'` with `t.errors.invitationSendError`
- Replace `'Gmail API'` label with `t.email.gmailApiLabel`
- Replace `'Google OAuth Client ID'` label with `t.email.googleClientIdLabel`

**`src/pages/Inbox.tsx`**
- Replace `'Error al conectar Gmail'` with `t.errors.gmailConnectionError`
- Fix `new Date(msg.date).toLocaleString('es', ...)` — use the current language from `useI18nStore` to set the locale dynamically

### Task 5: Verify TypeScript compilation
Run `npx tsc --noEmit` from the project root. Fix any type errors caused by missing keys in the TranslationSchema.

## Verification
- `npx tsc --noEmit` exits 0
- Switching to English shows all strings in English (no Spanish leaking through)
- Switching to Portuguese shows all strings in Portuguese
- ForgotPassword page shows in the active language
- OrgSetup page shows in the active language
- Inbox Gmail error toast shows in the active language
