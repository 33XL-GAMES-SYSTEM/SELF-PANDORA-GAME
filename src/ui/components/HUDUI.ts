import { BaseUIComponent } from '../core/BaseUIComponent';
import { HUDStatus } from './hud/HUDStatus';
import { HUDRadar } from './hud/HUDRadar';
import { HUDFragments } from './hud/HUDFragments';

export class HUDUI extends BaseUIComponent {
  private overlay: HTMLElement | null = null;
  private activeFloatingElements: HTMLElement[] = [];

  public status: HUDStatus;
  public radar: HUDRadar;
  public fragments: HUDFragments;

  constructor(onExitToSelector: () => void, onOpenSettings: () => void) {
    super('hud-overlay', 'absolute inset-0 pointer-events-none flex flex-col justify-between p-8 transition-all duration-500 overflow-hidden opacity-0');
    
    this.container.innerHTML = `
      <!-- Cabeçalho HUD -->
      <div class="flex justify-between items-start w-full pointer-events-none">
        
        <!-- Esquerda Superior: Slot do Status -->
        <div id="hud-top-left-slot"></div>

        <!-- Direita Superior: Engrenagem de Configurações -->
        <div class="hud-right flex flex-col items-end pointer-events-auto">
          <button id="btn-open-settings" class="flex items-center justify-center w-11 h-11 rounded-full border border-white/15 bg-black/40 hover:bg-white/10 hover:border-white/40 hover:shadow-[0_0_20px_rgba(255,255,255,0.2)] backdrop-blur-md transition-all duration-500 group">
            <svg class="w-5 h-5 text-zinc-300 group-hover:text-white group-hover:rotate-90 transition-all duration-700 ease-out pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
            </svg>
          </button>
        </div>
      </div>

      <!-- Centro: Subtítulos e Pensamentos Poéticos -->
      <div id="thoughts-overlay" class="absolute inset-0 pointer-events-none w-full h-full z-0 flex flex-col justify-center items-center">
        <!-- Textos flutuantes -->
      </div>

      <!-- Rodapé HUD: Radar, Dicas e Complementar -->
      <div class="absolute bottom-8 left-8 right-8 flex justify-between items-end pointer-events-none">
        
        <!-- Canto Inferior Esquerdo (Radar Slot) -->
        <div id="hud-bottom-left-slot"></div>

        <!-- Centro Inferior (Dicas) -->
        <div class="text-[9px] tracking-widest uppercase text-zinc-500 font-mono mb-2 drop-shadow-md">
           Mouse Mover Cam • Scroll Zoom • W/A/S/D Mover • E Lucidez
        </div>

        <!-- Canto Inferior Direito (Elpis Slot) -->
        <div id="hud-bottom-right-slot"></div>
      </div>
    `;

    this.overlay = this.container.querySelector('#thoughts-overlay');

    // Add settings click listener
    this.container.querySelector('#btn-open-settings')?.addEventListener('click', onOpenSettings);

    // Inicializar os sub-componentes
    this.status = new HUDStatus();
    this.radar = new HUDRadar();
    this.fragments = new HUDFragments(onExitToSelector);

    // Inserir na árvore DOM da HUD
    this.container.querySelector('#hud-top-left-slot')?.appendChild(this.status.getElement());
    this.container.querySelector('#hud-bottom-left-slot')?.appendChild(this.radar.getElement());
    this.container.querySelector('#hud-bottom-right-slot')?.appendChild(this.fragments.getElement());
  }

  protected override onShow(): void {
    super.onShow();
    this.container.classList.add('opacity-100');
    this.container.classList.remove('opacity-0');
  }

  protected override onHide(): void {
    super.onHide();
    this.container.classList.remove('opacity-100');
    this.container.classList.add('opacity-0');
  }

  public triggerFloatingThought(text: string, x: number, y: number) {
    if (!this.overlay) return;
    const r = document.createElement('div');
    r.className = 'floating-thought';
    r.innerText = text;
    const leftPct = x * 100;
    const topPct = y * 100;
    r.style.left = `${leftPct}%`;
    r.style.top = `${topPct}%`;
    r.style.opacity = '0';
    r.style.transform = 'translate(-50%, 0) scale(0.95)';
    this.overlay.appendChild(r);
    this.activeFloatingElements.push(r);
    requestAnimationFrame(() => {
      r.style.opacity = '0.85';
      r.style.transform = 'translate(-50%, -25px) scale(1)';
    });
    setTimeout(() => {
      r.style.opacity = '0';
      r.style.transform = 'translate(-50%, -65px) scale(1.05)';
      setTimeout(() => {
        if (r.parentNode) {
          r.parentNode.removeChild(r);
        }
        this.activeFloatingElements = this.activeFloatingElements.filter(e => e !== r);
      }, 1500);
    }, 2800);
  }

  public showStorySubtitle(text: string, duration = 4000) {
    if (!this.overlay) return;
    const existing = this.overlay.querySelector('.story-subtitle');
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }
    const r = document.createElement('div');
    r.className = 'story-subtitle';
    this.overlay.appendChild(r);
    let currentText = '';
    let charIdx = 0;
    const typeWriter = () => {
      if (charIdx < text.length) {
        currentText += text.charAt(charIdx);
        r.innerText = currentText;
        charIdx++;
        setTimeout(typeWriter, 35);
      }
    };
    r.style.opacity = '0.9';
    typeWriter();
    setTimeout(() => {
      r.style.opacity = '0';
      r.style.transform = 'translate(-50%, -15px)';
      setTimeout(() => {
        if (r.parentNode) {
          r.parentNode.removeChild(r);
        }
      }, 1200);
    }, duration);
  }

  public clearAll() {
    if (this.overlay) {
      this.overlay.innerHTML = '';
    }
    this.activeFloatingElements = [];
  }
}
