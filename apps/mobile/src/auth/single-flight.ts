/** Shares the complete operation, including credential persistence, across callers. */
export function singleFlight<T>(operation: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | undefined;
  return () => {
    if (!pending) {
      pending = Promise.resolve().then(operation).finally(() => { pending = undefined; });
    }
    return pending;
  };
}
