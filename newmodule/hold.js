// FEAT-025d: an arm's loop can be held between two of its steps while the arm does a task for a visitor,
// and goes on exactly where it stopped. The task asks with loop.hold(ready); at the next step where the
// arm may stop (breakInfo() gives the moves off the work and back onto it, or null where it may not),
// the loop runs the moves off the work, then holds and calls ready(); loop.release() lets it go on (it
// first runs the moves back onto the work).
// S: the loop's state (steps, cur, hold, held). mid: checked during a wait step (the arm stands still).
export function holdCheck(S, mid, breakInfo) {
  if (!S.hold || S.held) return false;
  const info = breakInfo();
  if (!info) return false;
  const ready = S.hold;
  S.hold = null;
  if (mid) { S.steps.unshift(S.cur); S.cur = null; }        // the wait starts again after the task
  S.steps.unshift(...info.exit, {
    dur: 0, update() {},
    start() { S.held = true; S.steps.unshift(...info.enter); ready(); },
  });
  return true;
}
// a folded arm (travelling, parked, or turned to the module): it may stand up and turn from here
export const folded = (q) => q.j3 > 2.3 && q.j2 < 0.3 && q.j2 > -0.6;
