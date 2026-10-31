/**
 * LA BARAQUE DES HORREURS - NIVEAU 5 : LA BARAQUE
 * JavaScript natif. Aucune dépendance.
 *
 * Configuration optionnelle (à définir AVANT ce script dans index.html) :
 * window.baraqueConfig = {
 *   videoUrl: '',                         // vidéo finale (vide = message "bientôt disponible")
 *   autoPlayVideo: true,
 *   onLevelComplete: function (data) {}   // reçoit { level: 5, status: 'completed', timeElapsed }
 * };
 *
 * Trois phases : les traces, la salle du fond (poursuite), le cadenas (FREAKDAY31).
 * Le code final n'est jamais stocké en clair : seule son empreinte SHA-256 l'est.
 */
(function () {
    'use strict';

    const HASH_LOCK = '5fd7b937ee1c41f1c27ba39ee653048ddde2e28cd14cee1c7b55ed00cefe5b05';   // FREAKDAY31

    const OBJECTS = ['CARNET', 'CASSETTE', 'TICKET', 'MASQUE'];
    const OBJECT_PUSH = 25;          // recul de la silhouette par objet trouvé
    const LAMP_RADIUS = 110;
    const TRACE_LAMP_RADIUS = 76;
    const TRACE_REVEAL_RADIUS = 38;
    const TRACE_STEPS = 3;
    const TRACE_FALSE_COUNT = 15;
    const TRACE_MARKS = 3;
    const TICK_MS = 200;
    const TENSION_MOVING = 0.15;     // progression quand la lampe bouge
    const TENSION_STILL = 0.6;       // progression quand la lampe reste immobile

    async function sha256Hex(text) {
        const data = new TextEncoder().encode(text);
        const buffer = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(buffer))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
    }

    function normalizeCode(text) {
        return String(text)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toUpperCase()
            .replace(/\s+/g, '');
    }

    function wait(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /* ================= SÉQUENCES SCÉNARISÉES ================= */

    /**
     * Chaque séquence est une liste de beats :
     *   { say: 'texte', ms: 2600 }          afficher un texte
     *   { shake: true }                     secousse de la scène
     *   { flash: true }                     flash rouge
     *   { pause: 1200 }                     silence
     *   { gore: 'texte', off: 'texte' }     version explicite / version hors champ
     */
    const SEQUENCES = {
        traceCompleted: [
            { say: 'Les trois traces se rejoignent devant une porte entrouverte.', ms: 2600 },
            { pause: 800 },
            { say: 'Derrière la porte, quelque chose cesse de respirer.', ms: 2600 },
            { pause: 800 },
            { say: 'Tu passes le seuil. La porte se referme sans bruit.', ms: 3000 }
        ],

        enterChase: [
            { say: 'Tu entres. L\'odeur de peinture écaillée et de sang sec te prend à la gorge.', ms: 3200 },
            { pause: 600 },
            { say: 'Quelqu\'un a prononcé ton prénom. Tu ne te souviens pas le lui avoir donné.', ms: 3200 },
            { pause: 600 },
            {
                gore: 'Au fond de la salle, un corps pend au plafond, le ventre ouvert, les bras cloués au bois. Il a été installé comme une attraction.',
                off: 'Au fond de la salle, quelque chose pend au plafond. Tu détournes les yeux avant de comprendre.',
                ms: 4200
            }
        ],

        caught: [
            { flash: true },
            { shake: true },
            { say: 'La silhouette est sur toi. Son souffle est froid, humide, et il sent la foire.', ms: 3000 },
            { pause: 500 },
            { say: 'Le noir se referme. Quand il s\'ouvre, tu es de nouveau devant la porte.', ms: 3200 }
        ],

        objectFound: [
            { say: 'Un objet de plus. La silhouette recule. Pour l\'instant.', ms: 2400 }
        ],

        allFound: [
            { say: 'Les quatre objets sont réunis. Le silence devient différent. Plus lourd.', ms: 3000 },
            { pause: 700 },
            { say: 'Au fond de la salle, le cadenas final attend. Il est en métal, couvert de tickets.', ms: 3400 }
        ],

        ending: [
            { flash: true },
            { say: 'Le cadenas cède. Chaque lettre tombe à sa place.', ms: 3000 },
            { pause: 900 },
            { say: 'Kursty est là, debout, le sourire trop large. Il dit : « Tu es le suivant. »', ms: 4200 }
        ]
    };

    class BaraqueNiveau5 {
        constructor(config) {
            this.config = Object.assign({
                videoUrl: '',
                autoPlayVideo: true,
                onLevelComplete: null
            }, config || {});

            this.startTime = Date.now();
            this.offscreen = false;
            this.sequenceToken = 0;      // annule une séquence en cours si besoin
            this.phase = 'trace';
            this.lockErrors = 0;
            this.solved = false;

            // Pistes
            this.traceStep = 0;
            this.traces = [];
            this.traceBusy = false;
            this.traceLoopId = null;
            this.traceLamp = null;
            this.completionReported = false;

            // Poursuite
            this.proximity = 0;
            this.foundCount = 0;
            this.objects = [];           // { name, x, y, el, found }
            this.lamp = null;            // { x, y } ou null
            this.lastMove = 0;
            this.chaseLoopId = null;
            this.chaseTickId = null;

            this.el = {
                gate: document.getElementById('gate'),
                btnEnter: document.getElementById('btnEnter'),
                btnOffscreen: document.getElementById('btnOffscreen'),
                btnLeave: document.getElementById('btnLeave'),
                leaveMsg: document.getElementById('leaveMsg'),
                game: document.getElementById('game'),
                scene: document.getElementById('scene'),
                sceneText: document.getElementById('sceneText'),
                phaseTrace: document.getElementById('phaseTrace'),
                traceStage: document.getElementById('traceStage'),
                traceCanvas: document.getElementById('traceCanvas'),
                traceCounter: document.getElementById('traceCounter'),
                traceSuccess: document.getElementById('traceSuccess'),
                btnTraceContinue: document.getElementById('btnTraceContinue'),
                phaseChase: document.getElementById('phaseChase'),
                phaseLock: document.getElementById('phaseLock'),
                lockForm: document.getElementById('lockForm'),
                lockInput: document.getElementById('lockInput'),
                lockFb: document.getElementById('lockFb'),
                proxFill: document.getElementById('proxFill'),
                chaseStage: document.getElementById('chaseStage'),
                chaseCanvas: document.getElementById('chaseCanvas'),
                chaseShadow: document.getElementById('chaseShadow'),
                chaseCounter: document.getElementById('chaseCounter'),
                finale: document.getElementById('finale'),
                finaleVideo: document.getElementById('finaleVideo'),
                btnFinish: document.getElementById('btnFinish')
            };

            this.traceCtx = this.el.traceCanvas.getContext('2d');
            this.ctx = this.el.chaseCanvas.getContext('2d');
            this.bindGate();
            this.bindForms();
            this.bindTrace();
            this.bindChase();
            this.el.btnTraceContinue.addEventListener('click', () => this.complete());
            this.el.btnFinish.addEventListener('click', () => this.complete());
            this.showPhase('trace');
        }

        /* ================= TEXTE & SÉQUENCES ================= */

        async runSequence(name, beats) {
            const list = beats || SEQUENCES[name];
            const token = ++this.sequenceToken;
            if (!list) return;

            for (const beat of list) {
                if (token !== this.sequenceToken) return;

                if (beat.say !== undefined) {
                    this.setText(beat.say);
                    await wait(beat.ms || 2500);
                } else if (beat.gore !== undefined) {
                    this.setText(this.offscreen ? beat.off : beat.gore);
                    await wait(beat.ms || 3500);
                } else if (beat.pause !== undefined) {
                    await wait(beat.pause);
                } else if (beat.shake) {
                    this.el.scene.classList.remove('is-shaking');
                    void this.el.scene.offsetWidth;
                    this.el.scene.classList.add('is-shaking');
                    await wait(400);
                } else if (beat.flash) {
                    this.el.scene.classList.add('is-flash');
                    await wait(300);
                    this.el.scene.classList.remove('is-flash');
                    await wait(200);
                }
            }
        }

        setText(text) {
            this.el.sceneText.textContent = text;
        }

        /* ================= TRACES ================= */

        bindGate() {
            this.el.btnEnter.addEventListener('click', () => this.enter(false));
            this.el.btnOffscreen.addEventListener('click', () => this.enter(true));
            this.el.btnLeave.addEventListener('click', () => {
                this.el.leaveMsg.hidden = false;
                this.el.btnEnter.disabled = true;
                this.el.btnOffscreen.disabled = true;
                this.el.btnLeave.disabled = true;
            });
        }

        async enter(offscreen) {
            this.offscreen = offscreen;
            this.el.gate.hidden = true;
            this.el.game.hidden = false;
            await this.runSequence('intro', [
                { say: 'La baraque est fermée depuis la nuit de la fête.', ms: 2600 },
                { pause: 600 },
                { say: 'Dans le noir, une multitude de traces se croisent. La lampe est ta seule alliée.', ms: 2800 }
            ]);
            this.startTrace();
        }

        bindForms() {
            this.el.lockForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.checkLock();
            });
        }

        startTrace() {
            this.showPhase('trace');
            this.traceStep = 0;
            this.traceBusy = false;
            this.solved = false;
            this.traceLamp = null;
            this.el.traceStage.hidden = false;
            this.el.traceSuccess.hidden = true;
            this.resizeTrace();
            this.spawnTraces();
            this.updateTraceCounter();
            this.traceLoopId = requestAnimationFrame(() => this.traceLoop());
            this.setText('Explore la salle. Les bonnes traces resteront visibles dès leur découverte.');
        }

        stopTrace() {
            if (this.traceLoopId) cancelAnimationFrame(this.traceLoopId);
            this.traceLoopId = null;
        }

        resizeTrace() {
            const rect = this.el.traceStage.getBoundingClientRect();
            this.traceDpr = Math.min(window.devicePixelRatio || 1, 2);
            this.traceWidth = Math.max(1, Math.round(rect.width));
            this.traceHeight = Math.max(1, Math.round(rect.height));
            this.el.traceCanvas.width = Math.round(this.traceWidth * this.traceDpr);
            this.el.traceCanvas.height = Math.round(this.traceHeight * this.traceDpr);
            this.traceCtx.setTransform(this.traceDpr, 0, 0, this.traceDpr, 0, 0);
            this.traces.forEach((trace) => this.positionTraceMarks(trace));
        }

        bindTrace() {
            const pointerAt = (e) => {
                const rect = this.el.traceStage.getBoundingClientRect();
                return { x: e.clientX - rect.left, y: e.clientY - rect.top };
            };

            const update = (e) => {
                if (this.phase !== 'trace' || this.traceBusy) return;
                this.traceLamp = pointerAt(e);
                this.revealTraces();
            };

            this.el.traceStage.addEventListener('pointerdown', (e) => {
                update(e);
                e.preventDefault();
            });
            this.el.traceStage.addEventListener('pointermove', update);
            this.el.traceStage.addEventListener('pointerleave', () => { this.traceLamp = null; });
            window.addEventListener('resize', () => {
                if (this.phase === 'trace') this.resizeTrace();
            });
        }

        spawnTraces() {
            this.el.traceStage.querySelectorAll('.trace-mark').forEach((mark) => mark.remove());
            this.traces = [];

            const total = TRACE_STEPS + TRACE_FALSE_COUNT;
            const columns = Math.max(3, Math.min(6, Math.floor(this.traceWidth / 140)));
            const rows = Math.ceil(total / columns);
            const realIndices = new Set();
            while (realIndices.size < TRACE_STEPS) {
                realIndices.add(Math.floor(Math.random() * total));
            }

            for (let i = 0; i < total; i++) {
                const column = i % columns;
                const row = Math.floor(i / columns);
                const real = realIndices.has(i);
                const centerX = ((column + 0.5 + (Math.random() - 0.5) * 0.2) / columns) * 100;
                const centerY = ((row + 0.5 + (Math.random() - 0.5) * 0.18) / rows) * 100;
                const trace = { real, found: false, marks: [] };

                for (let step = 0; step < TRACE_MARKS; step++) {
                    const direction = step - (TRACE_MARKS - 1) / 2;
                    const x = centerX + direction * (100 / columns) * 0.1;
                    const y = centerY - direction * (100 / rows) * 0.1 + (Math.random() - 0.5) * (100 / rows) * 0.04;
                    const mark = document.createElement('span');
                    mark.className = 'trace-mark ' + (real ? 'is-real' : 'is-false');
                    mark.style.left = x.toFixed(1) + '%';
                    mark.style.top = y.toFixed(1) + '%';
                    mark.style.transform = 'translate(-50%, -50%) rotate(' +
                        ((step % 2 ? -1 : 1) * (10 + Math.random() * 18)).toFixed(1) + 'deg)';
                    this.el.traceStage.appendChild(mark);
                    trace.marks.push({ el: mark, x: 0, y: 0, revealed: false });
                }

                this.positionTraceMarks(trace);
                this.traces.push(trace);
            }
        }

        positionTraceMarks(trace) {
            trace.marks.forEach((mark) => {
                mark.x = parseFloat(mark.el.style.left) / 100 * this.traceWidth;
                mark.y = parseFloat(mark.el.style.top) / 100 * this.traceHeight;
            });
        }

        revealTraces() {
            if (!this.traceLamp) return;
            this.traces.forEach((trace) => {
                if (trace.found) return;
                let discovered = false;
                trace.marks.forEach((mark) => {
                    const distance = Math.hypot(this.traceLamp.x - mark.x, this.traceLamp.y - mark.y);
                    if (distance < TRACE_REVEAL_RADIUS) discovered = true;
                    mark.el.style.opacity = distance < TRACE_LAMP_RADIUS * 0.75 ? '1' : '0';
                });

                if (discovered && trace.real) this.discoverGoodTrace(trace);
            });
        }

        discoverGoodTrace(trace) {
            trace.found = true;
            trace.marks.forEach((mark) => {
                mark.revealed = true;
                mark.el.classList.add('is-discovered');
                mark.el.style.opacity = '1';
            });
            this.traceStep++;
            this.updateTraceCounter();
            window.playAnswerSound('correct');

            if (this.traceStep === TRACE_STEPS) {
                this.finishTraceGame();
            } else {
                this.setText('Bonne trace découverte. Elle reste visible dans le noir.');
            }
        }

        updateTraceCounter() {
            this.el.traceCounter.textContent = 'Bonnes traces trouvées : ' + this.traceStep + ' / ' + TRACE_STEPS;
        }

        finishTraceGame() {
            this.traceBusy = true;
            this.solved = true;
            this.stopTrace();
            this.el.traceStage.hidden = true;
            this.el.traceSuccess.hidden = false;
            this.setText('Les trois bonnes traces sont réunies. La voie est libre.');
        }

        traceLoop() {
            if (this.phase !== 'trace' || this.traceBusy) return;

            const ctx = this.traceCtx;
            ctx.globalCompositeOperation = 'source-over';
            ctx.clearRect(0, 0, this.traceWidth, this.traceHeight);
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, this.traceWidth, this.traceHeight);

            if (this.traceLamp) {
                const light = ctx.createRadialGradient(
                    this.traceLamp.x, this.traceLamp.y, 0,
                    this.traceLamp.x, this.traceLamp.y, TRACE_LAMP_RADIUS
                );
                light.addColorStop(0, 'rgba(0,0,0,1)');
                light.addColorStop(0.7, 'rgba(0,0,0,0.6)');
                light.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.globalCompositeOperation = 'destination-out';
                ctx.fillStyle = light;
                ctx.beginPath();
                ctx.arc(this.traceLamp.x, this.traceLamp.y, TRACE_LAMP_RADIUS, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.globalCompositeOperation = 'destination-out';
            this.traces.forEach((trace) => {
                if (!trace.real) return;
                trace.marks.forEach((mark) => {
                    if (!mark.revealed) return;
                    ctx.beginPath();
                    ctx.arc(mark.x, mark.y, 18, 0, Math.PI * 2);
                    ctx.fill();
                });
            });
            ctx.globalCompositeOperation = 'source-over';

            this.revealTraces();
            this.traceLoopId = requestAnimationFrame(() => this.traceLoop());
        }

        /* ================= POURSUITE ================= */

        startChase() {
            this.showPhase('chase');
            this.resetChase();
            this.resizeChase();
            this.lastMove = Date.now();
            this.chaseLoopId = requestAnimationFrame(() => this.chaseLoop());
            this.chaseTickId = setInterval(() => this.chaseTick(), TICK_MS);
        }

        stopChase() {
            if (this.chaseLoopId) cancelAnimationFrame(this.chaseLoopId);
            if (this.chaseTickId) clearInterval(this.chaseTickId);
            this.chaseLoopId = null;
            this.chaseTickId = null;
        }

        resetChase() {
            this.proximity = 0;
            this.foundCount = 0;
            this.lamp = null;
            this.updateProximity();
            this.el.chaseShadow.classList.remove('is-near');

            this.el.chaseStage.querySelectorAll('.chase-object').forEach((o) => o.remove());
            this.objects = OBJECTS.map((name) => {
                const el = document.createElement('div');
                el.className = 'chase-object';
                el.textContent = name;
                el.style.left = (10 + Math.random() * 80) + '%';
                el.style.top = (12 + Math.random() * 74) + '%';
                el.style.transform = 'translate(-50%, -50%) rotate(' + ((Math.random() * 20) - 10).toFixed(1) + 'deg)';
                this.el.chaseStage.appendChild(el);
                return { name, el, found: false, x: 0, y: 0 };
            });

            this.objects.forEach((o) => {
                o.x = parseFloat(o.el.style.left) / 100 * this.width;
                o.y = parseFloat(o.el.style.top) / 100 * this.height;
            });
            this.updateCounter();
        }

        resizeChase() {
            const rect = this.el.chaseStage.getBoundingClientRect();
            this.dpr = Math.min(window.devicePixelRatio || 1, 2);
            this.width = Math.max(1, Math.round(rect.width));
            this.height = Math.max(1, Math.round(rect.height));
            this.el.chaseCanvas.width = Math.round(this.width * this.dpr);
            this.el.chaseCanvas.height = Math.round(this.height * this.dpr);
            this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
            this.objects.forEach((o) => {
                o.x = parseFloat(o.el.style.left) / 100 * this.width;
                o.y = parseFloat(o.el.style.top) / 100 * this.height;
            });
        }

        bindChase() {
            const pointerAt = (e) => {
                const rect = this.el.chaseStage.getBoundingClientRect();
                return { x: e.clientX - rect.left, y: e.clientY - rect.top };
            };

            const update = (e) => {
                if (this.phase !== 'chase') return;
                this.lamp = pointerAt(e);
                this.lastMove = Date.now();
                this.checkFind();
            };

            this.el.chaseStage.addEventListener('pointerdown', (e) => {
                update(e);
                e.preventDefault();
            });
            this.el.chaseStage.addEventListener('pointermove', (e) => {
                update(e);
                e.preventDefault();
            });
            this.el.chaseStage.addEventListener('pointerleave', () => { this.lamp = null; });
            this.el.chaseStage.addEventListener('pointerup', () => { this.lamp = null; });
            window.addEventListener('resize', () => {
                if (this.phase === 'chase') this.resizeChase();
            });
        }

        checkFind() {
            if (!this.lamp) return;
            this.objects.forEach((o) => {
                if (o.found) return;
                const d = Math.hypot(this.lamp.x - o.x, this.lamp.y - o.y);
                if (d < LAMP_RADIUS * 0.5) {
                    this.findObject(o);
                }
            });
        }

        findObject(o) {
            o.found = true;
            o.el.classList.add('is-found');
            this.foundCount++;
            this.proximity = Math.max(0, this.proximity - OBJECT_PUSH);
            this.updateProximity();
            this.updateCounter();

            if (this.foundCount === OBJECTS.length) {
                this.finishChase();
            } else {
                this.runSequence('objectFound');
            }
        }

        /** Tension : la silhouette avance plus vite quand la lampe reste immobile */
        chaseTick() {
            if (this.phase !== 'chase') return;
            const still = Date.now() - this.lastMove > 1000;
            this.proximity += still ? TENSION_STILL : TENSION_MOVING;
            this.updateProximity();

            if (this.proximity >= 100) {
                this.caught();
            }
        }

        updateProximity() {
            const pct = Math.min(100, this.proximity);
            this.el.proxFill.style.width = pct + '%';
            this.el.chaseShadow.classList.toggle('is-near', pct > 60);
            this.el.chaseShadow.style.transform =
                'translate(-50%, -50%) scale(' + (1 + pct / 100).toFixed(2) + ')';
        }

        updateCounter() {
            this.el.chaseCounter.textContent = this.foundCount + ' / ' + OBJECTS.length + ' objets trouvés';
        }

        async caught() {
            this.stopChase();
            this.showPhase('trace');
            await this.runSequence('caught');
            this.startTrace();
        }

        async finishChase() {
            this.stopChase();
            await this.runSequence('allFound');
            this.startLock();
        }

        drawChase() {
            const ctx = this.ctx;
            const w = this.width;
            const h = this.height;

            ctx.globalCompositeOperation = 'source-over';
            ctx.clearRect(0, 0, w, h);
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, w, h);

            if (this.lamp) {
                const g = ctx.createRadialGradient(this.lamp.x, this.lamp.y, 0, this.lamp.x, this.lamp.y, LAMP_RADIUS);
                g.addColorStop(0, 'rgba(0,0,0,1)');
                g.addColorStop(0.7, 'rgba(0,0,0,0.6)');
                g.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.globalCompositeOperation = 'destination-out';
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.arc(this.lamp.x, this.lamp.y, LAMP_RADIUS, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalCompositeOperation = 'source-over';
            }
        }

        chaseLoop() {
            if (this.phase !== 'chase') return;
            this.drawChase();
            this.chaseLoopId = requestAnimationFrame(() => this.chaseLoop());
        }

        /* ================= CADENAS ================= */

        startLock() {
            this.showPhase('lock');
            this.lockErrors = 0;
            this.el.lockInput.focus();
        }

        async checkLock() {
            if (this.phase !== 'lock' || this.solved) return;
            if (!window.crypto || !window.crypto.subtle) {
                this.el.lockFb.className = 'feedback is-error';
                this.el.lockFb.textContent = 'Ouvre le jeu depuis une adresse https ou localhost.';
                return;
            }

            const typed = normalizeCode(this.el.lockInput.value);
            if (!typed) return;

            if (await sha256Hex(typed) === HASH_LOCK) {
                window.playAnswerSound('correct');
                this.solved = true;
                this.el.lockInput.disabled = true;
                this.el.lockFb.className = 'feedback is-success';
                this.el.lockFb.textContent = '✓ Le cadenas s\'ouvre.';
                await this.runSequence('ending');
                this.showFinale();
                return;
            }

            this.lockErrors++;
            window.playAnswerSound('wrong');
            this.el.lockFb.className = 'feedback is-error';
            this.el.lockFb.textContent = this.lockErrors >= 3
                ? 'Ce n\'est pas le code. Indice : les fragments sont FREAK, DAY, 31 et LUI, dans l\'ordre de la baraque.'
                : 'Le cadenas reste fermé. Réessaie.';
        }

        /* ================= FIN ================= */

        showFinale() {
            this.showPhase(null);
            this.el.finale.hidden = false;

            if (this.config.videoUrl) {
                const video = document.createElement('video');
                video.controls = true;
                video.autoplay = !!this.config.autoPlayVideo;
                video.playsInline = true;

                const source = document.createElement('source');
                source.src = this.config.videoUrl;
                source.type = 'video/mp4';
                video.appendChild(source);

                this.el.finaleVideo.innerHTML = '';
                this.el.finaleVideo.appendChild(video);
            } else {
                this.el.finaleVideo.innerHTML =
                    '<div class="video-missing"><p>La vidéo finale sera bientôt disponible...</p></div>';
            }

        }

        complete() {
            if (!this.solved || this.completionReported) return;
            this.completionReported = true;
            this.el.btnTraceContinue.disabled = true;
            const timeElapsed = Math.round((Date.now() - this.startTime) / 1000);
            if (typeof this.config.onLevelComplete === 'function') {
                this.config.onLevelComplete({
                    level: 5,
                    status: 'completed',
                    timeElapsed: timeElapsed
                });
            }
        }

        /* ================= PHASES ================= */

        showPhase(name, keepChase) {
            if (!keepChase && this.phase === 'chase') this.stopChase();
            if (name !== 'trace') this.stopTrace();
            this.phase = name || 'end';
            this.el.phaseTrace.hidden = name !== 'trace';
            this.el.phaseChase.hidden = name !== 'chase';
            this.el.phaseLock.hidden = name !== 'lock';
        }
    }

    function start() {
        window.baraqueNiveau5 = new BaraqueNiveau5(window.baraqueConfig || {});
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
