/**
 * LA BARAQUE DES HORREURS - NIVEAU 1 : LE CARNET DE KURSTY
 * JavaScript natif. Souris et tactile. Aucune dépendance.
 *
 * Configuration optionnelle (à définir AVANT ce script dans index.html) :
 * window.baraqueConfig = {
 *   onLevelComplete: function (data) {}   // reçoit { level: 1, status: 'completed', timeElapsed }
 * };
 *
 * Le mot attendu n'est jamais stocké en clair : seule son empreinte SHA-256 est présente.
 */
(function () {
    'use strict';

    // SHA-256 de "FREAK" (majuscules, sans accent, sans espace)
    const EXPECTED_HASH = 'de5dce4c0a21eea2ef6434c78bdbed9808fa9c0f95c8c8c6928a7288e06dacca';

    // Les 8 photos du carnet. "time" est l'heure écrite sur la photo.
    const PHOTOS = [
        { id: 1, src: 'media/photo-01.jpg', time: '21:02', annot: 'Il a pleuré en sortant.', letter: 'Z' },
        { id: 2, src: 'media/photo-02.jpg', time: '22:18', annot: 'Le petit l\'a suivi jusqu\'au bout.', letter: 'Q' },
        { id: 3, src: 'media/photo-03.jpg', time: '22:55', annot: 'Elle a dit merci.', letter: 'M' },
        { id: 4, src: 'media/photo-04.jpg', time: '23:10', annot: 'Il ne voulait pas partir.', letter: 'F' },
        { id: 5, src: 'media/photo-05.jpg', time: '23:47', annot: 'Le rire est venu après.', letter: 'R' },
        { id: 6, src: 'media/photo-06.jpg', time: '00:05', annot: 'Elle a regardé la porte pendant des heures.', letter: 'E' },
        { id: 7, src: 'media/photo-07.jpg', time: '00:31', annot: 'Il a attendu que la lumière s\'éteigne.', letter: 'A' },
        { id: 8, src: 'media/photo-08.jpg', time: '01:12', annot: 'Il ne reste que le manteau.', letter: 'K' }
    ];

    /**
     * Minutes écoulées depuis 20h00 (la nuit de la fête), pour trier les heures.
     * 23:10 -> 190, 00:05 -> 245, 01:12 -> 312
     */
    function minutesSinceEvening(hhmm) {
        const [h, m] = hhmm.split(':').map(Number);
        let total = h * 60 + m;
        if (h < 20) total += 24 * 60;
        return total - 20 * 60;
    }

    const AFTER_23H = minutesSinceEvening('23:00');

    function isAfter23(photo) {
        return minutesSinceEvening(photo.time) >= AFTER_23H;
    }

    // Les 5 photos à garder, triées de la plus ancienne à la plus récente
    const KEPT = PHOTOS
        .filter(isAfter23)
        .sort((a, b) => minutesSinceEvening(a.time) - minutesSinceEvening(b.time));

    const KEPT_IDS = KEPT.map((p) => p.id).sort((a, b) => a - b);

    function normalizeWord(text) {
        return String(text)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toUpperCase()
            .replace(/\s+/g, '');
    }

    async function sha256Hex(text) {
        const data = new TextEncoder().encode(text);
        const buffer = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(buffer))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
    }

    function shuffle(array) {
        const a = array.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const tmp = a[i];
            a[i] = a[j];
            a[j] = tmp;
        }
        return a;
    }

    class CarnetKursty {
        constructor(config) {
            this.config = Object.assign({ onLevelComplete: null }, config || {});
            this.startTime = Date.now();
            this.scratchAudio = new Audio('../media/grattage.mp3');
            this.scratchAudio.loop = true;
            this.tingAudio = new Audio('../media/ting.mp3');

            this.el = {
                gate: document.getElementById('gate'),
                btnEnter: document.getElementById('btnEnter'),
                btnLeave: document.getElementById('btnLeave'),
                leaveMsg: document.getElementById('leaveMsg'),
                game: document.getElementById('game'),
                missionBox: document.getElementById('missionBox'),
                btnMission: document.getElementById('btnMission'),
                status: document.getElementById('status'),
                stepSelect: document.getElementById('stepSelect'),
                stepScratch: document.getElementById('stepScratch'),
                stepOrder: document.getElementById('stepOrder'),
                stepWord: document.getElementById('stepWord'),
                reveal: document.getElementById('reveal'),
                gridAll: document.getElementById('gridAll'),
                gridKept: document.getElementById('gridKept'),
                btnContinue: document.getElementById('btnContinue'),
                btnCheck: document.getElementById('btnCheck'),
                scratchCount: document.getElementById('scratchCount'),
                tiles: document.getElementById('tiles'),
                orderHint: document.getElementById('orderHint'),
                wordForm: document.getElementById('wordForm'),
                wordInput: document.getElementById('wordInput'),
                wordFb: document.getElementById('wordFb')
            };

            this.picked = new Set();
            this.selectErrors = 0;
            this.revealedCount = 0;
            this.expectedIndex = 0;
            this.orderErrors = 0;
            this.wordErrors = 0;
            this.wordDone = false;
            this.completionReported = false;

            this.bindGate();
            this.bindControls();
            this.buildSelectStep();
        }

        /* ================= UTILITAIRES ================= */

        setStatus(text, kind) {
            this.el.status.textContent = text || '';
            this.el.status.className = 'status' + (kind ? ' is-' + kind : '');
        }

        makeCard(photo) {
            const card = document.createElement('div');
            card.className = 'card';
            card.dataset.id = String(photo.id);

            const img = document.createElement('img');
            img.src = photo.src;
            img.alt = 'Photo de visiteur, ' + photo.time;
            img.draggable = false;
            card.appendChild(img);

            const time = document.createElement('div');
            time.className = 'card-time';
            time.textContent = photo.time;
            card.appendChild(time);

            const annot = document.createElement('div');
            annot.className = 'card-annot';
            annot.textContent = photo.annot;
            card.appendChild(annot);

            const letter = document.createElement('div');
            letter.className = 'card-letter';
            letter.textContent = photo.letter;
            card.appendChild(letter);

            return card;
        }

        /* ================= PORTE 18+ ================= */

        bindGate() {
            this.el.btnEnter.addEventListener('click', () => {
                this.el.gate.hidden = true;
                this.el.game.hidden = false;
                this.el.missionBox.hidden = false;
            });

            this.el.btnLeave.addEventListener('click', () => {
                this.el.leaveMsg.hidden = false;
                this.el.btnEnter.disabled = true;
                this.el.btnLeave.disabled = true;
            });

            this.el.btnMission.addEventListener('click', () => {
                this.el.missionBox.hidden = !this.el.missionBox.hidden;
            });
        }

        bindControls() {
            this.el.btnCheck.addEventListener('click', () => this.checkSelection());
            this.el.btnContinue.addEventListener('click', () => this.completeLevel());

            this.el.wordForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.checkWord();
            });
        }

        /* ================= ÉTAPE 1 : TRI ================= */

        buildSelectStep() {
            this.el.gridAll.innerHTML = '';
            shuffle(PHOTOS).forEach((photo) => {
                const card = this.makeCard(photo);
                card.addEventListener('click', () => this.togglePick(photo.id, card));
                this.el.gridAll.appendChild(card);
            });
        }

        togglePick(id, card) {
            if (this.picked.has(id)) {
                this.picked.delete(id);
                card.classList.remove('is-picked');
            } else {
                this.picked.add(id);
                card.classList.add('is-picked');
            }
            this.setStatus('');
        }

        checkSelection() {
            const picked = Array.from(this.picked).sort((a, b) => a - b);
            const ok = picked.length === KEPT_IDS.length && picked.every((id, i) => id === KEPT_IDS[i]);

            if (ok) {
                window.playAnswerSound('correct');
                this.setStatus('✓ Sélection correcte. Les annotations sont prêtes à être grattées.', 'success');
                this.el.btnCheck.disabled = true;
                setTimeout(() => this.startScratchStep(), 900);
                return;
            }

            this.selectErrors++;
            window.playAnswerSound('wrong');
            const badPicks = picked.filter((id) => !KEPT_IDS.includes(id));
            const missing = KEPT_IDS.length - picked.filter((id) => KEPT_IDS.includes(id)).length;

            let message;
            if (badPicks.length > 0) {
                message = 'Une des photos gardées date d\'avant 23h. Kursty a commencé à noter les visiteurs après.';
            } else if (missing > 0) {
                message = 'Il manque une photo prise après 23h00.';
            } else {
                message = 'Sélection incorrecte. Vérifie les heures.';
            }

            if (this.selectErrors >= 3) {
                message += ' Indice : les heures sont écrites en bas de chaque photo.';
            }

            this.setStatus(message, 'error');
        }

        /* ================= ÉTAPE 2 : GRATTAGE ================= */

        startScratchStep() {
            this.el.stepSelect.hidden = true;
            this.el.stepScratch.hidden = false;
            this.setStatus('');
            this.el.gridKept.innerHTML = '';
            this.updateScratchCounter();

            KEPT.forEach((photo) => {
                const card = this.makeCard(photo);
                const canvas = document.createElement('canvas');
                canvas.className = 'rature';
                card.appendChild(canvas);
                this.el.gridKept.appendChild(card);
                // Mise en place après affichage pour connaître la taille réelle
                requestAnimationFrame(() => this.setupRature(canvas, card, photo));
            });
        }

        setupRature(canvas, card, photo) {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const w = canvas.clientWidth;
            const h = canvas.clientHeight;
            canvas.width = Math.max(1, Math.round(w * dpr));
            canvas.height = Math.max(1, Math.round(h * dpr));
            const ctx = canvas.getContext('2d');
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            // Encre noire épaisse
            ctx.fillStyle = 'rgba(20, 14, 10, 0.96)';
            ctx.fillRect(0, 0, w, h);

            // Traits d'encre désordonnés
            for (let i = 0; i < 70; i++) {
                ctx.strokeStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.5)' : 'rgba(70,45,30,0.45)';
                ctx.lineWidth = 2 + Math.random() * 5;
                ctx.beginPath();
                ctx.moveTo(Math.random() * w, Math.random() * h);
                ctx.lineTo(Math.random() * w, Math.random() * h);
                ctx.stroke();
            }

            this.bindScratch(canvas, card, photo);
        }

        bindScratch(canvas, card, photo) {
            const ctx = canvas.getContext('2d');
            let drawing = false;
            let last = null;
            let lastCheck = 0;

            const pointFrom = (e) => {
                const rect = canvas.getBoundingClientRect();
                return { x: e.clientX - rect.left, y: e.clientY - rect.top };
            };

            const scratch = (a, b) => {
                ctx.save();
                ctx.globalCompositeOperation = 'destination-out';
                ctx.lineCap = 'round';
                ctx.lineWidth = 34;
                ctx.strokeStyle = '#000';
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
                ctx.restore();
            };

            const checkCleared = (force) => {
                if (card.classList.contains('is-revealed')) return;
                const now = Date.now();
                if (!force && now - lastCheck < 250) return;
                lastCheck = now;

                const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
                let cleared = 0;
                let total = 0;
                for (let y = 0; y < canvas.height; y += 8) {
                    for (let x = 0; x < canvas.width; x += 8) {
                        total++;
                        if (data[(y * canvas.width + x) * 4 + 3] < 128) cleared++;
                    }
                }
                if (total > 0 && cleared / total >= 0.5) {
                    this.revealPhoto(card, canvas);
                }
            };

            canvas.addEventListener('pointerdown', (e) => {
                drawing = true;
                canvas.setPointerCapture(e.pointerId);
                last = pointFrom(e);
                scratch(last, last);
                this.scratchAudio.currentTime = 0;
                this.scratchAudio.play().catch(() => {});
                e.preventDefault();
            });

            canvas.addEventListener('pointermove', (e) => {
                if (!drawing) return;
                const p = pointFrom(e);
                scratch(last, p);
                last = p;
                checkCleared(false);
                e.preventDefault();
            });

            const end = () => {
                if (!drawing) return;
                drawing = false;
                last = null;
                this.scratchAudio.pause();
                this.scratchAudio.currentTime = 0;
                checkCleared(true);
            };
            canvas.addEventListener('pointerup', end);
            canvas.addEventListener('pointercancel', end);
        }

        revealPhoto(card, canvas) {
            card.classList.add('is-revealed');
            canvas.style.display = 'none';
            this.scratchAudio.pause();
            this.scratchAudio.currentTime = 0;
            this.tingAudio.currentTime = 0;
            this.tingAudio.play().catch(() => {});
            this.revealedCount++;
            this.updateScratchCounter();

            if (this.revealedCount === KEPT.length) {
                this.setStatus('✓ Toutes les annotations sont grattées.', 'success');
                setTimeout(() => this.startOrderStep(), 1000);
            }
        }

        updateScratchCounter() {
            this.el.scratchCount.textContent =
                this.revealedCount + ' / ' + KEPT.length + ' annotations grattées';
        }

        /* ================= ÉTAPE 3 : RANGEMENT ================= */

        startOrderStep() {
            this.el.stepScratch.hidden = true;
            this.el.stepOrder.hidden = false;
            this.setStatus('');
            this.expectedIndex = 0;

            this.el.tiles.innerHTML = '';
            shuffle(KEPT).forEach((photo) => {
                const tile = document.createElement('button');
                tile.type = 'button';
                tile.className = 'tile';
                tile.dataset.letter = photo.letter;
                const letter = document.createElement('span');
                letter.className = 'tile-letter';
                letter.textContent = photo.letter;
                const time = document.createElement('span');
                time.className = 'tile-time';
                time.textContent = photo.time;
                tile.append(letter, time);
                tile.addEventListener('click', () => this.tapTile(tile));
                this.el.tiles.appendChild(tile);
            });
        }

        tapTile(tile) {
            if (tile.disabled) return;
            const expected = KEPT[this.expectedIndex];

            if (tile.dataset.letter === expected.letter) {
                window.playAnswerSound('correct');
                tile.classList.add('is-ok');
                tile.disabled = true;
                this.expectedIndex++;
                this.setStatus('');

                if (this.expectedIndex === KEPT.length) {
                    this.setStatus('✓ Les lettres sont rangées. Il reste le nom.', 'success');
                    setTimeout(() => this.startWordStep(), 900);
                }
                return;
            }

            this.orderErrors++;
            window.playAnswerSound('wrong');
            tile.classList.add('is-ko');
            this.setStatus('Mauvais ordre. Recommence depuis la plus ancienne photo.', 'error');

            let hint = this.orderErrors >= 3
                ? ' Indice : les heures sont écrites en bas de chaque photo. Compare-les.'
                : '';
            if (hint) this.setStatus('Mauvais ordre. Recommence depuis la plus ancienne photo.' + hint, 'error');

            setTimeout(() => this.resetTiles(), 700);
        }

        resetTiles() {
            this.expectedIndex = 0;
            this.el.tiles.querySelectorAll('.tile').forEach((t) => {
                t.classList.remove('is-ok', 'is-ko');
                t.disabled = false;
            });
        }

        /* ================= ÉTAPE 4 : LE MOT ================= */

        startWordStep() {
            this.el.stepOrder.hidden = true;
            this.el.stepWord.hidden = false;
            this.setStatus('');
            this.el.wordInput.focus();
        }

        async checkWord() {
            if (this.wordDone) return;

            if (!window.crypto || !window.crypto.subtle) {
                this.el.wordFb.className = 'feedback is-error';
                this.el.wordFb.textContent =
                    'Ce navigateur ne peut pas vérifier le mot. Ouvre le jeu depuis une adresse https ou localhost.';
                return;
            }

            const typed = normalizeWord(this.el.wordInput.value);
            if (!typed) return;

            const hash = await sha256Hex(typed);

            if (hash === EXPECTED_HASH) {
                window.playAnswerSound('correct');
                this.wordDone = true;
                this.el.wordInput.disabled = true;
                this.el.wordForm.querySelector('button').disabled = true;
                this.el.wordFb.className = 'feedback';
                this.el.wordFb.textContent = '';
                this.showReveal();
                return;
            }

            this.wordErrors++;
            window.playAnswerSound('wrong');
            this.el.wordFb.className = 'feedback is-error';
            this.el.wordFb.textContent = this.wordErrors >= 3
                ? 'Ce n\'est pas le mot. Indice : il ne fait que 5 lettres.'
                : 'Ce n\'est pas le mot. Relis les lettres et les heures.';
        }

        /* ================= RÉUSSITE ================= */

        completeLevel() {
            if (!this.wordDone || this.completionReported) return;
            this.completionReported = true;
            this.el.btnContinue.disabled = true;

            const timeElapsed = Math.round((Date.now() - this.startTime) / 1000);
            if (typeof this.config.onLevelComplete === 'function') {
                this.config.onLevelComplete({
                    level: 1,
                    status: 'completed',
                    timeElapsed: timeElapsed
                });
            }
        }

        showReveal() {
            this.el.stepWord.hidden = true;
            this.el.reveal.hidden = false;
            this.setStatus('✓ Le nom est trouvé.', 'success');
        }
    }

    function start() {
        window.carnetKursty = new CarnetKursty(window.baraqueConfig || {});
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
