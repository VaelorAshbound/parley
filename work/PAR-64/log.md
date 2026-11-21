### 2026-11-21T09:43:03Z
Created.

### 2026-11-21T09:46:40Z
Reproduced locally: in a PID namespace whose first process is pnpm (unshare --user --map-root-user --pid --fork --mount-proc), the same 4 tests fail; normally all pass. Fix in the test file only: alive(pid) reads the state in /proc/<pid>/stat on Linux and counts Z as gone. New test makes a real zombie (sh -c 'true & echo $!; exec sleep 5') and failed before the fix. After: 11/11 normally, 11/11 in the namespace, 5 repeat runs green.

### 2026-11-21T10:11:20Z
phase: backlog -> review

### 2026-11-21T10:11:20Z
Review round 1 (code-reviewer): 2 Required, fixed. (1) The zombie test was flaky where sh is bash (bash collects its finished background job): now Node's own child, kept a zombie by a synchronous poll. (2) alive() counted an unreadable state as gone: now only Z counts as gone. Checked: red without the fix; 11/11 in the --mount-proc namespace; with the outer /proc 5 fail loudly instead of passing; 20/20 runs, 4 in parallel. The afterEach robustness points (Optional, older code) go to a follow-up.
