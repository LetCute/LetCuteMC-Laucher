/**
 * Run async tasks with bounded concurrency.
 * ponytail: simple Promise.all pool, add worker threads if CPU-bound.
 */
export async function asyncPool<T, R>(
  concurrency: number,
  items: T[],
  task: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let currentIndex = 0

  async function worker() {
    while (currentIndex < items.length) {
      const idx = currentIndex++
      const item = items[idx]
      if (item !== undefined) {
        results[idx] = await task(item)
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker()
  )
  await Promise.all(workers)
  return results
}
