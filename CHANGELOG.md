# CHANGELOG — SBTS Professional Edition

## 2.2.2 — Sprint 6 Integrated RC9

- Added secure, per-Blind QR lifecycle governance with unpredictable tokens,
  controlled generation, rotation and revocation, public allowlisted
  verification, scan counters, workflow audit records and operations inbox
  events.
- Added a physical 70 × 110 mm Blind Tag print center. Tags use only active
  verification URLs, the saved layout contract and a fixed top-center hole;
  no JSON payload or decorative placeholder can be printed as a QR code.
- Rebuilt Default Tag Settings as a bounded drag-and-drop designer with resize,
  typography, alignment, visibility, physical dimensions and three reusable
  database-backed templates.
- Separated the operational Project Blind Register from immutable governed
  certificates. Certificate printing and PDF saving now use only issued,
  versioned, SHA-256-verified snapshots with a real verification QR.
- Reorganized Workflow Guard Policies into clear operational sections while
  preserving server-authorized, explicit phase submission and the canonical
  eight-phase state machine.
- Upgraded Notifications into an operations inbox with active/archive scopes,
  unread/type/priority filters, ownership-enforced actions, smart links and
  workflow/certificate/QR/tag events.
- Added portable migration `0020_sprint6_qr_print_inbox_designer.sql`, hosted
  schema validation, production-doctor coverage and resumable recovery steps.
- Kept production UI copy English/LTR and explicitly disabled unsupported
  offline QR caching until its device-security controls are implemented.
- Split application routes into lazy production chunks so PDF, reports,
  settings and project-detail code no longer delay the initial workspace load.
- Centralized generated-report printing behind DOM sanitization, escaped
  database-backed report values, removed opener access and hid incomplete
  Share/Delete actions instead of presenting non-functional controls.
- Verified 296 Vitest tests, zero TypeScript errors, zero syntax errors and a
  successful production build.

## 2.2.2 — Sprint 5 Recovery RC8

- Connected the current canonical checklist state to the production Dashboard,
  including a dedicated checklist-complete metric and per-Blind status.
- Added an explicit phase-completion action to the readiness banner so the
  authorized operator can advance safely without leaving the Overview tab.
- Derived project progress from the canonical eight-phase runtime: completing
  the first phase now reports 13%, while CLOSED reports 100%.
- Made checklist response and phase-readiness updates atomic, rejected unknown
  checklist items, and prevented missing/partial canonical checklist rows from
  passing a safety gate.
- Filtered Dashboard activity to accepted and authorized override transitions,
  invalidated all affected live queries after advancement, and exposed runtime
  loading errors with a retry action.
- Standardized the remaining production authentication, account, notification,
  navigation, and administration UI on English/LTR copy.
- Added regression coverage for the checklist safety invariant, canonical
  project progress, explicit submission, dashboard linkage, and cache refresh.

## 2.2.2 — Sprint 5 Recovery RC7

- Fixed the Drizzle mapping for `workflow_transition_events` so dashboard and
  workflow-event queries use the physical `fromPhaseKey` and `toPhaseKey`
  columns instead of the nonexistent `phaseKey` column.
- Extended the hosted schema contract to validate both transition phase
  columns before application startup.
- Added generated-SQL regression coverage for the dashboard/event mapping.

## 2.2.2 — Sprint 5 Recovery RC6

- Fixed production startup resolving Vite's source-root `package.json` as
  `/app/dist/package.json` after the server bundle moved `import.meta.dirname`.
- Made Vite and `vite.config.ts` development-only dynamic imports and sourced
  the client release version from the immutable server release constant.
- Added regression coverage that prevents source-only Vite configuration from
  being evaluated during production startup.

## 2.2.2 — Sprint 5 Recovery RC5

- Fixed Railway pre-deploy commands remaining alive after successful database
  work by closing the shared Drizzle/MySQL pool in standalone CLI scripts.
- Added regression coverage for system seeding, administrator bootstrap,
  workflow backfill, and optional demo seeding process termination.

## 2.2.2 — Sprint 5 Recovery RC4

