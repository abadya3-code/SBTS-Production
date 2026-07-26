# Certificate Design Notes (from user-provided image)

## Layout Structure (Single Page A4 Landscape)

### Header Row
- Left: Circle logo "SB" + "Smart Blind Tag System" text
- Center: "Smart Blind Tag System Certificate" (title)
- Right: "LOCKED / FINAL" badge (red) + Company logo (Aramco/Saudi aramco)

### Status Badge
- Centered green badge: "APPROVED"

### Blind Information Grid (2 columns)
- Area: SRU-31 | Project: T&I 2025
- Blind: 1 | Line: -
- Type: Isolation Blind | Size: -
- Current phase: Final approvals

### Workflow Log Table
- Columns: Date | From | To | Worker | Role
- "No changes yet." placeholder

### Execution / Torque Section (with QR code on right)
- Table: Item | Value
  - Torque (PSI): N/A
  - Torque Type: N/A
  - Technician: N/A
  - Tool ID: N/A
- QR Code on the right side with JSON data:
  `{"app":"SBTS","v":"47.43","certificateId":"CERT-2b4d7e63-6f97-4c45-bf05-b52ffd417a12","project":{"id":"22cc5516-27b6-...`

### Final Approvals Table
- Columns: Approval | Approved | By | Date
  - Inspection_Unit: YES | System Admin | Invalid Date
  - QA/QC: YES | System Admin | Invalid Date

### Footer
- Left: "This is a digital certificate (no handwritten signature required)."
- Right: "Generated from SBTS local data."

## Key Design Elements
- Clean white background
- Professional borders around info cells
- Blue/navy header bar for tables
- Red text for "Invalid Date" warnings
- Green "APPROVED" badge
- Red "LOCKED / FINAL" badge
- QR code integration
- Single page printable format
