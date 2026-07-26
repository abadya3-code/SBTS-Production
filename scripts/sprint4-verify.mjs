import fs from "node:fs";
import path from "node:path";
import process from "node:process";
const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));
const checks=[]; const failures=[];
function check(name, condition, detail="") { const passed=Boolean(condition); checks.push({name,passed,detail}); if(!passed) failures.push(`${name}: ${detail}`); }

const required = [
  "drizzle/0016_sprint4_certificate_quality_governance.sql",
  "server/db/certificateGovernance.ts",
  "server/db/qualityGovernance.ts",
  "server/routers/certificates.ts",
  "client/src/components/workflow/CertificateGovernancePanel.tsx",
  "client/src/components/workflow/QualityGovernancePanel.tsx",
  "client/src/components/settings/CertificateQualitySettings.tsx",
  "client/src/pages/CertificateVerification.tsx",
  "scripts/sprint4-staging-e2e.ts",
  "scripts/apply-sbts-domain-migrations.ts",
  "SBTS_LOCAL_AND_RAILWAY_DEPLOYMENT.md",
  "SBTS_Sprint4_Staging_UAT_Checklist.md",
  "docker-compose.local.yml",
  "railway.json",
  ".env.example",
];
for (const file of required) check(`Required file ${file}`, exists(file), file);

const schema=read("drizzle/schema.ts");
const migration=read("drizzle/0016_sprint4_certificate_quality_governance.sql");
const cert=read("server/db/certificateGovernance.ts");
const quality=read("server/db/qualityGovernance.ts");
const runtime=read("server/db/workflowRuntime.ts");
const router=read("server/routers/certificates.ts");
const app=read("client/src/App.tsx");
const settings=read("client/src/pages/SystemSettings.tsx");
const workflowPanel=read("client/src/components/workflow/WorkflowOperationsPanel.tsx");
const qualityPanel=read("client/src/components/workflow/QualityGovernancePanel.tsx");
const storage=read("server/storage.ts");
const serverEntry=read("server/_core/index.ts");
const seed=read("server/db/seed.ts");
const packageJson=JSON.parse(read("package.json"));
const migrationRunner=read("scripts/apply-sbts-domain-migrations.ts");
const deployGuide=read("SBTS_LOCAL_AND_RAILWAY_DEPLOYMENT.md");

