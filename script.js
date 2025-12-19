/**
 * NEUROFLOW v3.1 - Refined Audio & UI
 */

// --- DADOS DE PERFIS ---
const PROFILES = {
    'deep_focus': { 
        volDrone: 0.6, volPink: 0.15, volSea: 0.0, volWind: 0.0, volSynth: 0.25, volBinaural: 0.05, 
        volRain: 0.0, volThunder: 0.0,
        seaSpeed: 1, seaPanAmt: 0, windPanAmt: 0 
    },
    'ocean_flow': { 
        volDrone: 0.0, volPink: 0.0, volSea: 0.75, volWind: 0.15, volSynth: 0, volBinaural: 0.0, 
        volRain: 0.0, volThunder: 0.0,
        seaSpeed: 1.1, seaPanAmt: 0.6, windPanAmt: 0.2 
    },
    'stormy_cabin': { 
        volDrone: 0.0, volPink: 0.0, volSea: 0.0, volWind: 0.1, volSynth: 0.05, volBinaural: 0.0, 
        volRain: 0.1, volThunder: 1.0,
        seaSpeed: 2.2, seaPanAmt: 0.3, windPanAmt: 0.8 
    },
    'zen_garden': { 
        volDrone: 0.3, volPink: 0.05, volSea: 0.3, volWind: 0.2, volSynth: 0.45, volBinaural: 0.0, 
        volRain: 0.1, volThunder: 0.0,
        seaSpeed: 0.8, seaPanAmt: 0.2, windPanAmt: 0.4 
    },
    'beta_boost': { 
        volDrone: 0.5, volPink: 0.2, volSea: 0.0, volWind: 0.0, volSynth: 0.0, volBinaural: 0.4, 
        volRain: 0.0, volThunder: 0.0,
        seaSpeed: 1, seaPanAmt: 0, windPanAmt: 0 
    }
};

// --- ESTADO DA APLICAÇÃO ---
const AppState = {
    isPlaying: false,
    currentProfile: 'deep_focus',
    masterVolume: 0.8,
    params: { ...PROFILES['deep_focus'] },
    pomodoro: { timeLeft: 25 * 60, isBreak: false, interval: null }
};

