# تصحيح النشر RC2 — SBTS 2.2.2

## سبب فشل المحاولة السابقة

1. `02_PUSH_UPDATE` شغّل بوابة الإصدار قبل تثبيت `node_modules`، لذلك ظهرت
   رسالة `Local package.json exists, but node_modules missing` ولم يحدث commit
   أو push.
2. `.dockerignore` استبعد مجلد `.github`، بينما عقد الإصدار والاختبارات تقرأ
   `.github/workflows/ci.yml`. لذلك توقف Railway بخطأ `ENOENT` أثناء Build.
3. ظهور 404 من دومين Railway طبيعي بعد فشل Build وبقاء الخدمة Offline؛ ليس
   خطأ MySQL أو DNS مستقلاً.

## التطبيق على مجلد Git الحالي

لا تحذف المشروع مرة أخرى. احتفظ بمجلد `.git` ثم:

1. انسخ كل محتويات حزمة RC2 فوق `C:\Projects\SBTS\SBTS-Production`.
2. اختر **Replace the files in the destination**.
3. افتح نفس المجلد في VS Code.
4. شغّل `02_PUSH_UPDATE.cmd`.

السكربت الآن ينفذ تلقائياً:

```text
pnpm install --frozen-lockfile
→ فحص الإصدار والأمن وTypeScript والاختبارات والبناء
→ git add / commit / pull --rebase / push
→ مقارنة local HEAD مع origin/main
```

لا تشغّل `deploy:verify` قبل أن تصبح Railway بحالة Success وOnline.

## Railway بعد نجاح Push

- تأكد أن Deploy المعروض يحمل الـcommit الجديد الذي طبعه السكربت، وليس
  `3748896a` القديم.
- يجب أن يصبح Healthcheck Path هو `/ready`. إذا بقي `/health` كإعداد يدوي قديم،
  غيّره من Settings → Deploy → Healthcheck Path إلى `/ready`.
- في أول ترقية فقط استخدم `RUN_WORKFLOW_BACKFILL_ON_DEPLOY=true`، ثم أعده إلى
  `false` بعد نجاح النشرة.

بعد أن تصبح الخدمة Online شغّل:

```powershell
pnpm deploy:verify -- https://sbts-production.up.railway.app
```

القبول الصحيح يعرض الإصدار `2.2.2` ونفس commit الجديد و
`database: connected`.
