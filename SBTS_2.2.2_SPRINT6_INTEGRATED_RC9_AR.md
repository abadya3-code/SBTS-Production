# SBTS 2.2.2 — Sprint 6 Integrated RC9

هذا الإصدار هو تحديث واحد مترابط بعد استقرار Sprint 5. لا يغيّر عقد النشر
القائم، ولا يحتاج رفع `node_modules` أو `dist` إلى GitHub.

## ما تم ربطه

### 1. QR آمن لكل Blind

- لكل Blind رمز تحقق مستقل وعشوائي بطول أمني 256-bit.
- الحالات المدعومة: Active، Superseded، Revoked.
- التدوير يلغي صلاحية النسخة المطبوعة السابقة، والإلغاء يحتاج سبباً مسجلاً.
- صفحة التحقق العامة تعرض قائمة بيانات مسموحة فقط؛ لا تعرض بيانات PTW أو LOTO
  أو Evidence أو المستخدمين أو الملاحظات الداخلية.
- الإصدار والتدوير والإلغاء والفحص والطباعة تدخل في سجل العمليات، وتولّد عناصر
  مناسبة في Operations Inbox.

### 2. طباعة Tag حقيقية

- المقاس الافتراضي 70 × 110 mm مع فتحة ثابتة في أعلى المنتصف.
- QR المطبوع يفتح رابط التحقق الحقيقي؛ لا توجد صورة تجريبية أو JSON داخل QR.
- مركز الطباعة يسمح باختيار Blind واحد أو مجموعة، وإنشاء الرموز الناقصة، ثم
  الطباعة أو الحفظ PDF من نافذة الطباعة.
- لا يسمح النظام بتحضير الطباعة إذا كان أي Blind مختار بلا QR نشط.

### 3. Default Tag Designer

- سحب وإفلات، تغيير حجم، تحريك بالأسهم، Snap to Grid، إظهار/إخفاء الحقول،
  الخط، الحجم، الوزن، المحاذاة والألوان.
- حدود الخادم تمنع أي عنصر من الخروج خارج مساحة الطباعة.
- ثلاثة قوالب محفوظة مستقلة في قاعدة البيانات.

### 4. الشهادات والتقارير

- الشهادة النهائية لا تُنشأ من بيانات حية قابلة للتغيير؛ يجب إصدار Snapshot
  محكوم ومقفول ومجزأ SHA-256 بعد اجتياز البوابات.
- صفحة الشهادة تعرض QR تحقق حقيقياً وتدعم Print / Save PDF.
- Project Blind Register منفصل بوضوح عن الشهادات وعن Tags.

### 5. Workflow Guard وDashboard

- بقي الانتقال بين المراحل إجراءً صريحاً من مستخدم مخوّل وتحت تحقق الخادم؛
  إكمال Checklist لا ينقل المرحلة تلقائياً.
- إعدادات Workflow Guard مقسمة إلى مجموعات واضحة: Lifecycle، Checklist،
  Evidence، Approval، Safety Hold، Isolation، Quality، Certificates، UI.
- بيانات Dashboard تستمر بالاعتماد على Canonical eight-phase runtime في MySQL.

### 6. Inbox وNotifications

- Active Inbox وArchive مع فلاتر Unread وType وPriority.
- Archive وRestore وDelete وMark Read مربوطة بمالك الإشعار فقط.
- Smart Links تعيد المستخدم مباشرة للمشروع أو Blind أو مركز طباعة Tags.
- تشمل الأحداث: انتقالات Workflow، QR، الشهادة، وطباعة Tags.

### 7. أداء الواجهة

- تم تقسيم تحميل Routes؛ صفحات PDF والتقارير والإعدادات وتفاصيل المشروع لا
  تُحمّل قبل الحاجة إليها، وانتهى تحذير الحزمة الرئيسية الكبيرة في Vite.

### 8. تقوية أمان الطباعة

- جميع تقارير HTML تمر عبر تنظيف DOM مركزي قبل فتح نافذة الطباعة.
- بيانات قاعدة البيانات وإعدادات الشهادة تُرمّز قبل إدخالها في مستند الطباعة.
- مُنعت عناصر Script وIframe وObject وEmbed وForm، وأُلغي وصول نافذة التقرير
  إلى نافذة التطبيق الأصلية.
- أُخفيت إجراءات Share وDelete غير المكتملة بدلاً من عرض أزرار لا تنفذ عملاً
  فعلياً.

## قاعدة البيانات

يضيف الإصدار Migration التالية تلقائياً أثناء Railway Pre-deploy:

`drizzle/0020_sprint6_qr_print_inbox_designer.sql`

وهي Migration إضافية وغير هدامة وقابلة للاستئناف. كما تم تحديث:

- Schema Contract
- Portable Domain Migration Recovery
- Production Doctor
- Release Structure Check

## نتائج التحقق المحلية

- TypeScript: صفر أخطاء.
- Syntax validation: 239 ملفاً، صفر أخطاء.
- Vitest: 296/296 اختباراً ناجحاً في 33 ملف اختبار.
- Production build: ناجح.
- Release structure contract: ناجح.

## طريقة النشر

1. فك الحزمة وانسخ الملفات داخل النسخة الحقيقية المرتبطة بـGitHub، مع الإبقاء
   على مجلد `.git` الموجود فيها.
2. لا تنسخ `node_modules` أو `.env` أو `dist`.
3. شغّل `02_PUSH_UPDATE.cmd` مرة واحدة.
4. انتظر GitHub Actions ثم Railway حتى تصبح الحالة Success / Online.
5. نفّذ فحص الإثبات على رابط Railway:

```powershell
pnpm deploy:verify -- https://YOUR-SERVICE.up.railway.app
```

يجب أن يعرض `/health` و`/ready` الإصدار `2.2.2` ونفس Git commit وحالة قاعدة
البيانات Connected.

## حدود مقصودة

- Offline QR caching غير مفعّل حتى تُنفّذ ضوابط تشفير الجهاز والانتهاء
  والإلغاء عن بعد وتسوية تعارضات المزامنة.
- يجب تنفيذ Cybersecurity وSafety وOperational UAT الرسمي قبل اعتماد النظام
  كحاجز سلامة إنتاجي وحيد.
