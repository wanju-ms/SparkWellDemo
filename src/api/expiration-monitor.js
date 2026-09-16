export function createExpirationMonitor(service, { onError = error => console.error('Todo expiration scan failed:', error.message) } = {}) {
  let active = false
  let scanning = false
  let timer

  async function scan() {
    if (!active || scanning) return
    scanning = true
    try {
      const candidates = await service.overdueCandidates()
      for (const id of candidates) {
        if (!active) break
        try { await service.markOverdue(id) } catch (error) { onError(error) }
      }
    } catch (error) {
      onError(error)
    } finally {
      scanning = false
    }
  }

  return {
    start() {
      if (active) return Promise.resolve()
      active = true
      timer = setInterval(() => { void scan() }, 5000)
      timer.unref?.()
      return scan()
    },
    stop() {
      active = false
      clearInterval(timer)
    },
  }
}