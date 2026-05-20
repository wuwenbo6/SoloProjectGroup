import { StateMachine } from '../../shared/types';

export interface ValidationError {
  message: string;
  line?: number;
  column?: number;
  severity: 'error' | 'warning';
}

export class Validator {
  validate(ast: StateMachine): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!ast.name) {
      errors.push({ message: 'State machine must have a name', severity: 'error' });
    }

    if (!ast.initial) {
      errors.push({ message: 'State machine must have an initial state', severity: 'error' });
    }

    const stateNames = ast.states.map(s => s.name);
    if (!stateNames.includes(ast.initial)) {
      errors.push({ message: `Initial state '${ast.initial}' not found in states`, severity: 'error' });
    }

    const stateNameSet = new Set<string>();
    for (const state of ast.states) {
      if (stateNameSet.has(state.name)) {
        errors.push({ message: `Duplicate state name '${state.name}'`, severity: 'error' });
      }
      stateNameSet.add(state.name);

      if (state.onEnter && !ast.actions.find(a => a.name === state.onEnter)) {
        errors.push({ message: `Action '${state.onEnter}' referenced but not defined`, severity: 'warning' });
      }
      if (state.onExit && !ast.actions.find(a => a.name === state.onExit)) {
        errors.push({ message: `Action '${state.onExit}' referenced but not defined`, severity: 'warning' });
      }

      for (const transition of state.transitions) {
        if (transition.target && !stateNames.includes(transition.target)) {
          errors.push({ message: `Target state '${transition.target}' not found for transition on '${transition.event}'`, severity: 'error' });
        }
        if (transition.action && !ast.actions.find(a => a.name === transition.action)) {
          errors.push({ message: `Action '${transition.action}' referenced but not defined`, severity: 'warning' });
        }
      }
    }

    const actionNameSet = new Set<string>();
    for (const action of ast.actions) {
      if (actionNameSet.has(action.name)) {
        errors.push({ message: `Duplicate action name '${action.name}'`, severity: 'error' });
      }
      actionNameSet.add(action.name);
    }

    if (ast.states.length === 0) {
      errors.push({ message: 'State machine has no states', severity: 'warning' });
    }

    return errors;
  }
}

export function validateDSL(ast: StateMachine): ValidationError[] {
  const validator = new Validator();
  return validator.validate(ast);
}
