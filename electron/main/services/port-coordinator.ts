import type { PortMode } from '../../../shared/ipc';

type ModeListener = (mode: PortMode) => void;

export class PortCoordinator {
  #mode: PortMode = 'idle';
  #listeners = new Set<ModeListener>();

  getMode(): PortMode {
    return this.#mode;
  }

  onModeChange(cb: ModeListener): () => void {
    this.#listeners.add(cb);
    return () => this.#listeners.delete(cb);
  }

  requestSerial(): boolean {
    if (this.#mode === 'flashing') return false;
    this.#set('serial');
    return true;
  }

  requestFlashing(opts?: { onPreemptSerial?: () => void }): boolean {
    if (this.#mode === 'serial') opts?.onPreemptSerial?.();
    this.#set('flashing');
    return true;
  }

  releaseToIdle(): void {
    this.#set('idle');
  }

  #set(mode: PortMode): void {
    if (this.#mode === mode) return;
    this.#mode = mode;
    for (const cb of this.#listeners) cb(mode);
  }
}
