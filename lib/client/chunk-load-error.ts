/** A missing build asset needs a full document refresh, not a React retry. */
export function isChunkLoadError(error: Pick<Error, "message"> & { name?: string }) {
  return error.name === "ChunkLoadError" ||
    /failed to load chunk|loading (?:css )?chunk .+ failed|failed to fetch dynamically imported module|error loading dynamically imported module/i.test(error.message);
}