- Corrected the hosted MySQL schema contract to validate the physical
  `projects.projectStatus` column used by the original migration and current
  Drizzle mapping, instead of incorrectly requiring a duplicate `status`
  column.
- Added a regression contract that keeps the Drizzle property alias, physical
  database column, and deployment validator aligned.

## 2.2.2 — Sprint 5 Recovery Release Candidate

- Removed the duplicate pnpm version from GitHub Actions; CI now reads the
  single pinned version from `package.json#packageManager`.
- Fixed clean-clone publishing by installing frozen dependencies inside
  `02_PUSH_UPDATE.ps1` before validation.
- Kept `.github/workflows/ci.yml` in the Docker build context because release
  and regression contracts validate the CI setup during Railway builds.
- Embedded one immutable version/commit identity across server and browser.
- Added Git publish verification and post-deployment `/health` + `/ready` proof.
- Replaced raw authentication rows with an allow-listed AuthUser DTO and
  invalidated sessions issued before password changes.
- Added database-backed permission procedures and protected storage redirects.
- Enforced independent LOTO, torque, and leak-test decisions.
- Replaced the mock Dashboard with the canonical eight-phase MySQL snapshot.
- Refreshed the canonical workflow and permission metadata during system seed.
- Removed unused Manus/OAuth/AI modules, SheetJS, and other unused dependencies;
  added a small OOXML export adapter.
- Gated Railway and Docker on database readiness, made workflow backfill
  explicit, and froze unsafe `db:push` until migration-history unification.

## 2.2.0 — Foundation Clean Release

- Added portable, resumable recovery for domain migration `0018`.
- Added explicit non-demo system seed and canonical workflow-runtime backfill.
- Removed demo seed/runtime initialization from production query paths.
- Added working database-backed Area and Project creation dialogs.
- Added schema-contract and production-doctor gates for MySQL, references,
  relationships, admin credentials, and JWT round-trip.
- Bound JWT issuer/audience/appId to the configured deployment.
- Fixed GitHub Actions pnpm setup ordering and added commit visibility to
  `/health` and `/ready`.
- Added foundational regression contracts and updated Railway/GitHub runbooks.

## 2.0.0-beta.4.2 — Git/Railway Master Release

- Fixed Railway release validation for local ignored `.env` files.
- Fixed TypeScript callback typing errors in Inspection and Quality Governance panels.
- Updated canonical workflow unit tests and isolated registration tests from a live database.
- Removed optional unresolved analytics placeholders from the production HTML.
- Added deterministic Railway build/pre-deploy scripts.
- Added initialized Git metadata workflow and simple Windows update scripts.

# CHANGELOG — SBTS Professional Edition

> سجل تاريخي لجميع مراحل تطوير نظام تتبع الستائر الذكي (SBTS).
> يُستخدم هذا الملف كمرجع للمهندسين لمعرفة ما تم بناؤه ومتى وسبب القرارات الرئيسية.

---

## [v2.0.0-beta.3] — 2026-07-24 · Sprint 3 Vertical Integration

### Field operations and UI

- Added database-backed PTW, LOTO, gas-test, torque, inspection, evidence and leak-test editors inside Blind Detail.
- Added a dedicated Vessel Isolation Packages page with package creation, linked-Blind status and entry readiness.
- Preserved the global theme system and semantic design tokens across all new pages and dialogs.

### Inspection configuration

- Added `inspection_activity_templates` and `inspection_activity_records`.
- Added the Settings Inspection Activity Builder with mandatory, evidence and independent-approval rules.
- Added independent inspection approval permission and enforced different completer/approver identities.

### Evidence and operational governance

- Added evidence MIME/size policy, current-phase evidence controls and audit entries.
- Separated torque execution from independent acceptance in both UI and server permissions.
- Added operational audit events for permit, LOTO, gas, torque, leak test, package, evidence and inspection changes.

### Verification

- Sprint 3 static checks: 40/40.
- TypeScript/TSX syntax: 213 files, zero parse errors.
- Migration 0015 SQL validation: passed, 9 statements, TiDB static compatibility checks passed.
- Full dependency-based typecheck, tests and build remain mandatory in connected Staging.

