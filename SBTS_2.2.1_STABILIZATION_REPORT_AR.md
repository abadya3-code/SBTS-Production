# SBTS 2.2.1 — Foundation Stabilized

هذه النسخة تصلح سبب تكرار مشاكل tRPC وGitHub/Railway والثيم:

- أصلحت عقدة `WorkflowActionKey` من المصدر المشترك بدل cast محلي.
- أصبح `pnpm check` يقرأ `actionKey` كـ union مطابق لعقد tRPC.
- حافظت قراءة Areas على كونها read-only بلا seed أو insert.
- نماذج إنشاء Area وProject موجودة ومربوطة بـ tRPC.
- ثبّتت الثيم في Local Storage وفي ملف المستخدم بقاعدة البيانات.
- أضفت Migration 0019 لتوحيد قيم الثيم القديمة.
- شددت Schema Contract وProduction Doctor.
- جعلت Docker build يشغّل TypeScript وVitest قبل الإنتاج.
- أبقيت Demo Seed يدوياً فقط.
- حدّثت الإصدار إلى 2.2.1.

## ملاحظة النشر

وجود ملفات Modified وUntracked في `git status` يعني أنها لم تصل إلى GitHub حتى لو كان الفرع Up to date.
يجب تنفيذ `git add -A` ثم Commit وPush بعد نجاح `pnpm foundation:check`.
