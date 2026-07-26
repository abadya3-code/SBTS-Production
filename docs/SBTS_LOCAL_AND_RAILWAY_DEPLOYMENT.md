# SBTS Professional — Local & Railway Deployment Guide

**Target release:** `2.0.0-beta.4`  
**Stack:** React + Vite + Express + tRPC + Drizzle ORM + MySQL/TiDB + S3-compatible object storage

> هذا الدليل مخصص لتشغيل SBTS محليًا على Windows ثم نشره على Railway بطريقة آمنة. نفّذ أول نشر على **Staging** وليس Production.

---

## 1. مكونات التشغيل

SBTS يحتاج إلى:

1. Node.js 22 LTS.
2. pnpm 10 عبر Corepack.
3. MySQL 8 أو TiDB.
4. Object Storage متوافق مع S3 للصور والوثائق.
5. متغير `JWT_SECRET` قوي للجلسات.

محليًا يوفر الملف `docker-compose.local.yml`:

- MySQL على المنفذ `3307`.
- MinIO S3 على المنفذ `9000`.
- MinIO Console على المنفذ `9001`.
- Bucket باسم `sbts`.

على Railway استخدم:

- Railway MySQL Service.
- Railway Storage Bucket.
- SBTS Application Service.

---

# Part A — التشغيل محليًا Local

## 2. المتطلبات على Windows

ثبّت:

- Git.
- Node.js 22 LTS.
- Docker Desktop.

افتح PowerShell وتحقق:

```powershell
node --version
docker --version
git --version
```

يفضل أن يكون Node:

```text
v22.x.x
```

---

## 3. فك الملف والدخول للمشروع

مثال:

```powershell
cd C:\SBTS
Expand-Archive .\SBTS_Sprint4_Professional.zip -DestinationPath .\sbts-professional
cd .\sbts-professional
```

عند استخدام Git:

```powershell
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd sbts-professional
```

---

## 4. إنشاء ملف البيئة

```powershell
Copy-Item .env.example .env
```

أنشئ Secret قويًا:

```powershell
node -e "console.log(require('crypto').randomBytes(64).toString('base64url'))"
```

افتح `.env` واستبدل:

```env
JWT_SECRET=ضع_القيمة_الطويلة_هنا
ADMIN_NAME=SBTS Administrator
ADMIN_EMAIL=admin@your-company.com
ADMIN_PASSWORD=Strong-Admin-Password-123!
```

الإعدادات الافتراضية المحلية تكون:

```env
DATABASE_URL=mysql://sbts:sbts_local_password@127.0.0.1:3307/sbts
S3_BUCKET=sbts
S3_ENDPOINT=http://127.0.0.1:9000
S3_ACCESS_KEY_ID=sbts_minio_admin
S3_SECRET_ACCESS_KEY=sbts_minio_local_password
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true
```

لا تستخدم كلمات المرور المحلية في Production.

---

## 5. تشغيل MySQL وMinIO

```powershell
docker compose -f docker-compose.local.yml up -d
```

تحقق:

```powershell
docker compose -f docker-compose.local.yml ps
```

يجب أن ترى MySQL وMinIO بحالة Healthy.

MinIO Console:

```text
http://localhost:9001
```

بيانات الدخول المحلية:

```text
Username: sbts_minio_admin
Password: sbts_minio_local_password
```

---

## 6. تثبيت الحزم

```powershell
corepack enable
corepack prepare pnpm@10.4.1 --activate
pnpm install --frozen-lockfile
```

عند حدوث مشكلة في Corepack، ثبّت pnpm:

```powershell
npm install -g pnpm@10.4.1
```

---

## 7. تطبيق قاعدة البيانات

نفّذ:

```powershell
pnpm db:migrate
```

الأمر ينفذ جزأين:

```text
Drizzle migrations 0000–0012
+
SBTS domain migrations 0013–0016
```

المراحل الجديدة تُسجل في الجدول:

```text
sbts_domain_migrations
sbts_domain_migration_steps
```

ويتم حفظ SHA-256 لكل Migration ولكل SQL statement. الجداول `sbts_domain_migrations` و`sbts_domain_migration_steps` تسمحان باستكمال Migration متوقفة من آخر statement مسجلة وتمنع تعديل ملفات سبق تطبيقها.

### قاعدة بيانات سبق تطبيق Sprint 1–3 عليها يدويًا

لا تستخدم Baseline إلا بعد التأكد من وجود الجداول والأعمدة فعلًا.

مثال: إذا كانت Migrations `0013` إلى `0015` مطبقة سابقًا، ولم تطبق `0016`:

```powershell
$env:SBTS_DOMAIN_MIGRATION_BASELINE_UP_TO="15"
pnpm db:migrate:domain
Remove-Item Env:SBTS_DOMAIN_MIGRATION_BASELINE_UP_TO
```