---

## [v2.0-runtime-beta.2] — 2026-07-24 · Sprint 2

### Database Domain Migration

- Added additive Migration `0014_sprint2_workflow_runtime.sql` for the canonical eight-phase runtime.
- Added project workflow assignments, Blind runtime/version state, phase instances, checklist responses and immutable transition events.
- Added Isolation Packages, entry-readiness records, permits, LOTO, gas tests, torque, leak tests, Safety Holds, sequential approvals and evidence metadata.
- Added non-destructive legacy five-phase mapping and synchronized compatibility projection.
- Removed unsupported `JSON_TABLE` usage and replaced it with TiDB/MySQL-compatible canonical checklist materialization.
- Seeded Sprint 2 RBAC permissions and operational roles inside the migration.

### Backend State Machine

- Replaced arbitrary phase updates with action commands and server-owned transition rules.
- Added server gate evaluation, optimistic concurrency, transition event snapshots, package reconciliation and workflow notifications.
- Added two-step independent Safety Hold release with exact lifecycle restoration.
- Added separate execution/acceptance for torque records and separate Operations/Entry Supervisor entry-readiness responsibilities.
- Added plant-configured gas-test acceptance limits; no atmospheric threshold is hard-coded in application logic.
- Added Operations Foreman as the final return-to-service authority.

### UI, Settings and Theme Integration

- Connected Project Detail and Blind Detail Hub to the canonical runtime and lifecycle status.
- Added controlled workflow actions, live blocking reasons, checklist persistence and Safety Hold release controls.
- Expanded Workflow & Safety Settings with gas limits, package rules, UI density and safety-banner controls.
- Preserved system theme consistency and database-controlled theme policy.

### Verification

- Sprint 2 static acceptance checks: 73/73.
- SQL structural validation: 33 statements, balanced and TiDB-compatible static rules.
- TypeScript/TSX syntax validation: 207 files, zero syntax errors.
- Full dependency-based typecheck, Vitest and production build remain mandatory in connected Staging.

---

## [v1.1-foundation] — 2026-07-24 · Sprint 0 + Sprint 1

### Baseline and architecture

- Added automated baseline inventory and verification scripts.
- Added canonical eight-phase workflow specification shared by frontend and backend.
- Preserved legacy five-phase blind data during controlled migration.

### Database and backend

- Added canonical workflow phase keys and active `wf-sbts-standard-v2` template.
- Added workflow/safety policy settings table and tRPC procedures.
- Added Operations, Independent Mechanical Verifier and Entry Supervisor roles plus granular permissions.
- Improved seed behavior so existing databases receive missing catalog records safely.

### Frontend and UI/UX

- Added Workflow & Safety Settings tab with plant-configurable gates.
- Connected default application theme and override policy to the database.
- Corrected Dashboard hero setting linkage.
- Removed state updates during render from Settings and User Profile.

### Verification boundary

- TS/TSX syntax and internal partial checks passed. Full dependency-based test/build remains required in connected CI.

---

## [v0.8] — 2026-07-03 · المرحلة 7: نظام التسجيل والمصادقة

**الـ checkpoint:** `466f185c`

### قاعدة البيانات

- إضافة حقول جديدة لجدول `users`: `userStatus` (pending/active/rejected)، `department`، `specialty`، `employeeNumber`، `registrationNote`، `approvedByOpenId`، `approvedAt`
- تطبيق migration SQL على قاعدة البيانات

### Backend (server)

- إضافة 4 helpers في `server/db.ts`: `completeUserRegistration`، `approveUserRegistration`، `rejectUserRegistration`، `getPendingUsers`
- إضافة 4 procedures في `accessControlRouter`: `pendingUsers` (admin only)، `approveUser` (admin only)، `rejectUser` (admin only)، `completeRegistration` (protected)
- إرسال إشعار تلقائي للمدير عند وصول طلب تسجيل جديد عبر `notifyOwner`

### Frontend

