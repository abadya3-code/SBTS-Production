# SBTS 2.2.2 — RC6 Production Startup Hotfix

## المشكلة

نجح RC5 في البناء والترحيلات ومرحلة pre-deploy، ثم فشل فحص `/ready` لأن
الخادم توقف برسالة:

`ENOENT: no such file or directory, open '/app/dist/package.json'`

كان ملف `server/_core/vite.ts` يستورد إعداد Vite عند تحميل الخادم حتى في
الإنتاج. بعد تجميع الخادم أصبحت قيمة `import.meta.dirname` الخاصة بالإعداد
تشير إلى `/app/dist` بدل جذر المصدر، فحاول الإعداد قراءة ملف غير موجود.

## الإصلاح

- تحميل `vite` و`vite.config.ts` ديناميكيًا داخل `setupVite()` للتطوير فقط.
- إزالة قراءة `package.json` من إعداد Vite وقت التشغيل.
- استخدام `RELEASE_VERSION` الثابت، والذي يتحقق عقد الإصدار من تطابقه مع
  `package.json` و`VERSION` أثناء البناء.
- إضافة اختبار رجعي يمنع الاستيراد الساكن لإعدادات Vite في مسار الإنتاج.

## النتيجة المتوقعة

يبدأ `node dist/index.js` من `/app` من دون الاعتماد على ملفات المصدر داخل
`dist`، يفتح منفذ Railway، ثم ينجح `/health` و`/ready`.

لا يتطلب الإصلاح أي تغيير في MySQL أو Bucket أو متغيرات Railway العشرين.
