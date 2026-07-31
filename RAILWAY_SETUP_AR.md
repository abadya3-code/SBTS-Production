# إعداد Railway — SBTS 2.2.2 Sprint 5 Recovery

## 1. اربط المصدر الصحيح

- خدمة التطبيق يجب أن ترتبط بالمستودع `abadya3-code/SBTS-Production` وفرع
  `main` مع Auto Deploy.
- اترك Root Directory فارغاً، واستخدم `railway.json` و`Dockerfile` الموجودين
  في المستودع.
- احذف `APP_VERSION` إن كان موجوداً. هو متغير قديم؛ النسخة والـcommit يُبنيان
  داخل التطبيق ولا يجوز تغييرهما من لوحة Railway.

## 2. MySQL

أضف خدمة Railway MySQL في Project وEnvironment نفسيهما، ثم أضف Reference في
خدمة التطبيق:

```env
DATABASE_URL=${{MySQL.MYSQL_URL}}
```

لا تستخدم `localhost` ولا تكرر المتغير.

## 3. المتغيرات الأساسية والتخزين

ابدأ من `RAILWAY_VARIABLES_TEMPLATE.txt`. القيم الأساسية هي:

```env
NODE_ENV=production
HOST=0.0.0.0
VITE_APP_ID=sbts-production
JWT_SECRET=REPLACE_WITH_RANDOM_SECRET_64_CHARACTERS_OR_MORE
REQUEST_BODY_LIMIT=50mb
STORAGE_REQUIRED=true
STORAGE_BACKEND=s3
RUN_WORKFLOW_BACKFILL_ON_DEPLOY=false
BOOTSTRAP_ADMIN_ON_DEPLOY=false
```

اربط Railway Bucket وأضف القيم التي يولدها إلى `S3_BUCKET` و`S3_ENDPOINT`
و`S3_ACCESS_KEY_ID` و`S3_SECRET_ACCESS_KEY` و`S3_REGION`. لا تضف `PORT`؛
Railway يضبطه تلقائياً. لا تضف `ENABLE_OAUTH` أو `ENABLE_MANUS_RUNTIME`؛ هذه
المسارات أزيلت من إصدار SBTS المستقل.

## 4. الترقية الأولى فقط

عند نشر 2.2.2 لأول مرة على قاعدة تحتوي Blinds قديمة، اضبط:

```env
RUN_WORKFLOW_BACKFILL_ON_DEPLOY=true
```

بعد نجاح النشرة أعده إلى `false`. لا يُشغّل backfill الثقيل في كل نشر.

## 5. إنشاء أو إعادة ضبط Admin مرة واحدة

```env
BOOTSTRAP_ADMIN_ON_DEPLOY=true
ADMIN_NAME=SBTS Administrator
ADMIN_EMAIL=YOUR_REAL_EMAIL
ADMIN_PASSWORD=YOUR_NEW_STRONG_PASSWORD
ADMIN_EMPLOYEE_NUMBER=SBTS-ADMIN
```

استخدم 12 محرفاً على الأقل تشمل كبيراً وصغيراً ورقماً ورمزاً. بعد نجاح الدخول:

1. أعد `BOOTSTRAP_ADMIN_ON_DEPLOY=false`.
2. احذف `ADMIN_PASSWORD`.
3. نفّذ Deploy جديداً.
4. لا تغيّر `JWT_SECRET` إلا إذا أردت إلغاء جميع الجلسات.

## 6. ما يحدث قبل تشغيل النسخة

```text
فحص المتغيرات وهوية الإصدار
→ تطبيق Drizzle migrations
→ تطبيق SBTS domain migrations ذات checksums
→ فحص عقد MySQL
→ تحديث الصلاحيات والقالب القياسي دون Demo data
→ backfill اختياري لأول ترقية
→ bootstrap اختياري للمدير
→ Production Doctor
→ تشغيل التطبيق كمستخدم غير root
→ /ready
```

أي خطأ يوقف النشرة قبل استبدال النسخة العاملة.

## 7. إثبات أن Railway شغّل المصدر الجديد

بعد أن تصبح النشرة Success، شغّل من نسخة Git الحقيقية:

```powershell
pnpm deploy:verify -- https://YOUR-SERVICE.up.railway.app
```

يجب أن يعيد كل من:

```text
https://YOUR-SERVICE.up.railway.app/health
https://YOUR-SERVICE.up.railway.app/ready
```

القيم التالية:

- `version: 2.2.2`
- commit مطابق لآخر commit على GitHub `main`
- `/ready`: `database: connected`

إذا بقيت 2.1.0 فالمشكلة ليست Cache: Railway يبني commit قديماً أو خدمة مرتبطة
بمستودع/فرع آخر. افحص Source وDeploy Commit في Railway وقارنه بنتيجة
`git rev-parse HEAD`.

## 8. Demo data

لا يتم تشغيل Demo data في Railway. يمكن تشغيل `pnpm data:seed` يدوياً في UAT
مؤقت فقط مع `SEED_DEMO_DATA=true` و`ALLOW_DEMO_DATA_IN_PRODUCTION=true`، ولا
تستخدم ذلك في قاعدة الإنتاج.
