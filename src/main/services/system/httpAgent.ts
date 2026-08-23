/**
 * httpAgent.ts
 * Configures global HTTP dispatcher with connection pooling, keepAlive and DNS caching
 * to drastically speed up downloading thousands of small game assets.
 */

import { Agent, setGlobalDispatcher } from 'undici'

let isDispatcherConfigured = false

export function initGlobalHttpDispatcher(): void {
  if (isDispatcherConfigured) return

  const customAgent = new Agent({
    keepAliveTimeout: 30_000,
    keepAliveMaxTimeout: 120_000,
    pipelining: 1,
    connections: 64, // high concurrency connection pool
    connect: {
      timeout: 15_000,
    },
  })

  setGlobalDispatcher(customAgent)
  isDispatcherConfigured = true
}
