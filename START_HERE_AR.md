# ابدأ من هنا — SBTS 2.1 Clean Release

هذه نسخة مصدر كاملة ونظيفة، لا تحتوي على `.git` أو `.env` أو `node_modules` أو `dist` أو كلمات مرور.

## الطريقة الموصى بها لمستودعك الحالي

1. احتفظ بنسخة احتياطية من مجلد `SBTS-Master` الحالي.
2. فك ضغط الحزمة الجديدة في مسار ثابت، مثل:

```text
C:\Projects\SBTS\SBTS-2.1-Clean
```

3. افتح هذا المجلد نفسه في VS Code.
4. شغّل مرة واحدة:

```text
01_CONNECT_GITHUB_ONCE.cmd
```

السكربت يتصل بـGitHub، ويجلب تاريخ فرع `main` الحالي عند وجوده، ثم يرفع النسخة النظيفة كـCommit جديد دون Force Push.

## التحديثات المستقبلية

بعد أي تعديل أو بعد نسخ ملفات تحديث جديدة إلى نفس المجلد:

```text
02_PUSH_UPDATE.cmd
```

أو:

```powershell
git add .
git commit -m "وصف التحديث"
git push origin main
```

ومع تفعيل Auto Deploy يصبح المسار:

```text
VS Code → GitHub main → Railway → الموقع المباشر
```

## قبل Railway

اقرأ `RAILWAY_SETUP_AR.md`. أهم قاعدة: متغير `DATABASE_URL` يكون اسمه `DATABASE_URL` وقيمته المرجعية فقط:

```text
${{MySQL.MYSQL_URL}}
```

ولا تكتب `DATABASE_URL=` داخل خانة القيمة.
