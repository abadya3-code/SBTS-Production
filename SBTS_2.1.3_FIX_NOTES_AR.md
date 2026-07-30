# SBTS 2.1.3 — TypeScript Final Fix

إصلاحات هذه النسخة:
- تضييق نوع actionKey في BlindDetailHub إلى WorkflowActionKey.
- إنشاء ndtNumber قبل بناء قيم الإدخال وإزالة مرجع policy غير المعرف.
- ضمان استخدام executionValues فقط عند INSERT لسجل torque جديد.
- إضافة أكواد حظر Workflow الناقصة ومصدر inspection إلى العقد المشترك.

الفحص المطلوب:

```powershell
pnpm install --frozen-lockfile
pnpm release:check
pnpm check
pnpm test
pnpm build
```