هذا يسجل 0013–0015 دون تنفيذها ثم يطبق 0016.

> لا تضع القيمة `16` إلا إذا Sprint 4 مطبقة فعليًا. أخذ Backup إلزامي قبل Baseline.

---

## 8. إنشاء أول Admin

بعد نجاح Migrations:

```powershell
pnpm admin:create
```

يقرأ الأمر:

```env
ADMIN_NAME
ADMIN_EMAIL
ADMIN_PASSWORD
ADMIN_EMPLOYEE_NUMBER
```

بعد إنشاء الحساب احذف `ADMIN_PASSWORD` من `.env` أو غيّره إلى قيمة غير مستخدمة.

---

## 9. تشغيل التطبيق

```powershell
pnpm dev
```

افتح:

```text
http://localhost:3000
```

Health Checks:

```powershell
Invoke-RestMethod http://localhost:3000/health
Invoke-RestMethod http://localhost:3000/ready
```

- `/health`: يثبت أن خدمة Node تعمل.
- `/ready`: يثبت أن التطبيق متصل بقاعدة البيانات.

---

## 10. الفحوصات المحلية

```powershell
pnpm sprint2:verify
pnpm sprint3:verify
pnpm sprint4:verify
pnpm check
pnpm test
pnpm build
```

أو جميعها:

```powershell
pnpm verify
```

لا تنتقل إلى Railway إذا فشل `check` أو `test` أو `build`.

---

## 11. إيقاف البيئة المحلية

إيقاف الخدمات مع الاحتفاظ بالبيانات:

```powershell
docker compose -f docker-compose.local.yml down
```

حذف البيانات المحلية بالكامل:

```powershell
docker compose -f docker-compose.local.yml down -v
```

الأمر الثاني يحذف قاعدة البيانات والملفات المحلية نهائيًا.

---

# Part B — رفع المشروع إلى GitHub

## 12. إنشاء Repository

```powershell
git init
git add .
git commit -m "SBTS Sprint 4 production foundation"
git branch -M main
git remote add origin <YOUR_GITHUB_REPOSITORY_URL>
git push -u origin main
```

تأكد أن الملفات التالية لا ترفع:

```text
.env
node_modules/
dist/
```

ولا تضع أسرار Railway داخل GitHub.

---

# Part C — النشر على Railway عبر GitHub

## 13. إنشاء Project

1. افتح Railway.
2. اختر **New Project**.
3. اختر **Deploy from GitHub Repo**.
4. اختر Repository الخاص بـSBTS.
5. سمِّ خدمة التطبيق مثلًا:

```text
SBTS-App
```

لا تنشر Production قبل تجهيز MySQL وBucket والمتغيرات.

---

## 14. إضافة MySQL

داخل نفس Railway Project:

1. اختر `+ New`.
2. اختر `Database`.
3. اختر `MySQL`.
4. سمِّ الخدمة:

```text
MySQL
```

في خدمة `SBTS-App` افتح Variables وأضف Reference Variable:

```text
DATABASE_URL = ${{MySQL.MYSQL_URL}}
```

استخدم زر **Add Reference** من واجهة Railway لتجنب خطأ اسم الخدمة.

---

## 15. إضافة Railway Storage Bucket

داخل نفس المشروع:

1. اختر `+ New`.
2. اختر `Bucket` أو `Storage Bucket`.
3. سمِّه:

```text
SBTS-Bucket
```

Railway Bucket يوفر متغيرات S3-compatible التالية:

```text
BUCKET
ENDPOINT
ACCESS_KEY_ID
SECRET_ACCESS_KEY
REGION
```

في Variables الخاصة بـ`SBTS-App` أضف Reference لكل متغير من خدمة الـBucket بنفس الاسم:

```text
BUCKET=${{SBTS-Bucket.BUCKET}}
ENDPOINT=${{SBTS-Bucket.ENDPOINT}}
ACCESS_KEY_ID=${{SBTS-Bucket.ACCESS_KEY_ID}}
SECRET_ACCESS_KEY=${{SBTS-Bucket.SECRET_ACCESS_KEY}}
REGION=${{SBTS-Bucket.REGION}}
```

لا تجعل Bucket عامًا. التطبيق يصدر Signed URL مؤقتة عن طريق `/storage/*`.

---

## 16. متغيرات تطبيق Railway

أضف إلى `SBTS-App`:

```env
NODE_ENV=production
HOST=0.0.0.0
JWT_SECRET=<64+ RANDOM CHARACTERS>
REQUEST_BODY_LIMIT=50mb
S3_FORCE_PATH_STYLE=true
```

