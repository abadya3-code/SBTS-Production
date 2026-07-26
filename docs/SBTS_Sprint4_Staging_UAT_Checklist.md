# SBTS Sprint 4 — Staging E2E & UAT Acceptance Checklist

**Release:** `2.0.0-beta.4`  
**Environment:** Staging only  
**Required sign-off:** Application Owner, Operations, Maintenance, Inspection, Safety, T&I Coordinator, IT/Cybersecurity

## Release prerequisites

| Check | Expected | Result | Evidence / Notes |
|---|---|---|---|
| `pnpm sprint2:verify` | PASS | ☐ | |
| `pnpm sprint3:verify` | PASS | ☐ | |
| `pnpm sprint4:verify` | PASS | ☐ | |
| `pnpm check` | PASS | ☐ | |
| `pnpm test` | PASS | ☐ | |
| `pnpm build` | PASS | ☐ | |
| Database backup completed | Verified backup | ☐ | |
| Restore drill completed | Successful restore | ☐ | |
| `/health` | HTTP 200 | ☐ | |
| `/ready` | HTTP 200 | ☐ | |
| MySQL domain migration journal | 0013–0016 recorded | ☐ | |
| Railway Bucket upload/open/delete | Successful | ☐ | |

---

## E2E-01 — Normal Spectacle Blind lifecycle

**Goal:** Complete one controlled blind lifecycle from Operations isolation to final locked certificate.

- ☐ Project and Isolation Package created.
- ☐ Blind linked to one active package only.
- ☐ Operations Initial Isolation completed.
- ☐ PTW, Line Breaking Permit and LOTO saved and valid.
- ☐ Gas test accepted using configured plant limits.
- ☐ Blind installation Torque submitted by Maintenance.
- ☐ Torque accepted by different Mechanical Verifier.
- ☐ Independent Mechanical Verification completed.
- ☐ Entry Readiness authorized by Entry Supervisor.
- ☐ Internal Inspection completed.
- ☐ Reinstatement Preparation authorized by Operations.
- ☐ Reinstatement Torque submitted and independently accepted.
- ☐ Leak Test passed.
- ☐ Final approval chain completed sequentially.
- ☐ Workflow status becomes `CLOSED` and locked.
- ☐ Final certificate issued.
- ☐ Public verification hash returns valid.

**Expected:** No direct phase editing, no bypassed gate, one immutable Version 1 certificate.

Result: ☐ PASS ☐ FAIL  
Evidence:

---

## E2E-02 — Slip Blind conditional approval

- ☐ Create Slip Blind / Spade.
- ☐ Complete lifecycle until Final Approval.
- ☐ Confirm Metal Foreman approval is mandatory.
- ☐ Confirm Spectacle Blind does not require this approval.
- ☐ Confirm certificate issue is blocked until Metal Foreman approval.

Result: ☐ PASS ☐ FAIL

---

## E2E-03 — Expired permit and gas test gates

- ☐ Expire PTW while Operations phase is current.
- ☐ Attempt phase transition.
- ☐ Confirm transition rejected with visible reason.
- ☐ Record expired Gas Test.
- ☐ Confirm Entry Authorization and De-blinding are blocked.
- ☐ Record valid retest and confirm gate recalculates.

Result: ☐ PASS ☐ FAIL

---

## E2E-04 — Torque governance

- ☐ Maintenance submits Installation Torque.
- ☐ Same user attempts to accept it; server rejects.
- ☐ Different Mechanical Verifier accepts it.
- ☐ Use expired calibration; server blocks acceptance/transition.
- ☐ Record Reinstatement Torque separately.
- ☐ Confirm records cannot overwrite one another.

Result: ☐ PASS ☐ FAIL

---

## E2E-05 — Defect disposition

- ☐ Inspector records defect.
- ☐ Same inspector attempts final disposition; server rejects.
- ☐ Independent authorized inspector selects `repair_required` with disposition.
- ☐ Complete repair and close with controlled note.
- ☐ Confirm Ready for Closure is blocked while disposition is missing.

Result: ☐ PASS ☐ FAIL

---

## E2E-06 — Punch item verification

- ☐ Create mandatory punch item.
- ☐ Confirm Ready for Closure blocked.
- ☐ Creator attempts closure; server rejects independent verification.
- ☐ Different verifier closes with verification note.
- ☐ Test controlled transfer with formal reference.
- ☐ Disable Punch Transfer in Settings and confirm transfer is rejected.

Result: ☐ PASS ☐ FAIL

---

## E2E-07 — NDT record and retest

