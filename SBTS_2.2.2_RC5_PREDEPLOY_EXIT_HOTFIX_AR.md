# SBTS 2.2.2 — RC5 Pre-deploy Exit Hotfix

## المشكلة

أنهى `pnpm system:seed` عمله وظهر السطر
`SBTS_SYSTEM_REFERENCE_DATA_READY`، لكن عملية Node.js بقيت فعالة لأن مجمع
اتصالات Drizzle/MySQL لم يُغلق. نتيجة ذلك بقي Railway في مرحلة pre-deploy
حتى انتهاء المهلة، ولم يصل إلى إنشاء المدير أو فحص الجاهزية أو تشغيل الخادم.

## الإصلاح

- أضيفت دالة مركزية `closeDb()` لإغلاق مجمع MySQL بأمان.
- أصبحت سكربتات CLI تستدعي الإغلاق داخل `finally` سواء نجحت أو فشلت:
  - `system:seed`
  - `admin:create`
  - `workflow:backfill`
  - `data:seed`
- أضيف اختبار عقد يمنع رجوع مشكلة بقاء أوامر pre-deploy معلقة.

## النتيجة المتوقعة في Railway

بعد `SBTS_SYSTEM_REFERENCE_DATA_READY` ينتقل السجل مباشرة إلى:

1. `ADMIN_BOOTSTRAP_CREATED_OK` أو `ADMIN_BOOTSTRAP_RESET_OK`.
2. نتيجة `pnpm doctor` بحالة `status: passed`.
3. تشغيل `node dist/index.js` ونجاح `/ready`.

لا يتطلب هذا الإصلاح حذف قاعدة البيانات أو Bucket أو تغيير متغيرات Railway.