Railway يحدد `PORT` تلقائيًا، لذلك لا تضع رقمًا ثابتًا له في Production.

أنشئ JWT_SECRET محليًا ثم انسخه:

```powershell
node -e "console.log(require('crypto').randomBytes(64).toString('base64url'))"
```

---

## 17. Build وMigration وStart

المشروع يحتوي على `railway.json`:

```json
{
  "build": {
    "buildCommand": "corepack enable && pnpm install --frozen-lockfile --prod=false && pnpm build"
  },
  "deploy": {
    "preDeployCommand": "pnpm db:migrate",
    "startCommand": "pnpm start",
    "healthcheckPath": "/health"
  }
}
```

الـPre-Deploy Migration تعمل بعد Build وقبل تحويل الترافيك للنسخة الجديدة. عند فشل Migration لا يفترض أن تصبح النسخة الجديدة Live.

راجع في Railway:

```text
Settings → Deploy
```

وتأكد من:

```text
Healthcheck Path: /health
Start Command: pnpm start
Pre-Deploy Command: pnpm db:migrate
```

---

## 18. إنشاء Public Domain

في خدمة `SBTS-App`:

```text
Settings → Networking → Generate Domain
```

مثال:

```text
https://sbts-production.up.railway.app
```

بعد الدخول إلى التطبيق:

```text
Settings → Workflow & Safety → Certificate Governance
```

ضع:

```text
Public Verification Base URL = https://YOUR-DOMAIN
```

---

## 19. إنشاء Admin على Railway

### الطريقة الأفضل: Railway SSH

أضف مؤقتًا إلى Variables:

```env
ADMIN_NAME=SBTS Administrator
ADMIN_EMAIL=admin@your-company.com
ADMIN_PASSWORD=<STRONG PASSWORD>
ADMIN_EMPLOYEE_NUMBER=SBTS-ADMIN
```

ثبّت Railway CLI ثم:

```powershell
railway login
railway link
railway service
railway ssh
```

بعد دخول جلسة SSH نفّذ داخل الخدمة:

```bash
pnpm admin:create
exit
```

يمكنك نسخ أمر SSH الدقيق من Railway Dashboard عبر **Copy SSH Command** إذا كان المشروع يحتوي أكثر من Environment أو Service.

بعد نجاح الإنشاء:

1. احذف `ADMIN_PASSWORD` من Railway Variables.
2. Deploy التغييرات.
3. سجّل الدخول وغير كلمة المرور من Profile عند الحاجة.

بديلًا يمكن تشغيل الأمر محليًا بمتغيرات Railway:

```powershell
railway run pnpm admin:create
```

لكن هذا يتطلب أن يكون اتصال قاعدة البيانات متاحًا من جهازك. `railway ssh` أكثر موثوقية عندما يستخدم MySQL private networking.

---

# Part D — النشر من الكمبيوتر مباشرة عبر Railway CLI

## 20. CLI Upload

بعد إنشاء Railway Project وMySQL وBucket من Dashboard:

```powershell
railway login
railway link
railway up
```

`railway up` يضغط ويرفع مجلد المشروع الحالي إلى الخدمة المرتبطة.

للتأكد من البيئة المستهدفة:

```powershell
railway status
```

لرفع Staging:

```powershell
railway up --environment staging
```

ولعرض Logs:

```powershell
railway logs
```

---

# Part E — Staging E2E Validation

## 21. فحص الخدمة السريع

```powershell
$env:SBTS_BASE_URL="https://YOUR-STAGING-DOMAIN"
pnpm staging:smoke
```

يفحص:

- `/health`
- `/ready`
- الصفحة الرئيسية

---

## 22. فحص E2E مصادق عليه

جهّز مشروعًا وBlind اختبارية على Staging، ثم:

```powershell
$env:SBTS_E2E_BASE_URL="https://YOUR-STAGING-DOMAIN"
$env:SBTS_E2E_EMAIL="e2e.admin@your-company.com"
$env:SBTS_E2E_PASSWORD="E2E-Strong-Password"
$env:SBTS_E2E_PROJECT_ID="PROJECT-ID"
$env:SBTS_E2E_BLIND_TAG="BLIND-TAG"
$env:SBTS_E2E_EXPECT_CLOSED="false"
pnpm staging:e2e
```

الفحص يتحقق من:

- Health وReadiness.
- Login والجلسة.
- Project ↔ Blind linkage.
- Canonical Workflow Runtime.
- وجود ثماني Phase Instances.
- RBAC projection.
- Defect/Punch/NDT APIs.
- Certificate readiness/history.

بعد إغلاق دورة Blind وإصدار الشهادة:

