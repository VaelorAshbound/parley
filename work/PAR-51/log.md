### 2026-10-01T20:06:58Z
Created.

### 2026-10-03T07:17:52Z
Wave 1 (fix/wave-1) refused an export changed during the print. Owner 2026-10-03: the user still gets the file they clicked; count what was printed (rework in progress).

### 2026-10-03T07:50:20Z
Reworked per owner: the user always gets the printed file; the count goes to the agreement printed (recordExport takes it). Row lock kept (proved by a two-connection test). Merged to main 5e32521, deployed.

### 2026-10-03T07:50:20Z
phase: backlog -> done