- إنشاء `Login.tsx`: صفحة دخول احترافية بتصميم Industrial مع OAuth — خارج AppShell
- إنشاء `Register.tsx`: نموذج إكمال البيانات المهنية (قسم، تخصص، رقم موظف، ملاحظة)
- إنشاء `Approve.tsx`: صفحة انتظار الموافقة مع polling كل 30 ثانية وعرض حالة الطلب
- تحديث `AppShell.tsx`: إضافة auth guard يوجّه المستخدم تلقائياً حسب حالته، عرض بيانات المستخدم الحقيقية (اسم، صورة، تخصص)، زر تسجيل خروج، شارة عدد الطلبات المعلقة للمدير
- تحديث `UserManagement.tsx`: إضافة قسم "طلبات التسجيل المعلقة" مع أزرار موافقة ورفض فورية
- تحديث `App.tsx`: إضافة routes خارج AppShell للمسارات العامة (`/login`, `/register`, `/approve`)

### الاختبارات

- إضافة `server/registration.test.ts` (7 اختبارات جديدة)
- إجمالي: 69 اختبار ناجح — TypeScript: 0 أخطاء

---

## [v0.7] — 2026-06-xx · Permission Matrix & Access Control

**الـ checkpoint:** `94d1c11`

### Frontend

- إضافة تبويب **Permission Matrix** مرئي في Access Control Center
- مصفوفة تفاعلية للأدوار والصلاحيات مع إمكانية التعديل المباشر
- دعم التصفية، البحث، ومقارنة الأدوار
- تصدير مصفوفة الصلاحيات إلى CSV

---

## [v0.6] — 2026-06-xx · User Management & Access Control Center

**الـ checkpoint:** `c42ce0c`

### قاعدة البيانات

- إضافة جدول `user_role_assignments` لربط المستخدمين بالأدوار

### Backend (server)

- إضافة 6 helpers في `server/db.ts`: `getAllUsers`، `assignRolesToUser`، `updateUserSystemRole`، `updateAccessControlModel`، `createAccessRole`، `deleteAccessRole`
- إضافة 6 procedures في `accessControlRouter`: `users`، `assignRoles`، `updateSystemRole`، `updateRoles`، `createRole`، `deleteRole`

### Frontend

- بناء `UserManagement.tsx`: جدول المستخدمين مع تعديل الأدوار
- تحديث `AccessControl.tsx`: ربط كامل بـ tRPC API بدلاً من mockData
- واجهة إنشاء دور جديد (Dialog) مع حفظ في قاعدة البيانات
- واجهة حذف الأدوار مع تأكيد، ونسخ الأدوار
- إضافة مسار `/users` في App.tsx وربطه بالقائمة الجانبية

### الاختبارات

- 62 اختبار ناجح — TypeScript: 0 أخطاء — Build: نجح

---

## [v0.5b] — 2026-05-xx · Logo Upload Feature

**الـ checkpoint:** `897548c`

### Backend (server)

- إضافة procedure `uploadLogo`: يقبل base64 ويرفع إلى S3 مع تحقق النوع والحجم
- إضافة procedure `removeLogo`: يحذف logoUrl من قاعدة البيانات

### Frontend

- تحديث Certificate Settings: إضافة drag-and-drop لرفع الشعار
- معاينة فورية للشعار بعد الرفع مع زر Remove
- الاحتفاظ بخيار إدخال URL كبديل
- التحقق من نوع الملف (PNG, JPG, SVG, WebP) والحجم (max 2MB)

---

## [v0.5a] — 2026-05-xx · Certificate Settings Integration with Reports

**الـ checkpoint:** `0505245`

### Frontend

- إنشاء hook مشترك `useCertificateSettings` لجلب إعدادات الشهادة من الخادم
- إنشاء دوال مساعدة مشتركة: `openPrintWindow`، `buildReportHeader`، `buildSignaturesSection`، `buildReportFooter`، `getPaperCSS`
- تحديث جميع مكونات التقارير الأربعة لاستخدام الإعدادات الحقيقية تلقائياً عند الطباعة: `ProjectSummaryReport`، `WorkflowPhasesReport`، `StatisticsReport`، `BlindsDetailedReport`

---

## [v0.5] — 2026-05-xx · System Settings (General, Default Tag, Certificate)

