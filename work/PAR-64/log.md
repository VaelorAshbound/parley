### 2026-11-21T09:43:03Z
Created.

### 2026-11-21T09:46:40Z
Reproduced locally: in a PID namespace whose first process is pnpm (unshare --user --map-root-user --pid --fork --mount-proc), the same 4 tests fail; normally all pass. Fix in the test file only: alive(pid) reads the state in /proc/<pid>/stat on Linux and counts Z as gone. New test makes a real zombie (sh -c 'true & echo $!; exec sleep 5') and failed before the fix. After: 11/11 normally, 11/11 in the namespace, 5 repeat runs green.
