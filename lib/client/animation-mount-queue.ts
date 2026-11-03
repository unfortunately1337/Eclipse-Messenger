type Job = { run: () => void; cancelled: boolean };
const jobs: Job[] = [];
let frame: number | null = null;
function flush() {
  frame = null;
  const started = performance.now();
  while (jobs.length) {
    const job = jobs.shift()!;
    if (!job.cancelled) job.run();
    if (performance.now() - started >= 4) break;
  }
  if (jobs.length) frame = requestAnimationFrame(flush);
}
/** Keep vector renderer construction out of a single long Promise microtask burst. */
export function scheduleAnimationMount(run: () => void) {
  const job: Job = { run, cancelled: false }; jobs.push(job);
  if (frame === null) frame = requestAnimationFrame(flush);
  return () => {
    job.cancelled = true;
    const index = jobs.indexOf(job); if (index !== -1) jobs.splice(index, 1);
    if (!jobs.length && frame !== null) { cancelAnimationFrame(frame); frame = null; }
  };
}