### قاعدة البيانات

- إضافة 3 جداول: `systemSettings`، `defaultTagSettings`، `certificateSettings`

### Backend (server)

- إضافة helpers في `server/db.ts` للإعدادات الثلاثة
- إضافة `settingsRouter` في `server/routers.ts`

### Frontend

- بناء `SystemSettings.tsx` مع ثلاثة تبويبات:
  - **General Settings**: اللغة، المنطقة الزمنية، الإشعارات، الشركة
  - **Default Tag Settings**: بادئة Tag، الحجم الافتراضي، النوع، الأولوية
  - **Certificate Settings**: اسم الشركة، الشعار، التوقيعات، ترويسة الشهادة
- إضافة مسار `/settings` في App.tsx

---

## [v0.4b] — 2026-05-xx · Professional Printing & Reports System

### Frontend

- إنشاء نظام تقارير متكامل مع 4 أنواع:
  - **Project Summary Report**: ملخص شامل للمشروع
  - **Workflow Phases Report**: تقرير مراحل سير العمل
  - **Blinds Detailed Report**: تقرير الستائر المفصل
  - **Statistics Report**: تقرير الإحصائيات والمقاييس
- معاينة قبل الطباعة (Print Preview)
- تصدير إلى PDF احترافي وExcel مع التنسيق
- خيارات طباعة متقدمة (حجم الورق، الاتجاه، الهوامش)

---

## [v0.4a] — 2026-05-xx · Advanced BlindsRegistry Features

### Frontend

- تصدير جدول BlindsRegistry إلى Excel مع تنسيق احترافي
- نظام ترقيم (Pagination) متقدم مع التحكم في عدد الصفوف (10, 25, 50, 100)
- البحث والفرز على الصفحات المختلفة

---

## [v0.4] — 2026-05-xx · Blind Detail Redesign, PDF Exports, Phase Approval

**الـ checkpoint:** `1f9bc0a`

### قاعدة البيانات

- إضافة نموذج بيانات للاعتماد الإلكتروني لكل فيز داخل كل Blind
- ربط اعتماد الفيز بسجل النشاط (activity log)

### Backend (server)

- إضافة procedure `approveBlindPhase` مع فرض قواعد سير العمل
- تحويل Export certificates وExport tags إلى تصدير PDF فعلي

### Frontend

- بناء `BlindDetail.tsx`: صفحة تفاصيل Blind مستقلة
  - أعلى الصفحة: بيانات المنطقة، المشروع، الموقع، المقاس، الريت، الحالة
  - جسم الصفحة: جميع الفيزات على اليسار مع الحالة والـ log على اليمين
- أزرار اعتماد/إلغاء اعتماد لكل فيز مع واجهة احترافية
- نقل تفعيل/تعطيل شرط Slip Blind Foreman Metal إلى إعدادات المشروع
- Execution Brief في سطر واحد مع تمييز كل قسم بلون قابل للإعداد

---

## [v0.3b] — 2026-05-05 · Project Blind Operations, Bulk Import, Phase Owners

**الـ checkpoint:** `b9dc8a7`

### قاعدة البيانات

- إضافة جدول `project_phase_owners` لربط مراحل المشروع بمسؤولين متعددين

### Backend (server)

- إضافة procedures: `addBlind`، `bulkAddBlinds`، `updateBlind`، `settings.update`
- فرض صلاحيات Phase Owner: المسؤول المحدد فقط يمكنه التعديل
- دعم Slip Blind gates: إلزامية موافقة Foreman Metal وتأكيد الدمج

### Frontend

- نموذج Add Blind مع أنواع: Slip Blind، Drop Spool، Isolation
- حقول: rate، equipment (بدلاً من lineNumber)، نوع Blind
- واجهة Bulk Paste من Excel مع معاينة قبل الحفظ وزر Load example
- إعدادات Phase Owners متعددة الأشخاص مع avatarUrl
- مركز تصدير وطباعة موحد للشهادات والـ Tags

---

## [v0.3a] — 2026-05-05 · Project Dashboard Components

**الـ checkpoint:** `060907b`

