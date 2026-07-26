# SBTS Staging UAT Checklist

## Platform

- [ ] `/health` returns HTTP 200.
- [ ] `/ready` returns database connected.
- [ ] Admin login succeeds.
- [ ] Theme and Settings persist after refresh.

## Core Data

- [ ] Create Area.
- [ ] Create Project.
- [ ] Create Blind.
- [ ] Project ↔ Blind linkage is correct.
- [ ] Eight-phase runtime is created.

## Workflow and Safety

- [ ] PTW blocks progression when missing or expired.
- [ ] LOTO blocks progression when incomplete.
- [ ] Gas Test blocks progression when expired/out of limits.
- [ ] Torque requires independent acceptance.
- [ ] Safety Hold blocks phase progression.
- [ ] Independent Safety Hold release restores previous state.

## Inspection Quality

- [ ] Create Inspection Activity.
- [ ] Record Defect.
- [ ] Close/transfer Punch Item.
- [ ] Record and independently review NDT.
- [ ] Open mandatory quality items block Ready for Closure.

## Reinstatement and Certificate

- [ ] Blind removal/reinstatement record is completed.
- [ ] Leak Test is passed.
- [ ] Final approval sequence is enforced.
- [ ] Slip Blind conditional Metal Foreman approval is enforced.
- [ ] Certificate issue is blocked until all gates pass.
- [ ] Certificate verification page shows the hash without sensitive records.
- [ ] Certificate reissue and revocation retain history.

## Deployment and Recovery

- [ ] Evidence upload succeeds with Railway Bucket.
- [ ] Evidence delete removes the object.
- [ ] Database backup is created.
- [ ] Restore test is completed in non-production environment.
- [ ] No critical or high defects remain open.
