import { createMachine, transition, applyEffects, cleanEffects } from './core.js'

export function createService(machineDescription, context = {}) {
  const machine = createMachine(machineDescription)

  // initial transition
  const initialState = { name: null }
  const initialEvent = { type: null }
  const [state, effects] = transition(machine, context, initialState, initialEvent)

  let cbs = []
  let running = true

  const service = {
    state,
    send,
    context,
    subscribe,
    machine,
    stop,
    runningEffects: [],
  }

  function runEffects(effects) {
    if (!effects) return

    let deferred = true
    const sendQueue = []

    const queueSend = (...args) => {
      if (deferred) {
        sendQueue.push(args)
      } else {
        service.send(...args)
      }
    }

    service.runningEffects = applyEffects(service.runningEffects, effects, context, queueSend)

    deferred = false
    for (const s of sendQueue) {
      service.send(...s)
    }
  }

  function stop() {
    running = false
    cbs = []
    service.runningEffects = cleanEffects(service.runningEffects)
  }

  function subscribe(fn) {
    cbs.push(fn)
    return () => {
      cbs = cbs.filter((f) => f !== fn)
    }
  }

  function send(event) {
    if (!running) return

    const [state, effects] = transition(service.machine, context, service.state, event)
    service.state = state
    if (effects) {
      runEffects(effects)
    }

    for (const cb of cbs) {
      cb(state)
    }
  }

  runEffects(effects)

  return service
}
