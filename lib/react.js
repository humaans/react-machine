import { useState, useEffect, useMemo } from 'react'
import { createMachine } from './core'

export function useMachine(description, context, options = {}) {
  const { assign = 'assign' } = options

  const machine = useState(() => createMachine(description, context), [])
  const [state, setState] = useState(machine.current)
  const send = machine.send

  useEffect(() => {
    return machine.subscribe(setState)
  }, [machine])

  useEffect(() => {
    send({ type: assign, ...context })
  }, Object.values(context))

  useEffect(() => {
    machine.flushEffects()
  }, [state])

  useEffect(() => {
    return () => {
      machine.cleanEffects()
    }
  }, [])

  return useMemo(
    {
      name: state.name,
      context: state.context,
      send,
    },
    [state]
  )
}
