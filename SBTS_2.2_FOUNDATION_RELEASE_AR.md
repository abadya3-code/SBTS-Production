# تقرير إصدار SBTS 2.2 Foundation Clean

## الهدف

هذا الإصدار ليس Sprint ميزات جديدًا. هو إصدار تأسيسي لتنظيف وربط الطبقات
الأساسية قبل متابعة الخطة من Sprint 4 إلى المراحل اللاحقة.

تم بناء النسخة فوق أحدث مصدر `SBTS_2.1.3_Engineering_Clean` مع الحفاظ على
وظائف Sprint 0–5 وإضافة بوابات تمنع تكرار أخطاء MySQL وtRPC وRailway.

## المشاكل التي يعالجها الإصدار

### 1. اختلاف Drizzle وMySQL

- أصبح `drizzle/schema.ts` عقد التطبيق المرجعي.
- أضيف فحص فعلي للجداول والأعمدة والفهارس:
  `pnpm schema:contract`.
- أضيف فحص إنتاج شامل:
  `pnpm doctor`.
- Migration `0018` لم تُعدّل بعد استخدامها؛ عوضًا عن ذلك أضيف مسار توافق
  يقرأ `information_schema` ويضيف الأعمدة الناقصة فقط.

### 2. migrations المتوقفة أو الجزئية

- قفل MySQL يمنع تشغيل نسختين من domain migrations في الوقت نفسه.
- لكل statement سجل checksum وحالة تنفيذ.
- يدعم الإصلاح الاستمرار بعد Deployment جزئي.
- يفشل النشر إذا تغيّر ملف migration سبق تسجيله.

### 3. الكتابة أثناء فتح صفحات القراءة

تم فصل القراءة عن التهيئة:

- فتح Areas أو Projects أو Blind Detail لا يشغّل demo seed.
- استعلامات workflow/inspection/quality/certificate لا تنشئ runtime.
- استعلام Feature Toggles لا ينشئ row تلقائيًا.
- التهيئة أصبحت أوامر Deployment صريحة فقط.

### 4. Demo data في Production

- `data:seed` يدوي.
- يتطلب `SEED_DEMO_DATA=true`.
- محظور في Production إلا مع override صريح لحالة UAT مؤقتة.
- Railway pre-deploy لا يستدعي demo seed.

### 5. Areas وProjects

- نموذج Area كامل مرتبط بـ `trpc.areas.create`.
- نموذج Project كامل مرتبط بـ `trpc.projects.create`.
- Project لا يُنشأ إلا تحت Area موجودة وفعالة.
- Project ID وArea code تتم تسويتهما وفحص التكرار.
- إنشاء Project وربط workflow يتمان في transaction واحدة.
- بعد النجاح يتم تحديث React Query caches تلقائيًا.

### 6. Authentication والجلسة

- JWT مربوط بـ `VITE_APP_ID` من خلال issuer وaudience وappId.
- الجلسة لا تقبل مستخدمًا غير Active.
- الكوكي HttpOnly وSameSite=Lax وSecure في الإنتاج.
- `JWT_SECRET` الضعيف أو الافتراضي يمنع النشر.
- Doctor يختبر إنشاء JWT والتحقق منه داخل بيئة Railway.
- Admin bootstrap ينشئ أو يعيد ضبط الحساب قبل بدء النسخة الجديدة.

### 7. Railway وGitHub

- Docker build موحد وقابل لإعادة البناء.
- GitHub Actions يثبت pnpm قبل setup-node cache.
- `/health` و`/ready` يعرضان Version وGit commit لتأكيد النسخة الفعلية.
- pre-deploy ينفذ بالتسلسل:

```text
deploy:check
→ db:migrate
→ schema:contract
→ system:seed
→ workflow:backfill
→ admin:create عند التفعيل
→ doctor
```

## ملفات جديدة مهمة

- `scripts/seed-system-data.ts`
- `scripts/backfill-workflow-runtime.ts`
- `scripts/verify-schema-contract.ts`
- `server/foundation.contract.test.ts`
- `client/src/components/areas/CreateAreaDialog.tsx`
- `client/src/components/projects/CreateProjectDialog.tsx`

## أوامر القبول قبل Push

```powershell
pnpm install --frozen-lockfile
pnpm release:check
pnpm check
pnpm test
pnpm build
```

أو البوابة الكاملة:

```powershell
pnpm foundation:check
```

## اختبار Railway بعد النشر

1. افتح `/health` وسجل `version` و`commit`.
2. افتح `/ready` وتأكد من `database: connected`.
3. سجل الدخول بحساب Admin.
4. أنشئ Area.
5. أنشئ Project داخل Area.
6. أعد تحميل الصفحة وتأكد من بقاء البيانات.
7. أضف Blind واختبر Blind Detail.
8. راقب Deploy Logs؛ يجب ألا يظهر `insert into blinds` عند مجرد فتح Areas.
9. اجعل `BOOTSTRAP_ADMIN_ON_DEPLOY=false` واحذف `ADMIN_PASSWORD` بعد نجاح
   إعادة الضبط.

## قرار الانتقال إلى Sprint التالي

لا يتم الانتقال قبل تحقق جميع النقاط التالية:

- GitHub CI أخضر.
- Railway deployment ناجح.
- `/health` يعرض Commit المقصود.
- `/ready` ناجح.
- Area وProject وBlind تبقى بعد Refresh.
- لا توجد أخطاء migration أو tRPC في logs.
- تسجيل الدخول والخروج وإعادة الدخول تعمل.