### Frontend

- إنشاء مكونات Dashboard داخل ProjectDetail:
  - `ProjectHeader`: معلومات المشروع والحالة والتقدم
  - `MetricsCards`: المقاييس الرئيسية
  - `WorkflowPhases`: مراحل سير العمل ومسؤولي المراحل
  - `RecentActivity`: الأنشطة الأخيرة
  - `QuickActions`: الإجراءات السريعة
  - `BlindsRegistry`: جدول الستائر مع البحث والفرز

---

## [v0.3] — 2026-05-05 · Project Detail & Blinds Linkage

**الـ checkpoint:** `e4d4c29`

### قاعدة البيانات

- إضافة جدول `blinds` مع علاقة بجدول `projects`

### Backend (server)

- إضافة procedure `projects.detail` يعيد تفاصيل المشروع مع سجلات الستائر
- إضافة procedure `projects.blindDetail` لتفاصيل Blind محدد

### Frontend

- بناء `ProjectDetail.tsx`: صفحة تفاصيل مشروع مع ملخص ومؤشرات وسجلات الستائر
- ربط أزرار "Open project" في صفحة Projects بمسار تفاصيل المشروع

---

## [v0.2] — 2026-05-05 · Areas and Projects Flow

**الـ checkpoint:** `ece5815`

### قاعدة البيانات

- إضافة جدول `areas` مع علاقة بجدول `projects`
- Seed للمناطق التشغيلية الأولية لـ SBTS

### Backend (server)

- إضافة `areasRouter`: `list`، `getById`، `create`
- إضافة `projects.listByArea` لمشاريع منطقة محددة

### Frontend

- بناء `Areas.tsx`: كروت المناطق مع عدد المشاريع وحالة النشاط
- تحديث `Projects.tsx`: دعم عرض كل المشاريع أو مشاريع منطقة محددة
- انتقال سياقي بين المناطق والمشاريع بدون فقدان السياق

---

## [v0.1b] — 2026-05-04 · Workflow Studio Drag-and-Drop UX

**الـ checkpoint:** `0ee3e76`

### Frontend

- إضافة واجهة سحب وإفلات مرئية لإعادة ترتيب مراحل مسار العمل
- تحديث أرقام المراحل وحفظ الترتيب الجديد عبر API وقاعدة البيانات

---

## [v0.1a] — 2026-05-04 · Workflow Studio APIs & Database Integration

**الـ checkpoint:** `b493e22`

### قاعدة البيانات

- إضافة جداول: `workflow_templates`، `workflow_phases`، `access_roles`، `role_permissions`
- Seed آمن للبيانات الحالية

### Backend (server)

- إضافة `workflowRouter`: CRUD كامل للـ workflows والمراحل
- إضافة `accessControlRouter` (نسخة أولية): `model`

### Frontend

- ربط Workflow Studio بالـ APIs بدلاً من mockData
- إضافة حالات تحميل، حفظ، أخطاء، وتنبيهات نجاح

---

## [v0.1] — 2026-05-04 · Initial Frontend Build

**الـ checkpoint:** `a6d0ba0`

### Frontend (الإطار الأساسي)

- تصميم Industrial Command Center Minimalism
- `AppShell.tsx`: الإطار الرئيسي مع sidebar، header، theme toggle
- `Dashboard.tsx`: لوحة التحكم الرئيسية
- `Projects.tsx`: قائمة المشاريع
- `Blinds.tsx`: سجل الستائر
- `AccessControl.tsx`: مركز التحكم بالوصول (نسخة أولية بـ mockData)
- `WorkflowStudio.tsx`: محرر مسارات العمل (نسخة أولية)
- هيكل React + Vite + Tailwind 4 + tRPC + Drizzle ORM

---

## ملاحظات للمهندسين

