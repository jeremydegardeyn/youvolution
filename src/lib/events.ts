type Listener = () => void;

class EventEmitter {
  private listeners: Record<string, Listener[]> = {};

  on(event: string, listener: Listener) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(listener);
    return () => this.off(event, listener);
  }

  off(event: string, listener: Listener) {
    this.listeners[event] = (this.listeners[event] ?? []).filter(l => l !== listener);
  }

  emit(event: string) {
    (this.listeners[event] ?? []).forEach(l => l());
  }
}

export const appEvents = new EventEmitter();
export const PLAN_UPDATED = 'plan_updated';
export const MEAL_LOGGED = 'meal_logged';