// --- AUDIO ENGINE ---
const AudioEngine = {
    ctx: null, 
    masterNode: null, 
    nodes: {}, 
    loops: [], 
    buffers: {},

    init() {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
        
        // Master Gain
        this.masterNode = this.ctx.createGain();
        this.masterNode.gain.value = AppState.masterVolume;
        
        // Compressor
        const compressor = this.ctx.createDynamicsCompressor();
        compressor.threshold.value = -12; 
        compressor.knee.value = 30;
        compressor.ratio.value = 4;
        compressor.attack.value = 0.01;
        compressor.release.value = 0.25;
        
        this.masterNode.connect(compressor).connect(this.ctx.destination);

        // Pre-generate buffers
        this.buffers.brown = this.createNoise('brown');
        this.buffers.white = this.createNoise('white');
        this.buffers.pink = this.createNoise('pink');

        this.setupMonitor(compressor);
    },

    createNoise(type) {
        const size = 2 * this.ctx.sampleRate;
        const buffer = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        if (type === 'white') {
            for(let i=0; i<size; i++) data[i] = Math.random()*2-1;
        } else if (type === 'brown') {
            let last = 0;
            for(let i=0; i<size; i++) {
                const w = Math.random()*2-1;
                data[i] = (last + (0.02 * w)) / 1.02; last = data[i]; data[i] *= 3.5;
            }
        } else { // Pink
            let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
            for(let i=0; i<size; i++) {
                const w = Math.random()*2-1;
                b0=0.99886*b0+w*0.0555179; b1=0.99332*b1+w*0.0753030; b2=0.969*b2+w*0.1538520;
                b3=0.8665*b3+w*0.3104856; b4=0.55*b4+w*0.5329522; b5=-0.7616*b5-w*0.0168980;
                data[i] = (b0+b1+b2+b3+b4+b5+b6+w*0.5362)*0.11; b6=w*0.115926;
            }
        }
        return buffer;
    },

    // --- SOUND GENERATORS ---

    startSea() {
        // MAR: White Noise + Bandpass (Agudos/Espuma)
        const src = this.ctx.createBufferSource();
        src.buffer = this.buffers.white; src.loop = true;
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass'; filter.Q.value = 0.8; // Q aumentado levemente para mais definição

        const waveGain = this.ctx.createGain(); waveGain.gain.value = 0;
        const panner = this.ctx.createStereoPanner();
        const chanGain = this.ctx.createGain(); chanGain.gain.value = AppState.params.volSea;

        src.connect(filter).connect(waveGain).connect(panner).connect(chanGain).connect(this.masterNode);
        src.start();

        const loop = () => {
            if(!AppState.isPlaying) return;
            const now = this.ctx.currentTime;
            
            // Dinâmica de Onda Restaurada: Sobe rápido, quebra, recua devagar
            const speed = AppState.params.seaSpeed; 
            const cycle = 8 / speed; // Ciclo base

            // Envelope de Volume (Ataque da onda)
            waveGain.gain.cancelScheduledValues(now);
            waveGain.gain.setValueAtTime(waveGain.gain.value, now);
            waveGain.gain.linearRampToValueAtTime(0.9, now + (cycle * 0.3)); // Sobe
            waveGain.gain.exponentialRampToValueAtTime(0.1, now + cycle);    // Desce

            // Filtro (Movimento da água)
            filter.frequency.cancelScheduledValues(now);
            filter.frequency.setValueAtTime(filter.frequency.value, now);
            filter.frequency.linearRampToValueAtTime(600, now + (cycle * 0.25));
            filter.frequency.exponentialRampToValueAtTime(150, now + cycle);

            // Pan leve
            if(AppState.params.seaPanAmt > 0.1) {
                const panPos = (Math.random() * 0.5 - 0.25) * AppState.params.seaPanAmt;
                panner.pan.linearRampToValueAtTime(panPos, now + cycle);
            }

            this.loops.push(setTimeout(loop, cycle * 1000));
        };
        loop();
        this.nodes.sea = chanGain;
    },

    startWind() {
        // VENTO: Brown Noise + Lowpass (Grave/Uivo)
        const src = this.ctx.createBufferSource();
        src.buffer = this.buffers.brown; src.loop = true;
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass'; 
        // Aumentado levemente o cut-off base para trazer mais "ar" (agudos)
        filter.frequency.value = 350; 

        const gustGain = this.ctx.createGain(); gustGain.gain.value = 0;
        const panner = this.ctx.createStereoPanner();
        const chanGain = this.ctx.createGain(); chanGain.gain.value = AppState.params.volWind;

        src.connect(filter).connect(gustGain).connect(panner).connect(chanGain).connect(this.masterNode);
        src.start();

        const loop = () => {
            if(!AppState.isPlaying) return;
            const now = this.ctx.currentTime;
            const cycle = 5; 

            // Envelope de rajada
            gustGain.gain.linearRampToValueAtTime(0.7, now + (cycle*0.4));
            gustGain.gain.exponentialRampToValueAtTime(0.15, now + cycle);

            // Filtro dinâmico (com pico mais alto para agudos)
            filter.frequency.linearRampToValueAtTime(850, now + (cycle*0.35)); // Mais agudo no pico
            filter.frequency.exponentialRampToValueAtTime(200, now + cycle);

            // Pan Rápido (2s)
            if(AppState.params.windPanAmt > 0.1) {
                const side = Math.random() > 0.5 ? 1 : -1;
                const intensity = 0.2 + (Math.random() * 0.6);
                const targetPan = side * intensity * AppState.params.windPanAmt;
                // Transição encurtada para 2s
                panner.pan.setTargetAtTime(targetPan, now, 0.5); // timeConstant menor = mais rápido
            }

            this.loops.push(setTimeout(loop, cycle * 1000));
        };
        loop();
        this.nodes.wind = chanGain;
    },

    startRain() {
        // CHUVA: Pink Noise + Highpass (Constante)
        const src = this.ctx.createBufferSource();
        src.buffer = this.buffers.pink; src.loop = true;
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass'; filter.frequency.value = 800; // Corta graves para som de chuva fina/média

        const chanGain = this.ctx.createGain(); chanGain.gain.value = AppState.params.volRain;
        
        src.connect(filter).connect(chanGain).connect(this.masterNode);
        src.start();
        this.nodes.rain = chanGain;
    },

    startThunder() {
        const chanGain = this.ctx.createGain(); 
        chanGain.gain.value = AppState.params.volThunder;
        chanGain.connect(this.masterNode);
        this.nodes.thunder = chanGain;

        const loop = () => {
            if(!AppState.isPlaying) return;
            
            if(AppState.params.volThunder > 0.01) {
                UI.triggerFlash();

                const src = this.ctx.createBufferSource();
                src.buffer = this.buffers.brown; 
		src.loop = true;
                
		const filter = this.ctx.createBiquadFilter();
                filter.type = 'lowpass'; 
                
                const thunderGain = this.ctx.createGain();
                thunderGain.gain.value = 0; 

                const panner = this.ctx.createStereoPanner();
                panner.pan.value = (Math.random() * 1.6) - 0.8;

                src.connect(filter).connect(thunderGain).connect(panner).connect(chanGain);
                
                const now = this.ctx.currentTime;
                // DURAÇÃO MASSIVA: 25 a 40 segundos
                const duration = 7 + Math.random() * 15; 

                // --- CURVA LONGAM (Rumble Sustentado) ---
                const segments = 200; 
                const curve = new Float32Array(segments);
                
                // Ataque
                curve[0] = 0;
                curve[1] = 0.9; 
                
                for (let i = 2; i < segments; i++) {
                    const progress = i / segments;
                    
                    let baseEnv;
                    // Mantém volume ALTO e oscilante por 70% do tempo
                    if (progress < 0.7) {
                        // Flutua entre 0.4 e 0.7 para simular o "rolar" constante nas nuvens
                        baseEnv = 0.55; 
                    } else {
                        // Fade out lento nos últimos 30%
                        const fadeProg = (progress - 0.7) / 0.3;
                        baseEnv = 0.55 * (1 - fadeProg); 
                    }

                    // Variação constante (textura de rumble)
                    const wobble = (Math.random() - 0.5) * 0.4; 
                    
                    // Garante que não zere abruptamente no meio
                    curve[i] = Math.max(0, baseEnv + wobble);
                }
                // Garante final zero suave
                curve[segments - 1] = 0;
                curve[segments - 2] = 0.01;

                thunderGain.gain.setValueCurveAtTime(curve, now, duration);

                // --- FILTRO ---
                // Começa em 400Hz e desce LINEARMENTE para 40Hz
                // Linear mantém o grave audível por mais tempo que o exponencial
                filter.frequency.setValueAtTime(400, now); 
                filter.frequency.linearRampToValueAtTime(40, now + duration); 

                src.start(now);
                src.stop(now + duration + 0.5);
            }
            
            // Loop longo para respeitar a duração do trovão
            this.loops.push(setTimeout(loop, 20000 + Math.random() * 10000));
        };
        loop();
    },

    startDrone() {
        const osc = this.ctx.createOscillator(); osc.frequency.value = 55; // A1
        const lpf = this.ctx.createBiquadFilter(); lpf.frequency.value = 130;
        const g = this.ctx.createGain(); g.gain.value = AppState.params.volDrone;
        osc.connect(lpf).connect(g).connect(this.masterNode);
        osc.start();
        this.nodes.drone = g;
    },

    startPink() {
        const src = this.ctx.createBufferSource(); src.buffer = this.buffers.pink; src.loop = true;
        const g = this.ctx.createGain(); g.gain.value = AppState.params.volPink;
        src.connect(g).connect(this.masterNode); src.start();
        this.nodes.pink = g;
    },

    startBinaural() {
        const base = 200;
        const diff = 14; 
        const oL = this.ctx.createOscillator(); oL.frequency.value = base;
        const oR = this.ctx.createOscillator(); oR.frequency.value = base + diff;
        const pL = this.ctx.createStereoPanner(); pL.pan.value = -1;
        const pR = this.ctx.createStereoPanner(); pR.pan.value = 1;
        const g = this.ctx.createGain(); g.gain.value = AppState.params.volBinaural;
        oL.connect(pL).connect(g); oR.connect(pR).connect(g);
        g.connect(this.masterNode); oL.start(); oR.start();
        this.nodes.binaural = g;
    },

    startSynth() {
        const synthMaster = this.ctx.createGain();
        synthMaster.gain.value = AppState.params.volSynth;
        synthMaster.connect(this.masterNode);
        this.nodes.synth = synthMaster;

        const scale = [220, 261.63, 293.66, 329.63, 392.00]; 
        const loop = () => {
            if(!AppState.isPlaying) return;
            if(AppState.params.volSynth > 0.001) {
                const osc = this.ctx.createOscillator();
                osc.type = 'sine';
                osc.frequency.value = scale[Math.floor(Math.random()*scale.length)];
                
                const noteGain = this.ctx.createGain();
                const pan = this.ctx.createStereoPanner();
                pan.pan.value = Math.random()*0.8 - 0.4;
                
                noteGain.gain.setValueAtTime(0, this.ctx.currentTime);
                noteGain.gain.linearRampToValueAtTime(0.4, this.ctx.currentTime + 1);
                noteGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 4);

                osc.connect(pan).connect(noteGain).connect(synthMaster);
                
                osc.start(); 
                osc.stop(this.ctx.currentTime + 4.5);
                setTimeout(() => { noteGain.disconnect(); pan.disconnect(); }, 4600);

                UI.triggerVisualizer();
            }
            this.loops.push(setTimeout(loop, 4000 + Math.random()*3000));
        };
        loop();
    },

    // --- CONTROLES GERAIS ---
    start() {
        if(!this.ctx) this.init();
        if(this.ctx.state === 'suspended') this.ctx.resume();
        AppState.isPlaying = true;
        
        this.startDrone();
        this.startPink();
        this.startSea();
        this.startWind();
        this.startRain();    // NOVO
        this.startThunder(); // NOVO
        this.startBinaural();
        this.startSynth();
    },


    stop() {
        AppState.isPlaying = false;
        this.loops.forEach(l => clearTimeout(l)); this.loops = [];
        
        if(this.masterNode) {
            this.masterNode.gain.setTargetAtTime(0, this.ctx.currentTime, 0.5);
        }

        setTimeout(() => {
            if(this.ctx) this.ctx.suspend();
            this.nodes = {};
            // Reset master gain for next start
            if(this.masterNode) this.masterNode.gain.value = AppState.masterVolume;
        }, 600);
    },

    updateParam(key, val) {
        if(this.nodes[key]) {
            // Atualização imediata do GainNode
            this.nodes[key].gain.setTargetAtTime(val, this.ctx.currentTime, 0.1);
        }
    },

    setMasterVolume(val) {
        if(this.masterNode) this.masterNode.gain.setTargetAtTime(val, this.ctx.currentTime, 0.1);
    },

    setupMonitor(node) {
        const an = this.ctx.createAnalyser(); an.fftSize = 256;
        node.connect(an);
        const data = new Uint8Array(an.frequencyBinCount);
        const warn = document.getElementById('volume-warning');
        let frames = 0;
        const check = () => {
            if(AppState.isPlaying) {
                an.getByteTimeDomainData(data);
                let sum = 0; for(let i=0; i<data.length; i++) { let v=(data[i]-128)/128; sum+=v*v; }
                const rms = Math.sqrt(sum/data.length);
                // Threshold um pouco mais alto pois reduzimos a compressão
                if(rms > 0.6) frames++; else frames=Math.max(0, frames-1);
                
                if(frames > 40) warn.classList.add('active');
                else if(frames < 10) warn.classList.remove('active');
            }
            requestAnimationFrame(check);
        };
        check();
    }
};

