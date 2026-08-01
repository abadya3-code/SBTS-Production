# SBTS 2.2.2 — RC8 Workflow/Dashboard Linkage

## هدف الإصدار

هذا إصدار إصلاحي متدرّج قبل البدء في QR والطباعة ومصمم الـTag. يعالج المسار
الذي تم اختباره ميدانياً: إنشاء Area ثم Project ثم Blind، إكمال قائمة
`Operations Initial Isolation`، إرسال المرحلة، وظهور النتيجة في المشروع
والداشبورد.

## ما تم إصلاحه

- الـDashboard يقرأ حالة الـChecklist الحالية من MySQL ويعرضها لكل Blind.
- إكمال الـChecklist لا يغيّر المرحلة تلقائياً. يظهر زر الإرسال الصريح
  `Complete Initial Isolation` في بانر الجاهزية نفسه.
- بعد قبول الإرسال ينتقل الـBlind إلى `Blind Installation` وتصبح نسبة المشروع
  `13%` (مرحلة واحدة مكتملة من ثماني مراحل).
- نسبة المشروع لم تعد تعتمد على الحقل القديم الثابت؛ تُشتق من
  `blind_workflow_runtime` لكل Blind مسجل.
- تحديث Check وحالة اكتمال المرحلة أصبحا داخل Database Transaction واحدة.
- لا يمكن لقائمة ناقصة أو مفقودة أن تمر عبر بوابة السلامة.
- الأحداث المرفوضة لم تعد تظهر تحت النشاطات الناجحة في الداشبورد.
- تحديث المرحلة يبطل Cache المشروع والقوائم والداشبورد مباشرة.
- أخطاء تحميل الـWorkflow Runtime تظهر للمستخدم مع زر Retry.
- الواجهات التشغيلية والحسابات والإشعارات المتبقية أصبحت English/LTR.

## خطوات التحقق بعد Railway

1. افتح الـBlind الذي أنشأته سابقاً؛ لا تحذف Area أو Project أو بيانات MySQL.
2. افتح `Workflow` وتأكد أن `Operations Initial Isolation` تعرض ثمانية بنود.
3. بعد إكمالها يجب أن يظهر النص `8/8 required complete`.
4. من `Overview` اضغط `Complete Initial Isolation`؛ لا يكفي وضع Check فقط.
5. تأكد أن المرحلة الحالية أصبحت `Blind Installation` وأن Progress أصبح
   `13%` في صفحة الـBlind وصفحة المشروع.
6. افتح Dashboard وتأكد من ظهور الـBlind والمرحلة وChecklist status والنشاط
   المقبول الأخير.
7. نفّذ التحقق الآلي على رابط Railway الجديد:

   ```powershell
   pnpm deploy:verify -- https://YOUR-SERVICE.up.railway.app
   ```

## حدود الإصدار

- لا يحتوي RC8 على Migration جديدة، ولا يحتاج تغيير Railway Variables أو حذف
  قاعدة البيانات.
- لا تعِد تشغيل Demo Seed ولا تحذف البيانات الحالية.
- QR الحقيقي للـBlind وطباعة Tag بقياس 70×110mm وCertificate PDF وTag Designer
  Drag-and-Drop هي حزمة العمل التالية، وليست واجهات مكتملة في RC8.
- Workflow Guard Policies ستُعاد هيكلتها في الإصدار التالي مع إبقاء مفاتيح
  قاعدة البيانات الحالية متوافقة، حتى لا تنكسر إعدادات الإنتاج.
