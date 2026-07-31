# تصحيح RC4 — عقد جدول المشاريع في Railway

## ما تم إثباته

- النسخة `2.2.2` موجودة على GitHub في commit يبدأ بـ `1a5ed34`.
- GitHub Actions (`SBTS CI #10`) ناجح.
- Railway Bucket ومتغيرات S3 اجتازت فحص البيئة.
- فشل النشر كان في `schema:contract` فقط.

## السبب الجذري

العمود الفعلي في MySQL اسمه `projectStatus` منذ migration إنشاء جدول
`projects`. كود Drizzle يعرضه داخل TypeScript باسم الخاصية `status`، لكنه يقرأ
ويكتب العمود الفعلي `projectStatus`.

فاحص النشر كان يطلب بالخطأ عمودًا فعليًا إضافيًا اسمه `status`. RC4 يصحح
الفاحص ولا يغيّر الجدول ولا يحذف أو ينسخ أي بيانات.

## طريقة النشر

1. لا تحذف `.git` أو `node_modules` ولا تغيّر متغيرات Railway التي نجحت.
2. انسخ محتويات RC4 فوق مجلد Git الحقيقي:
   `C:\Projects\SBTS\SBTS-Production`
3. اختر Replace ثم شغّل `02_PUSH_UPDATE.cmd`.
4. استخدم وصف commit:
   `Fix projects schema contract for Railway`
5. انتظر GitHub CI ثم Railway. لا تشغّل `deploy:verify` قبل أن تصبح النشرة
   `Success` والخدمة `Online`.

بعد نجاح أول نشر فقط، أعد:

```env
RUN_WORKFLOW_BACKFILL_ON_DEPLOY=false
BOOTSTRAP_ADMIN_ON_DEPLOY=false
```

واحذف `ADMIN_PASSWORD` ثم نفّذ Deploy أخيرًا من Railway.