// --- UI CONTROLLER ---
const UI = {
    init() {
        this.cacheDOM();
        this.bindEvents();
        this.renderParams();
    },

    cacheDOM() {
        this.dom = {
            playBtn: document.getElementById('btn-play'),
            skipBtn: document.getElementById('btn-skip'),
            timerDisplay: document.getElementById('timer-display'),
            timerStatus: document.getElementById('timer-status'),
            visualizer: document.getElementById('visualizer'),
            bgLayer: document.getElementById('bg-layer'),
            
            // Popups Triggers
            btnProfiles: document.getElementById('btn-profiles'),
            popupProfiles: document.getElementById('popup-profiles'),
            btnVolume: document.getElementById('btn-volume'),
            popupVolume: document.getElementById('popup-volume'),
            
            // Mixer
            mixerPanel: document.getElementById('mixer-panel'),
            btnMixer: document.getElementById('btn-mixer'),
            btnCloseMixer: document.getElementById('btn-close-mixer'),
            
            // Inputs
            masterSlider: document.getElementById('master-volume'),
            profileOptions: document.querySelectorAll('.profile-option'),
            paramSliders: document.querySelectorAll('input[data-param]'),
            
            // Icons
            iconPlay: document.getElementById('icon-play'),
            iconPause: document.getElementById('icon-pause')
        };
    },

    bindEvents() {
        // Toggle Popups (close others when opening one)
        this.dom.btnProfiles.addEventListener('click', (e) => {
            e.stopPropagation();
            this.togglePopup(this.dom.popupProfiles);
        });
        
        this.dom.btnVolume.addEventListener('click', (e) => {
            e.stopPropagation();
            this.togglePopup(this.dom.popupVolume);
        });

        // Close popups on outside click
        document.addEventListener('click', (e) => {
            if(!this.dom.popupProfiles.contains(e.target) && e.target !== this.dom.btnProfiles) {
                this.dom.popupProfiles.classList.remove('show');
                this.dom.btnProfiles.classList.remove('active');
            }
            if(!this.dom.popupVolume.contains(e.target) && e.target !== this.dom.btnVolume) {
                this.dom.popupVolume.classList.remove('show');
                this.dom.btnVolume.classList.remove('active');
            }
        });

        // Mixer Panel
        this.dom.btnMixer.addEventListener('click', () => {
            this.dom.mixerPanel.classList.add('open');
            this.dom.btnMixer.classList.add('active');
        });
        this.dom.btnCloseMixer.addEventListener('click', () => {
            this.dom.mixerPanel.classList.remove('open');
            this.dom.btnMixer.classList.remove('active');
        });

        // Play/Pause
        this.dom.playBtn.addEventListener('click', () => this.togglePlay());
        this.dom.skipBtn.addEventListener('click', () => this.skipPhase());

        // Master Volume
        this.dom.masterSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            AppState.masterVolume = val;
            AudioEngine.setMasterVolume(val);
        });

        // Mixer Params
        this.dom.paramSliders.forEach(slider => {
            slider.addEventListener('input', (e) => {
                const param = e.target.dataset.param;
                const val = parseFloat(e.target.value);
                AppState.params[param] = val;
                
                if(param.startsWith('vol')) {
                    const engineKey = param.replace('vol', '').toLowerCase();
                    AudioEngine.updateParam(engineKey, val);
                }
            });
        });

        // Profile Selection
        this.dom.profileOptions.forEach(opt => {
            opt.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                this.loadProfile(id);
                // Close popup
                this.dom.popupProfiles.classList.remove('show');
                this.dom.btnProfiles.classList.remove('active');
            });
        });
    },

    togglePopup(el) {
        // Close others
        [this.dom.popupProfiles, this.dom.popupVolume].forEach(p => {
            if(p !== el) p.classList.remove('show');
        });
        this.dom.btnProfiles.classList.remove('active');
        this.dom.btnVolume.classList.remove('active');

        el.classList.toggle('show');
        
        // Highlight active button
        if(el === this.dom.popupProfiles && el.classList.contains('show')) 
            this.dom.btnProfiles.classList.add('active');
        if(el === this.dom.popupVolume && el.classList.contains('show')) 
            this.dom.btnVolume.classList.add('active');
    },

    togglePlay() {
        if(AppState.isPlaying) {
            AudioEngine.stop();
            clearInterval(AppState.pomodoro.interval);
            this.dom.playBtn.classList.remove('running');
            this.dom.visualizer.classList.remove('active');
            this.dom.iconPlay.style.display = 'block';
            this.dom.iconPause.style.display = 'none';
        } else {
            AudioEngine.start();
            AppState.pomodoro.interval = setInterval(() => this.tickTimer(), 1000);
            this.dom.playBtn.classList.add('running');
            this.dom.visualizer.classList.add('active');
            this.dom.iconPlay.style.display = 'none';
            this.dom.iconPause.style.display = 'block';
        }
    },

    loadProfile(id) {
        const p = PROFILES[id];
        if(!p) return;
        
        AppState.currentProfile = id;
        
        // Update UI Selected State
        this.dom.profileOptions.forEach(o => {
            if(o.dataset.id === id) o.classList.add('selected');
            else o.classList.remove('selected');
        });

        // Update Background
        this.dom.bgLayer.className = `bg-${id}`;

        // Update Params & Audio
        Object.keys(p).forEach(k => {
            AppState.params[k] = p[k];
            if(AppState.isPlaying && k.startsWith('vol')) {
                const engineKey = k.replace('vol', '').toLowerCase();
                AudioEngine.updateParam(engineKey, p[k]);
            }
        });

        this.renderParams();
    },

    renderParams() {
        this.dom.paramSliders.forEach(slider => {
            const param = slider.dataset.param;
            if(AppState.params[param] !== undefined) {
                slider.value = AppState.params[param];
            }
        });
        this.dom.masterSlider.value = AppState.masterVolume;
    },

    tickTimer() {
        if(AppState.pomodoro.timeLeft > 0) {
            AppState.pomodoro.timeLeft--;
            const m = Math.floor(AppState.pomodoro.timeLeft / 60).toString().padStart(2,'0');
            const s = (AppState.pomodoro.timeLeft % 60).toString().padStart(2,'0');
            this.dom.timerDisplay.innerText = `${m}:${s}`;
        } else {
            this.skipPhase();
        }
    },

    skipPhase() {
        AudioEngine.stop();
        clearInterval(AppState.pomodoro.interval);
        
        AppState.pomodoro.isBreak = !AppState.pomodoro.isBreak;
        AppState.pomodoro.timeLeft = AppState.pomodoro.isBreak ? 5 * 60 : 25 * 60;
        
        const txt = AppState.pomodoro.isBreak ? "Pausa Restauradora" : "Foco Profundo";
        this.dom.timerStatus.innerText = txt;
        
        const m = Math.floor(AppState.pomodoro.timeLeft / 60).toString().padStart(2,'0');
        this.dom.timerDisplay.innerText = `${m}:00`;

        // Auto restart
        setTimeout(() => this.togglePlay(), 1500);
    },

    triggerVisualizer() {
        this.dom.visualizer.style.transform = `scale(1.05)`;
        setTimeout(() => this.dom.visualizer.style.transform = `scale(1)`, 400);
    },

    triggerFlash() {
        // Flash realista (Flicker: Clarão -> Diminui -> Clarão Forte -> Fade)
        const flash = document.createElement('div');
        Object.assign(flash.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            background: '#fff', zIndex: '5', pointerEvents: 'none',
            opacity: '0', transition: 'opacity 0.1s ease-out'
        });
        document.body.appendChild(flash);

        // Sequência de relâmpago
        requestAnimationFrame(() => {
            flash.style.opacity = '0.15'; // Primeiro clarão
            setTimeout(() => {
                flash.style.opacity = '0.05'; // Breve pausa
                setTimeout(() => {
                    flash.style.opacity = '0.3'; // Clarão principal
                    setTimeout(() => {
                        flash.style.transition = 'opacity 0.8s ease-out';
                        flash.style.opacity = '0'; // Fade out longo
                        setTimeout(() => flash.remove(), 900);
                    }, 150);
                }, 80);
            }, 80);
        });
    }
};

document.addEventListener('DOMContentLoaded', () => UI.init());