- ☐ Mark defect as `requiresNdt`.
- ☐ Create linked NDT performance record.
- ☐ Attempt final result without prior performance record; reject.
- ☐ Performer attempts own review; reject.
- ☐ Independent reviewer marks `failed` or `retest_required`; Closure blocked.
- ☐ Record accepted retest linked to the correct defect.
- ☐ Confirm another defect’s NDT does not satisfy this defect.

Result: ☐ PASS ☐ FAIL

---

## E2E-08 — Safety Hold

- ☐ Place Safety Hold during active work.
- ☐ Confirm phase transitions, approval and certificate issue blocked.
- ☐ Confirm package status becomes On Hold.
- ☐ Submit corrective action.
- ☐ Hold placer or requester attempts self-release; reject.
- ☐ Independent authorized user approves release.
- ☐ Confirm exact previous lifecycle status restored.

Result: ☐ PASS ☐ FAIL

---

## E2E-09 — Optimistic concurrency

- ☐ User A and User B open same Defect/Punch/NDT/runtime version.
- ☐ User A saves successfully.
- ☐ User B submits stale `recordVersion`.
- ☐ Server returns conflict and does not overwrite User A.

Result: ☐ PASS ☐ FAIL

---

## E2E-10 — Evidence storage

- ☐ Upload JPEG.
- ☐ Upload PNG/WebP/PDF.
- ☐ Attempt disallowed MIME type; reject.
- ☐ Attempt oversized file; reject.
- ☐ Open evidence through `/storage/*` signed redirect.
- ☐ Delete evidence and confirm object removed from Railway Bucket.
- ☐ Confirm Audit Trail includes upload and deletion.

Result: ☐ PASS ☐ FAIL

---

## E2E-11 — Certificate governance

- ☐ Attempt issue before Workflow close; reject.
- ☐ Attempt issue before Leak Test pass; reject.
- ☐ Attempt issue with open defect/punch/NDT; reject.
- ☐ Issue certificate after all gates pass.
- ☐ Confirm snapshot hash is 64-character SHA-256.
- ☐ Confirm source record changes do not modify issued snapshot.
- ☐ Controlled Reissue requires reason and creates Version 2.
- ☐ Version 1 becomes Superseded and remains verifiable.
- ☐ Revoke Version 2 with reason.
- ☐ Public page shows Revoked.
- ☐ Public API does not expose permits, LOTO, gas readings, attachments or internal open IDs.

Result: ☐ PASS ☐ FAIL

---

## E2E-12 — Railway deployment controls

- ☐ Build completes from clean Git commit.
- ☐ Pre-deploy migration completes before start.
- ☐ Failed migration prevents new deployment becoming active.
- ☐ Healthcheck switches traffic only after `/health` succeeds.
- ☐ App binds to Railway `PORT` on `0.0.0.0`.
- ☐ SIGTERM results in graceful shutdown.
- ☐ Redeploy retains MySQL and Bucket data.

Result: ☐ PASS ☐ FAIL

---

## E2E-13 — Mobile and field usability

Test on tablet and phone widths:

- ☐ Current action visible without searching.
- ☐ Safety Hold visible.
- ☐ Checklist touch targets usable with gloves.
- ☐ Camera/image upload works.
- ☐ Disabled transition explains blockers.
- ☐ QR opens correct live Blind record.
- ☐ No horizontal overflow in critical forms.

Result: ☐ PASS ☐ FAIL

---

## Automated staging command

```powershell
$env:SBTS_E2E_BASE_URL="https://staging-domain"
$env:SBTS_E2E_EMAIL="e2e-user@company.com"
$env:SBTS_E2E_PASSWORD="strong-password"
$env:SBTS_E2E_PROJECT_ID="project-id"
$env:SBTS_E2E_BLIND_TAG="blind-tag"
$env:SBTS_E2E_EXPECT_CLOSED="true"
$env:SBTS_E2E_CERTIFICATE_TOKEN="verification-token"
pnpm staging:e2e
```

Attach the JSON output to the release record.

---

# Final sign-off

| Role | Name | Decision | Date | Signature / Reference |
|---|---|---|---|---|
| Application Owner | | ☐ Accept ☐ Reject | | |
| Operations Foreman | | ☐ Accept ☐ Reject | | |
| Maintenance / Mechanical | | ☐ Accept ☐ Reject | | |
| Inspection | | ☐ Accept ☐ Reject | | |
| Safety | | ☐ Accept ☐ Reject | | |
| T&I Coordinator | | ☐ Accept ☐ Reject | | |
| IT / Cybersecurity | | ☐ Accept ☐ Reject | | |

## Production decision

- ☐ Approved for Production.
- ☐ Approved for controlled Pilot only.
- ☐ Rejected pending corrective actions.

Open corrective actions:

1. 
2. 
3. 
