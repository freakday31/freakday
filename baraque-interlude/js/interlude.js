/**
 * LA BARAQUE DES HORREURS - INTERLUDE : LES YEUX DU SIGNAL
 * Placé entre le niveau 4 (LUI) et le niveau 5 (la porte).
 * JavaScript natif. Aucune dépendance.
 *
 * Configuration optionnelle (à définir AVANT ce script dans index.html) :
 * window.interludeConfig = {
 *   word: 'PEUR',                         // mot capté par les yeux (4 lettres)
 *   onInterludeComplete: function (data)  // reçoit { interlude: true, status: 'completed', timeElapsed }
 * };
 *
 * Mécanique :
 * - Un œil apparaît à un endroit aléatoire. Il se ferme au bout d'un délai.
 * - Le toucher avant qu'il ne se ferme capte la lettre suivante.
 * - Un œil raté remet le mot à zéro et fait trembler le signal.
 * - Le délai diminue à chaque lettre captée.
 * - Quand le mot est complet, le signal crie.
 */
(function () {
    'use strict';

    const DEFAULT_WORD = 'PEUR';
    const TARGET_TOUCHES = 31;
    const START_DELAY = 2800;
    const PEAK_DELAY = 1000;
    const END_DELAY = 1750;
    const PEAK_PROGRESS = 0.55;
    const SPAWN_GAP = 250;

    function wait(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    class SignalDesYeux {
        constructor(config) {
            this.config = Object.assign({
                word: DEFAULT_WORD,
                onJumpscareStart: null,
                onInterludeComplete: null
            }, config || {});

            this.word = String(this.config.word).toUpperCase().split('');
            this.startTime = Date.now();
            this.progress = 0;           // lettres captées
            this.misses = 0;
            this.currentEye = null;
            this.eyeTimer = null;
            this.spawnTimer = null;
            this.done = false;
            this.calm = false;
            this.lastPositions = [];
            this.hitSound = new Audio('../media/gunshot.mp3');
            this.missSound = new Audio('../media/gunshotlose.mp3');
            this.jumpScareAudio = new Audio('../media/jumpscare.mp3');
            this.spawnSound = new Audio('../media/pull.mp3');
            this.circusMusic = new Audio('../media/Musique de cirque.mp3');
            this.hitSound.preload = 'auto';
            this.missSound.preload = 'auto';
            this.jumpScareAudio.preload = 'auto';
            this.spawnSound.preload = 'auto';
            this.circusMusic.preload = 'auto';
            this.circusMusic.loop = true;

            this.el = {
                gate: document.getElementById('gate'),
                btnEnter: document.getElementById('btnEnter'),
                btnCalm: document.getElementById('btnCalm'),
                btnLeave: document.getElementById('btnLeave'),
                leaveMsg: document.getElementById('leaveMsg'),
                game: document.getElementById('game'),
                sceneText: document.getElementById('sceneText'),
                arena: document.getElementById('arena'),
                eyeZone: document.getElementById('eyeZone'),
                aimReticle: document.getElementById('aimReticle'),
                wordPanel: document.querySelector('.word-panel'),
                wordTiles: document.getElementById('wordTiles'),
                counter: document.getElementById('counter'),
                missCounter: document.getElementById('missCounter'),
                progressTrack: document.getElementById('progressTrack'),
                progressFill: document.getElementById('progressFill'),
                feedback: document.getElementById('feedback'),
                scream: document.getElementById('scream'),
                rain: document.getElementById('rain')
            };

            this.audioCtx = null;
            this.buildWordTiles();
            this.bindGate();
            this.bindAim();
            this.el.game.addEventListener('click', () => this.flashScreen());
            this.startRain();
        }

        /* ================= PORTE ================= */

        bindGate() {
            this.el.btnEnter.addEventListener('click', () => this.enter(false));
            this.el.btnCalm.addEventListener('click', () => this.enter(true));
            this.el.btnLeave.addEventListener('click', () => {
                this.el.leaveMsg.hidden = false;
                this.el.btnEnter.disabled = true;
                this.el.btnCalm.disabled = true;
                this.el.btnLeave.disabled = true;
            });
        }

        bindAim() {
            this.el.arena.addEventListener('pointerenter', (event) => this.updateAim(event));
            this.el.arena.addEventListener('pointermove', (event) => this.updateAim(event));
            this.el.arena.addEventListener('pointerleave', () => {
                this.el.aimReticle.hidden = true;
                this.el.arena.classList.remove('aim-active');
            });
        }

        updateAim(event) {
            if (event.pointerType !== 'mouse') {
                this.el.aimReticle.hidden = true;
                this.el.arena.classList.remove('aim-active');
                return;
            }

            const bounds = this.el.arena.getBoundingClientRect();
            this.el.aimReticle.style.left = `${event.clientX - bounds.left}px`;
            this.el.aimReticle.style.top = `${event.clientY - bounds.top}px`;
            this.el.aimReticle.hidden = false;
            this.el.arena.classList.add('aim-active');
        }

        enter(calm) {
            this.calm = calm;
            document.documentElement.classList.toggle('fd-calm', calm);
            this.el.gate.hidden = true;
            this.el.game.hidden = false;
            this.el.game.classList.toggle('is-calm', calm);
            this.getAudio();
            this.playCircusMusic();
            this.intro();
        }

        async intro() {
            this.setScene('Une cible lumineuse apparaît au fond de la scène.');
            await wait(2600);
            this.setScene('Règles : capture 31 cibles. Au troisième raté, ton compteur revient à zéro.');
            await wait(2800);
            this.nextEye();
        }

        /* ================= AUDIO ================= */

        playCircusMusic() {
            this.circusMusic.play().catch((error) => {
                console.error('Impossible de lire media/Musique de cirque.mp3.', error);
            });
        }

        stopCircusMusic() {
            this.circusMusic.pause();
            this.circusMusic.currentTime = 0;
        }

        getAudio() {
            if (!this.audioCtx) {
                const AC = window.AudioContext || window.webkitAudioContext;
                if (AC) this.audioCtx = new AC();
            }
            if (this.audioCtx && this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }
            return this.audioCtx;
        }

        async playJumpScareSound() {
            const audio = this.jumpScareAudio;
            audio.currentTime = 0;

            const playbackFinished = new Promise((resolve) => {
                audio.addEventListener('ended', resolve, { once: true });
                audio.addEventListener('error', resolve, { once: true });
            });

            try {
                await audio.play();
            } catch (error) {
                console.error('Impossible de lire media/jumpscare.mp3.', error);
                return;
            }

            const maxDuration = Number.isFinite(audio.duration) ? audio.duration * 1000 + 800 : 12000;
            await Promise.race([playbackFinished, wait(maxDuration)]);
        }

        playTargetSound(sound) {
            sound.currentTime = 0;
            sound.play().catch(() => {});
        }

        flashScreen() {
            if (this.calm || !this.el.scream.hidden) return;

            const flash = document.createElement('div');
            flash.className = 'flash-layer';
            document.body.appendChild(flash);
            requestAnimationFrame(() => flash.classList.add('is-on'));
            window.setTimeout(() => flash.remove(), 100);
        }

        /* ================= TUILES DU MOT ================= */

        buildWordTiles() {
            this.el.wordTiles.innerHTML = '';
            Array.from({ length: TARGET_TOUCHES }).forEach(() => {
                const tile = document.createElement('div');
                tile.className = 'word-tile is-empty';
                this.el.wordTiles.appendChild(tile);
            });
            this.updateCounter();
        }

        fillTile(index) {
            const tile = this.el.wordTiles.children[index];
            tile.classList.remove('is-empty');
            tile.classList.add('is-captured');
        }

        updateCounter() {
            this.el.counter.textContent = `${this.progress} / ${TARGET_TOUCHES} cibles captées`;
            this.el.progressTrack.setAttribute('aria-valuenow', String(this.progress));
            this.el.progressFill.style.width = `${(this.progress / TARGET_TOUCHES) * 100}%`;
        }

        /* ================= ŒILS ================= */

        setScene(text) {
            this.el.sceneText.textContent = text;
        }

        setFeedback(text, kind) {
            this.el.feedback.textContent = text || '';
            this.el.feedback.className = 'feedback' + (kind ? ' is-' + kind : '');
            this.el.wordPanel.classList.toggle('has-error', kind === 'error');
        }

        eyeDuration() {
            const progressRatio = Math.min(this.progress / (TARGET_TOUCHES - 1), 1);
            const baseDelay = progressRatio <= PEAK_PROGRESS
                ? START_DELAY - (START_DELAY - PEAK_DELAY) * (progressRatio / PEAK_PROGRESS)
                : PEAK_DELAY + (END_DELAY - PEAK_DELAY) *
                    ((progressRatio - PEAK_PROGRESS) / (1 - PEAK_PROGRESS));
            return Math.round(baseDelay * (0.88 + Math.random() * 0.24));
        }

        randomPosition() {
            // Évite de faire réapparaître un œil au même endroit que le précédent
            let x, y, tries = 0;
            do {
                x = 14 + Math.random() * 72;
                y = 18 + Math.random() * 64;
                tries++;
            } while (tries < 20 && this.lastPositions.some((p) => Math.hypot(p.x - x, p.y - y) < 22));
            this.lastPositions.push({ x, y });
            if (this.lastPositions.length > 3) this.lastPositions.shift();
            return { x, y };
        }

        nextEye() {
            if (this.done) return;

            const pos = this.randomPosition();
            const eye = document.createElement('button');
            eye.type = 'button';
            eye.className = 'eye';
            eye.style.left = pos.x.toFixed(1) + '%';
            eye.style.top = pos.y.toFixed(1) + '%';
            eye.setAttribute('aria-label', 'Cible');
            eye.addEventListener('click', () => this.touchEye(eye));
            this.el.eyeZone.appendChild(eye);
            this.currentEye = eye;

            this.playTargetSound(this.spawnSound);
            const duration = this.eyeDuration();

            // Une capture manquée laisse les réussites précédentes intactes.
            this.eyeTimer = setTimeout(() => this.missEye(eye), duration);
        }

        touchEye(eye) {
            if (this.done || eye !== this.currentEye) return;

            this.playTargetSound(this.hitSound);
            clearTimeout(this.eyeTimer);
            this.currentEye = null;
            eye.classList.add('is-closing');
            setTimeout(() => eye.remove(), 300);

            this.progress++;
            this.fillTile(this.progress - 1);
            this.updateCounter();
            this.setFeedback(`Cible capturée. ${this.progress} / ${TARGET_TOUCHES}.`, 'success');

            if (this.progress === TARGET_TOUCHES) {
                this.finish();
                return;
            }

            this.spawnTimer = setTimeout(() => this.nextEye(), SPAWN_GAP + Math.random() * 320);
        }

        async missEye(eye) {
            if (this.done) return;
            this.playTargetSound(this.missSound);
            this.currentEye = null;
            eye.remove();

            this.misses++;
            let feedback;
            if (this.misses >= 3) {
                this.progress = 0;
                this.misses = 0;
                this.buildWordTiles();
                feedback = 'Trois ratés. Le compteur repart à zéro.';
            } else {
                feedback = `Raté ${this.misses} / 3. Progression conservée : ${this.progress} / ${TARGET_TOUCHES}.`;
            }
            this.el.missCounter.textContent = `Ratés : ${this.misses} / 3`;

            this.el.arena.classList.remove('is-shaking');
            void this.el.arena.offsetWidth;
            this.el.arena.classList.add('is-shaking');

            this.setFeedback(feedback, 'error');
            this.spawnTimer = setTimeout(() => this.nextEye(), SPAWN_GAP * 2 + Math.random() * 480);
        }

        /* ================= CRI FINAL ================= */

        async finish() {
            this.done = true;
            clearTimeout(this.spawnTimer);
            this.setFeedback('');
            this.setScene('Le signal est complet. Il ouvre la bouche.');
            if (this.calm) await wait(1800);

            this.screamScreen();
        }

        async screamScreen() {
            this.stopCircusMusic();
            const scream = this.el.scream;
            scream.hidden = false;
            scream.classList.remove('is-fading');
            scream.classList.toggle('is-calm', this.calm);
            if (!this.calm && typeof this.config.onJumpscareStart === 'function') {
                this.config.onJumpscareStart();
            }

            await this.playJumpScareSound();
            scream.hidden = true;

            this.showTransition();
        }

        async showTransition() {
            this.setScene('La porte de la baraque s\'ouvre.');
            this.setFeedback('');
            await wait(2500);

            const timeElapsed = Math.round((Date.now() - this.startTime) / 1000);
            if (typeof this.config.onInterludeComplete === 'function') {
                this.config.onInterludeComplete({
                    interlude: true,
                    status: 'completed',
                    autoAdvance: true,
                    timeElapsed: timeElapsed
                });
            }
        }

        /* ================= PLUIE DE CARACTÈRES ================= */

        startRain() {
            const canvas = this.el.rain;
            const ctx = canvas.getContext('2d');
            const chars = 'FREAKSHOW0123456789ABCDEF'.split('');
            let columns = [];

            const resize = () => {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
                const count = Math.floor(canvas.width / 16);
                columns = Array.from({ length: count }, () => Math.random() * canvas.height);
            };
            resize();
            window.addEventListener('resize', resize);

            const draw = () => {
                ctx.fillStyle = 'rgba(18, 4, 2, 0.12)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.font = '16px Courier New';
                columns.forEach((y, i) => {
                    const ch = chars[Math.floor(Math.random() * chars.length)];
                    ctx.fillStyle = Math.random() < 0.1 ? '#ffd23f' : '#ff7a1a';
                    ctx.fillText(ch, i * 16, y);
                    columns[i] = y > canvas.height && Math.random() > 0.97 ? 0 : y + 16;
                });
                requestAnimationFrame(draw);
            };
            draw();
        }
    }

    function start() {
        window.signalDesYeux = new SignalDesYeux(window.interludeConfig || {});
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
