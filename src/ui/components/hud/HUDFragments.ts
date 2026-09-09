import { BaseUIComponent } from '../../core/BaseUIComponent';

export class HUDFragments extends BaseUIComponent {
  private remEl: HTMLElement | null = null;
  private onExitToSelector: () => void;

  constructor(onExitToSelector: () => void) {
    super('hud-bottom-right', 'hud-bottom-right flex flex-col items-end gap-3 pointer-events-auto');
    this.onExitToSelector = onExitToSelector;

    this.container.innerHTML = `
      <button id="btn-exit-to-selector" class="px-5 py-2 text-[10px] font-semibold uppercase tracking-widest border border-white/15 rounded bg-black/50 hover:bg-white/20 transition-all backdrop-blur-md shadow-lg text-zinc-300 hover:text-white">
        ESC: Retornar
      </button>
      
      <div class="flex items-center gap-4 border border-white/15 bg-black/50 backdrop-blur-md px-5 py-3 rounded-lg shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:border-white/30 transition-colors cursor-default">
        <div class="flex flex-col items-end">
          <span class="text-[9px] uppercase tracking-widest text-zinc-400 font-bold mb-0.5">Elpis</span>
          <span id="hud-elpis" class="text-sm font-mono text-white tracking-wider">0 / 3</span>
        </div>
        <div class="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center bg-white/5 relative overflow-hidden">
          <div class="absolute inset-0 bg-white/20 animate-pulse opacity-50"></div>
          <svg class="w-4 h-4 text-white relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
      </div>
    `;

    this.container.querySelector('#btn-exit-to-selector')?.addEventListener('click', this.onExitToSelector);
    this.remEl = this.container.querySelector('#hud-elpis');
  }

  public updateCount(collected: number, total: number) {
    if (this.remEl) this.remEl.innerText = `${collected} / ${total}`;
  }
}