```powershell
$env:SBTS_E2E_EXPECT_CLOSED="true"
$env:SBTS_E2E_CERTIFICATE_TOKEN="TOKEN-FROM-ISSUED-CERTIFICATE"
pnpm staging:e2e
```

ويضاف فحص:

- Lifecycle = CLOSED.
- Runtime Locked.
- Issued Certificate موجودة.
- SHA-256 Hash صحيح.
- Public verification لا تكشف PTW/LOTO/Gas Test.

---

## 23. السيناريوهات الميدانية الإلزامية

نفّذ على Staging قبل Pilot:

1. Spectacle Blind lifecycle كامل.
2. Slip Blind مع Metal Foreman conditional approval.
3. Gas Test منتهي يمنع المرحلة.
4. Calibration منتهية تمنع Torque acceptance.
5. Defect بلا disposition يمنع Ready for Closure.
6. Mandatory Punch مفتوح يمنع Closure.
7. NDT failed/retest يمنع Closure.
8. الشخص نفسه لا يعتمد Defect/Punch/NDT الذي نفذه.
9. Safety Hold يمنع جميع transitions.
10. Independent Safety Hold release يعيد الحالة السابقة.
11. Leak Test failed يمنع Final Approval.
12. Certificate issue قبل إغلاق Workflow مرفوض.
13. Controlled Reissue ينشئ Version جديد ويحفظ القديم Superseded.
14. Revocation تحفظ السبب وتظهر Public Verification = Revoked.
15. S3 Evidence upload/open/delete.
16. تحديث متزامن من مستخدمين يؤدي إلى Record Version conflict.
17. Mobile/Tablet field actions.
18. Backup Restore Drill.

سجّل نتائج السيناريوهات في `SBTS_Sprint4_Staging_UAT_Checklist.md`.

---

# Part F — النسخ الاحتياطي والترقية

## 24. قبل كل Migration

- خذ MySQL Backup.
- اختبر Restore على Staging.
- احتفظ بنسخة الكود السابقة.
- نفذ `pnpm sprint4:verify`.
- راجع Migration checksum.

لا تعدّل ملف Migration سبق تسجيله في:

```text
sbts_domain_migrations
sbts_domain_migration_steps
```

أنشئ Migration جديدة بدل تعديل القديمة.

---

## 25. Rollback

Sprint 4 Migration additive، لكن Rollback الصحيح يكون:

1. إعادة نشر نسخة التطبيق السابقة.
2. عدم حذف جداول Sprint 4 أثناء الحادث.
3. استعادة Backup فقط عند فساد البيانات.
4. حفظ Certificate snapshots وسجل Audit.

إعادة نشر نسخة قديمة لا تعني حذف بيانات Defect/Punch/NDT أو Certificates.

---

# Part G — مشاكل شائعة

## التطبيق يعرض 502 على Railway

تحقق من:

- التطبيق يستخدم `PORT` الذي يضعه Railway.
- Host هو `0.0.0.0`.
- `/health` يرجع 200.
- Build انتهى بنجاح.

## `/ready` يرجع 503

تحقق من:

- `DATABASE_URL` Reference صحيح.
- MySQL Service تعمل.
- Migration نجحت.
- لا تستخدم localhost في Railway.

## رفع الصور يفشل

تحقق من متغيرات Bucket:

```text
BUCKET
ENDPOINT
ACCESS_KEY_ID
SECRET_ACCESS_KEY
REGION
```

وتأكد من `S3_FORCE_PATH_STYLE=true`.

## Migration تقول Duplicate Column

هذا يعني أن Migration طُبقت سابقًا دون تسجيلها.

- لا تعاود التنفيذ عشوائيًا.
- افحص Schema.
- استخدم `SBTS_DOMAIN_MIGRATION_BASELINE_UP_TO` فقط بعد التحقق والـBackup.

## لا يوجد Admin

نفّذ:

```powershell
railway ssh pnpm admin:create
```

بعد وضع متغيرات ADMIN مؤقتًا.

---

# Part H — Official Railway References

- Express deployment: https://docs.railway.com/guides/express
- MySQL: https://docs.railway.com/databases/mysql
- Storage Buckets: https://docs.railway.com/storage-buckets
- Pre-deploy commands: https://docs.railway.com/deployments/pre-deploy-command
- Healthchecks: https://docs.railway.com/deployments/healthchecks
- Config as Code: https://docs.railway.com/config-as-code/reference
- Railway CLI deploying: https://docs.railway.com/cli/deploying
- Railway SSH: https://docs.railway.com/cli/ssh

---

# Production Release Gate

لا تعتمد Production إلا بعد:

```text
pnpm verify = PASS
Staging E2E = PASS
Manual UAT = PASS
Security Review = PASS
Backup Restore = PASS
Zero Critical Defects
```