for (const table of ["certificate_records","defect_notifications","punch_items","ndt_records"]) {
  check(`Schema contains ${table}`, schema.includes(`"${table}"`), table);
  check(`Migration creates ${table}`, migration.includes(`\`${table}\``), table);
}
for (const field of ["certificateNumberPrefix","certificateVerificationEnabled","certificateRequireClosedWorkflow","certificateReissueRequiresReason","certificateAllowRevocation","certificatePublicBaseUrl","defectNumberPrefix","punchNumberPrefix","ndtNumberPrefix","requireDefectDispositionBeforeClosure","requireMandatoryPunchClosureBeforeReadyForClosure","requireNdtAcceptanceBeforeReadyForClosure","allowPunchTransfer"]) {
  check(`Policy field ${field}`, schema.includes(field) && migration.includes(field) && settings.includes(field), field);
}
check("Immutable certificate snapshot", cert.includes("snapshotJson") && cert.includes("snapshotHash") && cert.includes("sha256"), "Certificate requires snapshot and SHA-256 hash.");
check("Certificate versions retained", cert.includes("previousCertificateId") && cert.includes("superseded") && cert.includes("Controlled reissue"), "Reissue must preserve previous revision.");
check("Certificate readiness gates", cert.includes("certificateRequireClosedWorkflow") && cert.includes("certificateRequiresLeakTest") && cert.includes("getQualityGateReadiness") && cert.includes("Final approval chain is incomplete"), "Workflow, leak, quality and approvals must block issue.");
check("Certificate audit", cert.includes("Certificate Issued") && cert.includes("Certificate Reissued") && cert.includes("Certificate Revoked"), "All certificate decisions require audit records.");
check("Public verification data minimization", cert.includes("no permits, LOTO details, gas readings") && cert.includes("publicSnapshot") && !cert.includes("snapshot,\n  };"), "Public API must not return raw controlled snapshot.");
check("Public verification route", app.includes('/certificate/verify/:token') && read("client/src/pages/CertificateVerification.tsx").includes("SHA-256 snapshot fingerprint"), "Public route and UI are required.");
check("Quality runtime gate", runtime.includes("requireDefectDispositionBeforeClosure") && runtime.includes("requireMandatoryPunchClosureBeforeReadyForClosure") && runtime.includes("requireNdtAcceptanceBeforeReadyForClosure"), "State machine must enforce quality readiness.");
check("Independent defect disposition", quality.includes("different authorized user than the reporter"), "Defect reviewer must be independent.");
check("Independent punch verification", quality.includes("different authorized user than the creator"), "Punch verifier must be independent.");
check("Independent NDT review", quality.includes("different authorized user than the performer") && quality.includes("Record the NDT performance before"), "NDT review must follow performance and be independent.");
check("Quality optimistic concurrency", quality.includes("affectedRows(updateResult) === 0") && quality.includes("recordVersion"), "Quality records require version conflict checks.");
check("Quality UI avoids render side effects", qualityPanel.includes("canEdit &&") && !qualityPanel.includes("onEdit(record) &&"), "Review dialogs must only open from user actions.");
check("Quality and certificate panels connected", workflowPanel.includes("QualityGovernancePanel") && workflowPanel.includes("CertificateGovernancePanel"), "Blind Detail must expose Sprint 4 modules.");
check("Settings governance controls", settings.includes("CertificateQualitySettings"), "Settings must expose certificate and quality policies.");
check("Certificate router public verify", router.includes("verify: publicProcedure") && router.includes("issue: protectedProcedure") && router.includes("revoke: protectedProcedure"), "Public verify and protected governance endpoints required.");
check("Sprint 4 permissions in migration", migration.includes("workflow.certificate.issue") && migration.includes("workflow.quality.defect.record") && migration.includes("workflow.quality.ndt.review"), "Migration must provision RBAC.");
check("Sprint 4 permissions in seed", seed.includes("workflow.certificate.issue") && seed.includes("workflow.quality.defect.record") && seed.includes("workflow.quality.ndt.review"), "Fresh databases need equivalent RBAC.");
check("Railway S3 storage", storage.includes('envValue("S3_BUCKET", "BUCKET")') && storage.includes("PutObjectCommand") && storage.includes("DeleteObjectCommand"), "Railway Bucket variables and object deletion required.");
check("Evidence storage key", schema.includes('storageKey: varchar("storageKey"') && migration.includes("ADD COLUMN `storageKey`") && read("server/db/workflowRecords.ts").includes("storageKeyFromUrl"), "Evidence must retain backend-neutral object key.");
check("Production health endpoints", serverEntry.includes('app.get("/health"') && serverEntry.includes('app.get("/ready"') && serverEntry.includes('"0.0.0.0"'), "Railway requires health path and network binding.");
check("Railway config as code", read("railway.json").includes("preDeployCommand") && read("railway.json").includes("/health"), "Migration and healthcheck must be configured.");
check("Admin bootstrap", exists("scripts/create-admin.ts") && packageJson.scripts["admin:create"], "Initial admin creation must be documented and scriptable.");
check("Staging E2E command", packageJson.scripts["staging:e2e"] && read("scripts/sprint4-staging-e2e.ts").includes("Canonical runtime"), "Authenticated staging validation is required.");
check("TiDB compatibility", !migration.includes("JSON_TABLE("), "Migration must remain TiDB compatible.");

check("Domain migration runner", migrationRunner.includes("sbts_domain_migrations") && migrationRunner.includes("sbts_domain_migration_steps") && migrationRunner.includes("statementChecksum") && migrationRunner.includes("migrationChecksum") && migrationRunner.includes("domainPattern"), "Sprint domain migrations require resumable statement checksums, file checksums and discovery.");
check("Deployment migration command", packageJson.scripts["db:migrate"] === "pnpm db:migrate:drizzle && pnpm db:migrate:domain" && packageJson.scripts["db:migrate:domain"]?.includes("apply-sbts-domain-migrations.ts"), "Deployment must apply Drizzle and SBTS domain migrations.");
check("Domain migration baseline safety", migrationRunner.includes("SBTS_DOMAIN_MIGRATION_BASELINE_UP_TO") && migrationRunner.includes("baselined without execution") && migrationRunner.includes("Applied migration ${file} has changed"), "Existing databases require explicit baseline and checksum protection.");
check("Local deployment stack", read("docker-compose.local.yml").includes("mysql") && read("docker-compose.local.yml").includes("minio"), "Local MySQL and S3-compatible storage must be reproducible.");
check("Local and Railway guide", deployGuide.includes("pnpm db:migrate") && deployGuide.includes("Railway") && deployGuide.includes("Storage Bucket") && deployGuide.includes("SBTS_DOMAIN_MIGRATION_BASELINE_UP_TO"), "Deployment guide must match executable migration and Railway storage flow.");
check("Canonical date hashing", cert.indexOf("value instanceof Date") >= 0 && cert.indexOf("value instanceof Date") < cert.indexOf('typeof value === "object"'), "Dates must be normalized before generic object hashing.");

const report={generatedAt:new Date().toISOString(),checks:checks.length,passed:checks.filter(x=>x.passed).length,failed:failures.length,failures};
console.log(JSON.stringify(report,null,2)); if(failures.length) process.exit(1);
