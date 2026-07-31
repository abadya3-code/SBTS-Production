# تصحيح RC3 — GitHub CI وRailway

## ما نجح في RC2

- `node_modules` تم تثبيتها من lockfile.
- ملفات 2.2.2 وصلت إلى GitHub في commit جديد `49d3446`.
- `.github/workflows/ci.yml` موجود الآن في المستودع.

## سبب الفشل الجديد

GitHub Actions وجد نسختين من pnpm:

1. `version: 10.4.1` داخل `.github/workflows/ci.yml`.
2. `pnpm@10.4.1+sha512...` داخل `package.json#packageManager`.

pnpm/action-setup يرفض ازدواج المصدر حتى لو كان رقم النسخة الأساسي متطابقاً.
RC3 يحذف تعريف workflow ويعتمد `packageManager` كمصدر واحد.

## التطبيق

لا تحذف المشروع ولا `node_modules` ولا `.git`. انسخ RC3 فوق المجلد الحالي
واختر Replace، ثم شغّل `02_PUSH_UPDATE.cmd` واستخدم وصفاً مثل:

```text
Fix duplicate pnpm version in GitHub CI
```

بعد push يجب أن ينجح GitHub Actions. إذا كان Railway مضبوطاً على Wait for CI،
فلن يبدأ بناء commit الجديد إلا بعد نجاح Action. تأكد أن Railway يعرض commit
الجديد وليس `3748896a`.