| الملف                                       | الوصف                                  | الموقع                                        |
| ------------------------------------------- | -------------------------------------- | --------------------------------------------- |
| `drizzle/schema.ts`                         | تعريف جميع جداول قاعدة البيانات        | نقطة البداية لأي تعديل في البيانات            |
| `server/db.ts`                              | جميع helpers للتعامل مع قاعدة البيانات | يحتوي على 1,900+ سطر — مرشح للتقسيم           |
| `server/routers.ts`                         | جميع tRPC procedures                   | يحتوي على 6 routers في ملف واحد               |
| `client/src/lib/mockData.ts`                | بيانات ثابتة للـ navItems وcatalogs    | لا يزال يُستخدم لـ navItems وpermissionGroups |
| `client/src/pages/`                         | جميع صفحات التطبيق                     | 12 صفحة                                       |
| `client/src/components/layout/AppShell.tsx` | الإطار الرئيسي مع auth guard           | يحتوي على منطق المصادقة والتوجيه              |

### سير المصادقة الحالي

```
مستخدم جديد
  → تسجيل دخول OAuth (/login)
  → إكمال البيانات المهنية (/register)
  → انتظار موافقة المدير (/approve)
  → وصول كامل للنظام (AppShell)

المدير
  → يرى طلبات التسجيل في /users
  → موافقة أو رفض فورية
  → إشعار تلقائي عند وصول طلب جديد
```

## 2.0.0-beta.4 — Sprint 4: Certificate and Quality Governance

### Added

- Immutable, SHA-256 hashed certificate snapshots with controlled issue, reissue, supersede and revocation history.
- Data-minimized public certificate verification route and printable verification page.
- Defect Notification, Punch Item and NDT records with optimistic concurrency and independent review controls.
- Quality readiness gates integrated with workflow closure and certificate issuance.
- Inspection and quality configuration controls in Workflow & Safety Settings.
- Railway/MySQL/S3-compatible deployment configuration, health/readiness endpoints and graceful shutdown.
- Unified storage adapter for Manus Forge and S3-compatible Railway Storage Buckets, including physical deletion where supported.
- Resumable SBTS domain migration runner with per-file and per-statement checksums.
- Local MySQL + MinIO Docker Compose stack, admin bootstrap command, staging smoke test and authenticated E2E runner.
- Arabic Local and Railway deployment guide and staging UAT checklist.

### Changed

- Certificate public verification no longer exposes the controlled raw snapshot, permits, LOTO, gas readings, evidence links or internal user IDs.
- NDT acceptance is evaluated against the related defect rather than a global NDT count.
- Certificate issuance requires the configured workflow, leak-test, final-approval and quality gates.
- Evidence records retain a backend-neutral storage object key.
- Production server validates critical environment variables and binds to Railway's dynamic port on `0.0.0.0`.

### Fixed

- Date normalization now occurs before generic object normalization when calculating certificate snapshot hashes.
- Quality review actions cannot be triggered during React render.
- Defect, punch and NDT review paths reject stale record versions and self-approval where independence is required.
- Domain migrations are no longer silently skipped by relying only on the Drizzle journal.

## 2.1.0-rc.1 — Clean production/deployment hardening

- Fixed standalone session payloads with a non-empty application ID and legacy-cookie fallback.
- Changed same-origin session cookies to secure `SameSite=Lax` behavior behind Railway/reverse proxies.
- Made Admin bootstrap idempotently create or reset the configured administrator password.
- Added deployment environment validation with actionable `DATABASE_URL` errors.
- Added account lockout fields and database-backed failed-login enforcement.
- Added migration `0017_sprint5_auth_deployment_hardening.sql`.
- Added a provider-neutral Dockerfile and configured Railway to use it.
- Removed duplicate package installation from Railway builds and improved cache reuse.
- Disabled legacy OAuth error noise unless OAuth is explicitly enabled.
- Added basic production security headers, request IDs, and readiness checks.

## 2.1.0 — Clean portable release

- Added a production doctor that verifies database schema, administrator password, account status and JWT session round-trip before a revision can start.
- Fixed stale `auth.me` client cache after successful email/password login.
- Silenced expected anonymous-session log noise while retaining invalid-token diagnostics.
- Added duplicate-email preflight and clearer statement-level migration errors.
- Corrected Docker dependency installation so Vite, TypeScript, Drizzle and pre-deploy tooling remain available during build and migration.
- Added portable hosting and final Railway documentation.
