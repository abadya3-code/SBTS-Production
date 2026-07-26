# SBTS 2.1.1 — tRPC / Database Schema Hotfix

## ما تم إصلاحه

- إضافة Migration `0018_sprint6_schema_alignment.sql`.
- إضافة أعمدة Blind Detail Hub المفقودة إلى جدول `blinds`.
- إنشاء جدول `feature_toggles` وإضافة السجل الافتراضي رقم 1.
- منع عمليات القراءة `areas.list` و`projects.list` وعمليات Blinds من تشغيل Demo Seed.
- إضافة أمر مستقل `pnpm data:seed`.
- تشغيل Demo Seed في Railway فقط عندما تكون `SEED_DEMO_DATA=true`.
- تقوية Production Doctor لفحص Migration 0018 والجداول والأعمدة المطلوبة.

## Railway UAT

أضف مؤقتًا: `SEED_DEMO_DATA=true` لإدخال بيانات الاختبار. بعد انتهاء UAT غيّرها إلى `false`.

لا تحذف قاعدة البيانات ولا تعدّل `DATABASE_URL`. عند النشر سيطبق pre-deploy Migration 0018 آليًا.
