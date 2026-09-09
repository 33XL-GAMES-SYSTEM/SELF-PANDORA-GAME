import { BaseUIComponent } from '../../core/BaseUIComponent';

export class HUDStatus extends BaseUIComponent {
  private levelNumEl: HTMLElement | null = null;
  private levelTagEl: HTMLElement | null = null;
  private waveStatusEl: HTMLElement | null = null;
  private waveCooldownBarEl: HTMLElement | null = null;
  private sanityBarEl: HTMLElement | null = null;
  private sanityLabelEl: HTMLElement | null = null;
  private sanityValueEl: HTMLElement | null = null;

  constructor() {
    super('hud-status', 'hud-left flex flex-col gap-4 pointer-events-auto w-72');
    
    this.container.innerHTML = `
      <!-- Info da Fase -->
      <div>
        <h3 id="hud-level-num" class="text-sm font-semibold tracking-widest text-white uppercase drop-shadow-md">
          Fase 1: Sycamore Valley
        </h3>
        <p id="hud-level-tag" class="font-serif italic text-xs text-zinc-400 mt-0.5">
          Normalidade
        </p>
      </div>
      
      <!-- Barra de Sanidade -->
      <div class="flex flex-col gap-1.5" id="hud-sanity-container">
         <div class="flex justify-between items-end">
           <span class="text-[10px] uppercase tracking-widest text-zinc-300 font-bold drop-shadow">Sanidade</span>
           <span id="hud-sanity-value" class="text-[9px] uppercase text-white font-mono bg-white/10 px-1.5 py-0.5 rounded">100%</span>
         </div>
         <div class="relative w-full h-2.5 bg-zinc-900/80 rounded border border-white/20 overflow-hidden shadow-[0_0_10px_rgba(255,255,255,0.05)]">
           <div id="hud-sanity-bar" class="h-full transition-all duration-700 w-full shadow-[0_0_12px_rgba(255,255,255,0.8)] bg-gradient-to-r from-zinc-400 via-white to-zinc-300"></div>
         </div>
      </div>

      <!-- Barra de Lucidez Melhorada -->
      <div class="flex flex-col gap-1.5">
         <div class="flex justify-between items-end">
           <span class="text-[10px] uppercase tracking-widest text-zinc-300 font-bold drop-shadow">Onda de Lucidez (E)</span>
           <span id="hud-wave-status" class="text-[9px] uppercase text-white font-mono bg-white/10 px-1.5 py-0.5 rounded">Pronta</span>
         </div>
         <div class="relative w-full h-2.5 bg-zinc-900/80 rounded border border-white/20 overflow-hidden shadow-[0_0_10px_rgba(255,255,255,0.05)]">
           <div class="absolute inset-0 flex justify-between px-6 pointer-events-none opacity-20">
              <div class="w-[1px] h-full bg-white"></div>
              <div class="w-[1px] h-full bg-white"></div>
              <div class="w-[1px] h-full bg-white"></div>
           </div>
           <div id="hud-wave-cooldown-bar" class="h-full bg-gradient-to-r from-zinc-500 via-white to-zinc-400 transition-all duration-200 w-full shadow-[0_0_12px_rgba(255,255,255,0.8)]"></div>
         </div>
      </div>
      
      <!-- Botão de Inventário -->
      <button class="flex items-center justify-center gap-2 border border-white/20 bg-black/40 hover:bg-white/10 text-white backdrop-blur-md px-3 py-2 rounded text-[10px] tracking-widest uppercase transition-all duration-300 group shadow-lg w-max">
        <svg class="w-3.5 h-3.5 text-zinc-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
        Inventário
      </button>
    `;

    this.levelNumEl = this.container.querySelector('#hud-level-num');
    this.levelTagEl = this.container.querySelector('#hud-level-tag');
    this.waveStatusEl = this.container.querySelector('#hud-wave-status');
    this.waveCooldownBarEl = this.container.querySelector('#hud-wave-cooldown-bar');
    this.sanityBarEl   = this.container.querySelector('#hud-sanity-bar');
    this.sanityValueEl = this.container.querySelector('#hud-sanity-value');
  }

  public updateLevel(num: number, title: string, tag: string) {
    if (this.levelNumEl) this.levelNumEl.innerText = `Fase ${num}: ${title}`;
    if (this.levelTagEl) this.levelTagEl.innerText = tag;
  }

  public updateWaveCooldown(ratio: number) {
    if (!this.waveCooldownBarEl || !this.waveStatusEl) return;
    
    this.waveCooldownBarEl.style.width = `${ratio * 100}%`;
    if (ratio < 1) {
      this.waveStatusEl.innerText = 'Recarregando...';
      this.waveStatusEl.className = 'text-[9px] uppercase text-zinc-400 font-mono bg-zinc-800/50 px-1.5 py-0.5 rounded';
      this.waveCooldownBarEl.className = 'h-full bg-zinc-600 transition-all duration-200 w-full';
    } else {
      this.waveStatusEl.innerText = 'Pronta';
      this.waveStatusEl.className = 'text-[9px] uppercase text-white font-mono bg-white/20 px-1.5 py-0.5 rounded shadow-[0_0_10px_rgba(255,255,255,0.3)]';
      this.waveCooldownBarEl.className = 'h-full bg-gradient-to-r from-zinc-500 via-white to-zinc-400 transition-all duration-200 w-full shadow-[0_0_12px_rgba(255,255,255,0.8)]';
    }
  }

  /**
   * Update the sanity bar visuals.
   * @param sanity  value from 0..1
   */
  public updateSanity(sanity: number) {
    if (!this.sanityBarEl || !this.sanityValueEl) return;

    const pct = Math.round(sanity * 100);
    this.sanityValueEl.innerText = `${pct}%`;
    this.sanityBarEl.style.width = `${pct}%`;

    if (sanity > 0.6) {
      // Healthy — white/grey glow
      this.sanityBarEl.className =
        'h-full transition-all duration-700 shadow-[0_0_12px_rgba(255,255,255,0.6)] bg-gradient-to-r from-zinc-400 via-white to-zinc-300';
      this.sanityValueEl.className =
        'text-[9px] uppercase text-white font-mono bg-white/10 px-1.5 py-0.5 rounded';
    } else if (sanity > 0.35) {
      // Degraded — yellow warning
      this.sanityBarEl.className =
        'h-full transition-all duration-700 shadow-[0_0_12px_rgba(255,220,50,0.6)] bg-gradient-to-r from-yellow-700 via-yellow-400 to-yellow-300';
      this.sanityValueEl.className =
        'text-[9px] uppercase text-yellow-300 font-mono bg-yellow-900/40 px-1.5 py-0.5 rounded';
    } else if (sanity > 0.15) {
      // Dangerous — orange/red
      this.sanityBarEl.className =
        'h-full transition-all duration-700 shadow-[0_0_14px_rgba(255,80,40,0.7)] bg-gradient-to-r from-red-900 via-red-500 to-orange-400';
      this.sanityValueEl.className =
        'text-[9px] uppercase text-orange-300 font-mono bg-red-900/50 px-1.5 py-0.5 rounded';
    } else {
      // Critical — deep red, pulsing
      this.sanityBarEl.className =
        'h-full transition-all duration-300 shadow-[0_0_18px_rgba(255,30,30,0.9)] bg-gradient-to-r from-red-950 via-red-600 to-red-400 sanity-critical-pulse';
      this.sanityValueEl.className =
        'text-[9px] uppercase text-red-300 font-mono bg-red-950/70 px-1.5 py-0.5 rounded sanity-critical-pulse';
    }
  }
}

