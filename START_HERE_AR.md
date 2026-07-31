# ابدأ من هنا — SBTS 2.2.2 Sprint 5 Recovery

هذه حزمة مصدر نظيفة، وليست مستودع Git. وجود الملفات وحده لا يرسل أي تحديث إلى GitHub أو Railway.

## المسار الصحيح الوحيد للنشر

1. استخدم نسخة Git الحقيقية في `C:\Projects\SBTS\SBTS-Production` وتأكد أن داخلها مجلد `.git`.
2. انسخ محتويات هذه الحزمة فوق النسخة الحقيقية مع الاحتفاظ بمجلد `.git` وعدم نسخ `node_modules` أو `.env`.
3. افتح `SBTS-Production` نفسه في VS Code.
4. من Railway احذف المتغير `APP_VERSION` إن كان موجوداً؛ هو سبب مباشر لبقاء الرقم `2.1.0` في بعض النشرات القديمة.
5. اضبط Object Storage صراحة باستخدام `STORAGE_BACKEND=s3` ومتغيرات Railway Bucket الموضحة في `RAILWAY_VARIABLES_TEMPLATE.txt`.
6. شغّل:

```text
02_PUSH_UPDATE.cmd
```

السكربت يرفض العمل دون `.git`، يثبت الحزم المقفلة تلقائياً حتى في المجلد
النظيف، يشغّل الفحص الكامل، يتحقق من `origin` وفرع `main`، ثم يقارن الـcommit
المرفوع مع GitHub.

## تحقق النسخة المنشورة

بعد أن تصبح Railway بحالة Success شغّل من نفس مجلد Git:

```powershell
pnpm deploy:verify -- https://YOUR-SERVICE.up.railway.app
```

لا يعتبر Sprint 5 منشوراً إلا إذا أعاد `/health` و`/ready` معاً:

- `version: 2.2.2`
- نفس Git commit الموجود في GitHub `main`
- `database: connected`

## Backfill

لا يعمل backfill الثقيل في كل نشر بعد الآن. عند أول ترقية فقط شغّله يدوياً، أو فعّل `RUN_WORKFLOW_BACKFILL_ON_DEPLOY=true` لنشرة واحدة ثم أعده إلى `false`.
