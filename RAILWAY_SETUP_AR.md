# إعداد Railway النهائي — SBTS 2.1

## 1. الخدمات المطلوبة

داخل Project وEnvironment نفسيهما أنشئ:

1. خدمة تطبيق من GitHub.
2. خدمة Railway MySQL.
3. Storage Bucket لاحقًا عند تفعيل المرفقات.

اربط التطبيق بفرع `main`، اترك Root Directory فارغًا، وفعّل Auto Deploy.

## 2. ربط MySQL دون أخطاء

في خدمة التطبيق:

```text
Variables → New Variable → Add Reference → MySQL → MYSQL_URL
```

- الاسم: `DATABASE_URL`
- القيمة: `${{MySQL.MYSQL_URL}}`

احذف أي `DATABASE_URL` قديم أو مكرر. لا تكتب داخل القيمة `DATABASE_URL=` ولا تستخدم localhost.

## 3. المتغيرات الأساسية

```env
NODE_ENV=production
HOST=0.0.0.0
VITE_APP_ID=sbts-production
JWT_SECRET=PUT_A_FIXED_RANDOM_SECRET_OF_AT_LEAST_64_CHARACTERS_HERE
REQUEST_BODY_LIMIT=50mb
STORAGE_REQUIRED=false
ENABLE_MANUS_RUNTIME=false
ENABLE_OAUTH=false
```

لا تضف `PORT`؛ Railway تزوده تلقائيًا.

## 4. إنشاء أو إعادة ضبط Admin مرة واحدة

```env
BOOTSTRAP_ADMIN_ON_DEPLOY=true
ADMIN_NAME=SBTS Administrator
ADMIN_EMAIL=YOUR_REAL_EMAIL
ADMIN_PASSWORD=YOUR_NEW_STRONG_PASSWORD
ADMIN_EMPLOYEE_NUMBER=SBTS-ADMIN
```

كلمة المرور: 12 محرفًا على الأقل، وتحتوي حرفًا كبيرًا وصغيرًا ورقمًا ورمزًا.

خلال Pre-deploy يقوم النظام بـ:

1. فحص المتغيرات.
2. تطبيق جميع migrations.
3. إنشاء Admin أو إعادة ضبط كلمة مرور الحساب الموجود.
4. التحقق فعليًا من الـpassword hash.
5. اختبار إنشاء JWT والتحقق منه.

يجب أن يظهر أحد السطرين:

```text
ADMIN_BOOTSTRAP_CREATED_OK
ADMIN_BOOTSTRAP_RESET_OK
```

ثم تظهر نتيجة Doctor:

```json
{"status":"passed","activeAdmin":true,"sessionRoundTrip":true}
```

إذا لم تتطابق كلمة المرور أو البريد، يفشل الـPre-deploy برسالة واضحة ولا يستبدل النسخة العاملة.

## 5. بعد نجاح الدخول

1. غيّر `BOOTSTRAP_ADMIN_ON_DEPLOY=false`.
2. احذف `ADMIN_PASSWORD`.
3. Deploy Changes مرة أخيرة.
4. لا تغيّر `JWT_SECRET` بعد ذلك إلا عند إلغاء جميع الجلسات عمدًا.

## 6. إعداد البناء

`railway.json` يطلب Dockerfile مباشرة. لا تضع Build/Start Commands يدوية متعارضة في Dashboard.

التسلسل:

```text
Docker locked install
→ release check
→ Vite/Express build
→ pre-deploy validation and migrations
→ admin bootstrap when enabled
→ production doctor
→ node dist/index.js
→ /health
```

## 7. التحقق بعد النشر

```text
https://YOUR-DOMAIN/health
https://YOUR-DOMAIN/ready
```

بعد أن تصبح النسخة Active، افتح نافذة Incognito وسجل الدخول ببيانات `ADMIN_EMAIL` و`ADMIN_PASSWORD` المستخدمة في آخر Bootstrap.

## 8. المرفقات

ابدأ بـ`STORAGE_REQUIRED=false`. عند إضافة Railway Bucket اربط متغيراته S3 ثم غيّرها إلى true بعد اختبار الرفع والحذف.
