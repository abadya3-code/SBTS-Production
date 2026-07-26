# SBTS Workflow Specification v1.0

**Status:** Approved technical baseline for Sprint 1 implementation  
**Scope:** Tank, vessel, drum and equipment positive-isolation lifecycle  
**System:** SBTS — Smart Blind Tag System

## Product truth

SBTS uses eight user-facing phases:

1. Operations Initial Isolation
2. Blind Installation & Controlled Tightening
3. Independent Mechanical Verification
4. Internal Inspection & Work Execution
5. Reinstatement Preparation & Authorization
6. Blind Removal & Reinstatement
7. Independent Reinstatement Verification & Leak Test
8. Final Approval & Return to Service

Two mandatory internal gates are evaluated without adding visual phase clutter:

- Vessel Entry Readiness Gate
- Final Reinstatement & Leak Test Gate

The executable source of truth is `shared/workflowSpecification.ts`. UI labels, Workflow Studio defaults, seed data and future transition-engine rules must import from that module instead of duplicating phase arrays.

## Responsibility separation

- **Operations:** initial isolation, LOTO/process handover, reinstatement preparation and final operating acceptance.
- **Maintenance/Bolting Technician:** blind installation/removal and controlled tightening records.
- **Independent Mechanical Verifier:** independent installation and reinstatement verification; cannot be the executing technician for the same record.
- **Inspection:** internal inspection activities, defects, punch items and ready-for-closure declaration.
- **T&I Coordinator:** package completeness and coordinated approval.
- **Operations Foreman:** final return-to-service authority.
- **Metal Foreman:** conditional mandatory approval for slip blind/spade workflows configured by policy.

## Mandatory safety behavior

- The server must reject phase advancement while a Safety Hold is active.
- Gas-test requirements are policy-driven and time-bound.
- LOTO and permit requirements are validated at transition time.
- Torque values and pump pressure are separate fields and require a valid tool calibration record.
- A certificate cannot be finalized before leak/service-test acceptance when the policy is enabled.
- Reopening an approved phase requires a recorded reason and approval when configured.

## Compatibility policy

The current blind registry still stores five legacy phase values. Sprint 1 does not overwrite those values because a direct enum replacement could corrupt active data. The canonical workflow is introduced alongside legacy compatibility. A controlled migration and per-record phase-instance model are implemented in the database redesign sprint.

## UI/UX rules

- Show the current required action before historical or informational cards.
- Keep the blind QR in the header as the permanent record identity.
- Provide text and icon states in addition to color.
- Show explicit blocking reasons for disabled actions.
- Keep theme tokens consistent with the existing SBTS industrial command-center design.
- Settings that are not operational must be marked Beta/Experimental or disabled.
