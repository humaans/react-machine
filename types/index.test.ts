import { MachineDescription, useMachine } from 'react-machine'

interface Context = {}

type Event = {
  type: 'foo',
  a: number
} | {
  type: 'bar'
}

const machine: MachineDescription<Context, Event> = ({ state, transition }) => {
  state('abc',
    transition('event', 'def', { reduce: (ctx, { type, ...data }) => ({ ...ctx, a: data.a }) })
  )
}

export function TypoComponent () {
  const [state, send] = useMachine(machine)
}
