import { MachineDescription, useMachine } from 'react-machine'

interface LightStateSchema {
  states: {
    green: {};
    yellow: {};
    red: {
      states: {
        walk: {};
        wait: {};
        stop: {};
      };
    };
  };
}

interface LightContext {
  elapsed: number;
  a: number
}

type LightEvent =
  | { type: 'TIMER' }
  | { type: 'POWER_OUTAGE' }
  | { type: 'PED_COUNTDOWN', duration: number }

const machine: MachineDescription<LightContext, LightStateSchema, LightEvent> = ({ state, transition, enter }) => {
  state('green',
    transition('TIMER', 'yellow', {
      reduce: (ctx, { type, ...data }) => {
        if (type === 'PED_COUNTDOWN') {
          return { ...ctx, a: data.duration }
        }
        return ctx
      },
      guard: (ctx) => true
    }),
    enter({ effect: (ctx, event) => {}})
  )
}

export function TypoComponent () {
  const [state, send] = useMachine(machine)
}
