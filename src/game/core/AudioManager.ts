export class AudioManager {
  static instance: AudioManager | null = null;
  ctx: AudioContext | null = null;
  isMuted = true;
  droneOscs: OscillatorNode[] = [];
  droneGain: GainNode | null = null;
  filterNode: BiquadFilterNode | null = null;
  filterLFO: OscillatorNode | null = null;
  filterLFOGain: GainNode | null = null;

  electricityGain: GainNode | null = null;

  heartbeatSpeed: number = 0;
  heartbeatInterval: any = null;
  heartbeatBPM: number = 60;

  constructor() {
    if (AudioManager.instance) {
      return AudioManager.instance;
    }
    AudioManager.instance = this;
  }

  static getInstance(): AudioManager {
    return AudioManager.instance ||= new AudioManager();
  }

  init() {
    if (!this.ctx) {
      try {
        const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
        this.ctx = new AudioContextClass();
        this.isMuted = false;
        this.setupDrone();
        this.setupElectricity();
        this.startHeartbeatLoop();
      } catch (e) {
        console.warn('Web Audio API is not supported in this browser:', e);
      }
    }
  }

  toggleMute(): boolean {
    if (!this.ctx) {
      this.init();
      return !this.isMuted;
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    this.isMuted = !this.isMuted;
    const volume = this.isMuted ? 0 : 0.12;
    if (this.droneGain) {
      this.droneGain.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.2);
    }
    if (this.electricityGain) {
      // Electricity gain is controlled dynamically by proximity, but we mute it if needed.
      this.electricityGain.gain.setTargetAtTime(this.isMuted ? 0 : 0, this.ctx.currentTime, 0.2);
    }
    return this.isMuted;
  }

  getMuteStatus(): boolean {
    return this.isMuted;
  }

  setupElectricity() {
    if (!this.ctx) return;
    this.electricityGain = this.ctx.createGain();
    this.electricityGain.gain.setValueAtTime(0, this.ctx.currentTime);

    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(120, this.ctx.currentTime); // 120Hz base buzz
    
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(121.5, this.ctx.currentTime); // slight detune creates harsh interference

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2500, this.ctx.currentTime); // Focus on the higher "Zzzz" frequencies
    filter.Q.setValueAtTime(3, this.ctx.currentTime);

    // Fast crackle LFO modulating the filter
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sawtooth';
    lfo.frequency.setValueAtTime(55, this.ctx.currentTime);
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(1500, this.ctx.currentTime);
    
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    osc1.connect(filter);
    osc2.connect(filter);
    
    // Add some extra gain because bandpass reduces overall volume
    const boostGain = this.ctx.createGain();
    boostGain.gain.setValueAtTime(2.5, this.ctx.currentTime);
    
    filter.connect(boostGain);
    boostGain.connect(this.electricityGain);
    this.electricityGain.connect(this.ctx.destination);
    
    osc1.start();
    osc2.start();
    lfo.start();
  }

  setElectricityProximity(distance: number) {
    if (!this.ctx || !this.electricityGain || this.isMuted) return;
    const maxDist = 900;
    // Map distance to volume exponentially for better spatial feel
    let vol = 0;
    if (distance < maxDist) {
      const normalized = 1 - (distance / maxDist);
      vol = Math.pow(normalized, 2) * 0.15; // Max volume 0.15
    }
    this.electricityGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.1);
  }

  setupDrone() {
    if (!this.ctx) return;
    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.setValueAtTime(this.isMuted ? 0 : 0.12, this.ctx.currentTime);

    this.filterNode = this.ctx.createBiquadFilter();
    this.filterNode.type = 'lowpass';
    this.filterNode.frequency.setValueAtTime(320, this.ctx.currentTime);
    this.filterNode.Q.setValueAtTime(3, this.ctx.currentTime);

    this.filterLFO = this.ctx.createOscillator();
    this.filterLFO.type = 'sine';
    this.filterLFO.frequency.setValueAtTime(0.08, this.ctx.currentTime);

    this.filterLFOGain = this.ctx.createGain();
    this.filterLFOGain.gain.setValueAtTime(80, this.ctx.currentTime);

    this.filterLFO.connect(this.filterLFOGain);
    this.filterLFOGain.connect(this.filterNode.frequency);
    this.filterLFO.start();

    [65.41, 77.78, 98, 116.54].forEach((freq, idx) => {
      if (!this.ctx || !this.filterNode) return;
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = idx % 2 === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      osc.detune.setValueAtTime((Math.random() - 0.5) * 8, this.ctx.currentTime);
      oscGain.gain.setValueAtTime(0.25, this.ctx.currentTime);

      osc.connect(oscGain);
      oscGain.connect(this.filterNode);
      osc.start();
      this.droneOscs.push(osc);
    });

    this.filterNode.connect(this.droneGain);
    this.droneGain.connect(this.ctx.destination);
  }

  setAtmosphereState(isReverie: boolean) {
    if (!this.ctx || !this.filterNode || this.isMuted) return;
    const t = this.ctx.currentTime;
    if (isReverie) {
      this.filterNode.type = 'bandpass';
      this.filterNode.frequency.setTargetAtTime(650, t, 0.8);
      this.filterNode.Q.setTargetAtTime(1.5, t, 0.8);
      if (this.filterLFO) {
        this.filterLFO.frequency.setTargetAtTime(0.18, t, 1);
      }
    } else {
      this.filterNode.type = 'lowpass';
      this.filterNode.frequency.setTargetAtTime(300, t, 0.6);
      this.filterNode.Q.setTargetAtTime(3.5, t, 0.6);
      if (this.filterLFO) {
        this.filterLFO.frequency.setTargetAtTime(0.08, t, 1);
      }
    }
  }

  startHeartbeatLoop() {
    const loop = () => {
      if (this.isMuted || !this.ctx) {
        this.heartbeatInterval = setTimeout(loop, 200);
        return;
      }
      const t = this.ctx.currentTime;
      this.heartbeatBPM = 60 + this.heartbeatSpeed * 80;
      const beatDuration = 60 / this.heartbeatBPM;
      this.playHeartbeatSound(t);
      this.playHeartbeatSound(t + 0.17);
      this.heartbeatInterval = setTimeout(loop, beatDuration * 1000);
    };
    loop();
  }

  playHeartbeatSound(time: number) {
    if (!this.ctx || this.isMuted) return;
    try {
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();
      osc.type = 'sine';
      const baseFreq = 50 + this.heartbeatSpeed * 12;
      osc.frequency.setValueAtTime(baseFreq, time);
      osc.frequency.exponentialRampToValueAtTime(10, time + 0.14);

      const maxGain = 0.15 + this.heartbeatSpeed * 0.22;
      gainNode.gain.setValueAtTime(0.001, time);
      gainNode.gain.exponentialRampToValueAtTime(maxGain, time + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);
      osc.start(time);
      osc.stop(time + 0.16);
    } catch (e) {
      console.warn('Failed to play heartbeat sound:', e);
    }
  }

  setHeartbeatSpeed(speed: number) {
    this.heartbeatSpeed = Math.max(0, Math.min(1, speed));
  }

  playCollectSound() {
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;
    [523.25, 622.25, 783.99, 1046.5].forEach((freq, idx) => {
      if (!this.ctx) return;
      const playTime = t + idx * 0.08;
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, playTime);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1500, playTime);

      gainNode.gain.setValueAtTime(0.001, playTime);
      gainNode.gain.exponentialRampToValueAtTime(0.2, playTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, playTime + 0.6);

      osc.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(this.ctx.destination);

      osc.start(playTime);
      osc.stop(playTime + 0.65);
    });
  }

  playTransitionSound(isReverie: boolean) {
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;
    const duration = 0.5;
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();
    osc.type = 'triangle';

    if (isReverie) {
      osc.frequency.setValueAtTime(180, t);
      osc.frequency.exponentialRampToValueAtTime(900, t + duration);
      gainNode.gain.setValueAtTime(0.001, t);
      gainNode.gain.linearRampToValueAtTime(0.18, t + 0.15);
      gainNode.gain.exponentialRampToValueAtTime(0.001, t + duration);
    } else {
      osc.frequency.setValueAtTime(800, t);
      osc.frequency.exponentialRampToValueAtTime(80, t + duration);
      gainNode.gain.setValueAtTime(0.001, t);
      gainNode.gain.linearRampToValueAtTime(0.25, t + 0.1);
      gainNode.gain.exponentialRampToValueAtTime(0.001, t + duration);
    }

    osc.connect(gainNode);
    gainNode.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + duration);
  }

  playShadowMergeSound() {
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;
    [130.81, 196, 261.63, 329.63, 392].forEach((freq, idx) => {
      if (!this.ctx) return;
      const delay = idx * 0.12;
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + delay);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, t + delay);

      gainNode.gain.setValueAtTime(0.001, t + delay);
      gainNode.gain.linearRampToValueAtTime(0.15, t + delay + 0.4);
      gainNode.gain.exponentialRampToValueAtTime(0.001, t + delay + 2.5);

      osc.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(this.ctx.destination);

      osc.start(t + delay);
      osc.stop(t + delay + 2.6);
    });
  }

  playLucidityWave() {
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, idx) => {
      if (!this.ctx) return;
      const delay = idx * 0.05;
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + delay);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.8, t + delay + 0.35);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1500, t + delay);
      filter.frequency.exponentialRampToValueAtTime(4500, t + delay + 0.35);
      filter.Q.setValueAtTime(4, t + delay);

      gainNode.gain.setValueAtTime(0.001, t + delay);
      gainNode.gain.linearRampToValueAtTime(0.08, t + delay + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.45);

      osc.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(this.ctx.destination);

      osc.start(t + delay);
      osc.stop(t + delay + 0.5);
    });
  }

  playHorrorStinger() {
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;
    
    // Aggressive sawtooth for a sudden scare
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(100, t);
    filter.frequency.exponentialRampToValueAtTime(8000, t + 0.1);
    filter.frequency.exponentialRampToValueAtTime(100, t + 1.5);
    
    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0.001, t);
    gainNode.gain.exponentialRampToValueAtTime(1.5, t + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.001, t + 2.0);
    
    osc.frequency.setValueAtTime(60, t);
    osc.frequency.linearRampToValueAtTime(150, t + 0.1);
    osc.frequency.linearRampToValueAtTime(40, t + 1.5);
    
    // Frequency modulation for glitchy noise
    const lfo = this.ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 45;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 500;
    
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    
    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.ctx.destination);
    
    lfo.start(t);
    osc.start(t);
    lfo.stop(t + 2.0);
    osc.stop(t + 2.0);
  }

  shutdown() {
    if (this.heartbeatInterval) {
      clearTimeout(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}