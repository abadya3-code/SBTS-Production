# تقرير النسخة النظيفة SBTS 2.1

## النتيجة التنفيذية

أعيد تنظيم النسخة لتكون مصدرًا موحدًا قابلًا للرفع على GitHub والنشر عبر Railway أو أي استضافة Docker + MySQL، مع معالجة المشكلات المتكررة التي ظهرت في المصادقة والجلسات وتهيئة Admin وارتباط قاعدة البيانات والـPre-deploy.

## الإصلاحات الحرجة

- رفض `DATABASE_URL=DATABASE_URL=mysql://...` برسالة واضحة.
- منع استخدام localhost في Production.
- appId ثابت احتياطيًا بدل الجلسات ذات الحقول الفارغة.
- قبول Cookies القديمة التي تحتوي openId صحيحًا مع appId/name ناقصين.
- Cookie SameSite=Lax وSecure خلف Railway proxy.
- إيقاف أخطاء OAuth الوهمية عندما `ENABLE_OAUTH=false`.
- إعادة ضبط كلمة مرور Admin الموجود، وتفعيل الحساب، وإلغاء الـlockout.
- Production Doctor يتحقق من أن كلمة المرور المخزنة تطابق `ADMIN_PASSWORD` بعد Bootstrap.
- Production Doctor يختبر JWT create/verify قبل تشغيل النسخة.
- تحديث React Query cache بعد تسجيل الدخول لمنع إعادة استخدام `auth.me = null`.
- Account lockout حسب إعدادات الأمان.
- Migration جديدة لحقول lockout وpasswordChangedAt وفهرس البريد.
- Dockerfile ثابت على Node 22 ويثبت dev tools اللازمة للبناء والـmigrations ثم يعمل كمستخدم غير root.
- إزالة تثبيت pnpm المكرر من Build.
- Health وReadiness endpoints.
- رسائل migration تتضمن اسم الملف ورقم statement عند الفشل.
- سكربت Git يتبنى تاريخ مستودع `main` الموجود دون Force Push.

## اختبارات تم تنفيذها في بيئة التسليم

- Release structure check: PASS.
- Sprint 2 static acceptance: 73/73.
- Sprint 3 static acceptance: 40/40.
- Sprint 4 static acceptance: 66/66.
- Sprint 5 auth/deployment acceptance: PASS.
- SQL structural validators: PASS.
- TypeScript/TSX syntax parsing: zero parse errors.

## حد التحقق

تعذر تنزيل حزم npm في بيئة التسليم بسبب DNS، لذلك لم يتم الادعاء بأن `pnpm check/test/build` نجحت هنا. Railway/GitHub Actions ستنفذ التثبيت والبناء من lockfile. يظل نجاح الـCI وStaging UAT شرطًا لاعتماد التشغيل الميداني.

## ملفات حساسة مستبعدة

- `.git`
- `.env`
- `node_modules`
- `dist`
- كلمات المرور ومفاتيح Railway/MySQL/S3
