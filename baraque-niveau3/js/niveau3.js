/**
 * LA BARAQUE DES HORREURS - NIVEAU 3 : LA BANDE
 * JavaScript natif. Aucune dépendance.
 *
 * Configuration optionnelle (à définir AVANT ce script dans index.html) :
 * window.baraqueConfig = {
 *   onLevelComplete: function (data) {}   // reçoit { level: 3, status: 'completed', timeElapsed }
 * };
 *
 * Solution : cassette B, chiffres 31. La cassette A donne 37 en Morse (piège).
 * Seule l'empreinte SHA-256 des chiffres est stockée dans le code.
 */
(function () {
    'use strict';

    // SHA-256 de "31"
    const EXPECTED_HASH = 'eb1e33e8a81b697b75855af6bfcdbcbf7cbbde9f94962ceaec1ed8af21f5a50f';
    const TRUE_TAPE = 'B';

    // Séquences Morse jouées par chaque cassette : A donne 37, B donne 31
    const MORSE_SEQUENCES = {
        A: ['...--', '--...'],   // 3, 7
        B: ['...--', '.----']    // 3, 1
    };

    const MORSE_CODE = {
        '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-',
        '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.'
    };

    const DOT = 0.12;        // durée d'un point (s)
    const DASH = 0.36;       // durée d'un trait (s)
    const SYMBOL_GAP = 0.12; // pause entre deux signaux d'un même chiffre (s)
    const DIGIT_GAP = 0.9;   // pause entre deux chiffres (s)

    async function sha256Hex(text) {
        const data = new TextEncoder().encode(text);
        const buffer = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(buffer))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
    }

    function wait(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    class BandeNiveau3 {
        constructor(config) {
            this.config = Object.assign({ onLevelComplete: null }, config || {});
            this.startTime = Date.now();

            this.el = {
                gate: document.getElementById('gate'),
                btnEnter: document.getElementById('btnEnter'),
                btnLeave: document.getElementById('btnLeave'),
                leaveMsg: document.getElementById('leaveMsg'),
                game: document.getElementById('game'),
                missionBox: document.getElementById('missionBox'),
                btnMission: document.getElementById('btnMission'),
                status: document.getElementById('status'),
                stepTapes: document.getElementById('stepTapes'),
                stepAnswer: document.getElementById('stepAnswer'),
                answerForm: document.getElementById('answerForm'),
                digitsInput: document.getElementById('digitsInput'),
                btnAnswer: document.getElementById('btnAnswer'),
                answerFb: document.getElementById('answerFb'),
                reveal: document.getElementById('reveal'),
                btnContinue: document.getElementById('btnContinue'),
                audioCountdown: document.getElementById('audioCountdown'),
                tapes: {
                    A: document.getElementById('audioA'),
                    B: document.getElementById('audioB')
                }
            };

            this.audioCtx = null;
            this.morseTimers = [];
            this.playing = null;     // 'A' | 'B' | null
            this.oscillators = [];
            this.answerErrors = 0;
            this.solved = false;

            this.bindGate();
            this.bindTapes();
            this.bindAnswer();
            this.watchMissingAudio();
            this.el.btnContinue.addEventListener('click', () => {
                if (!this.solved || this.el.btnContinue.disabled) return;
                this.el.btnContinue.disabled = true;
                if (typeof this.config.onLevelComplete === 'function') {
                    this.config.onLevelComplete({
                        level: 3,
                        status: 'completed',
                        timeElapsed: Math.round((Date.now() - this.startTime) / 1000)
                    });
                }
            });
        }

        /* ================= UTILITAIRES ================= */

        setStatus(text, kind) {
            this.el.status.textContent = text || '';
            this.el.status.className = 'status' + (kind ? ' is-' + kind : '');
        }

        getAudioContext() {
            if (!this.audioCtx) {
                const AC = window.AudioContext || window.webkitAudioContext;
                this.audioCtx = new AC();
            }
            if (this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }
            return this.audioCtx;
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

        /* Signale les fichiers audio absents, sans bloquer le reste du niveau */
        watchMissingAudio() {
            const all = [
                this.el.audioCountdown,
                this.el.tapes.A,
                this.el.tapes.B
            ];
            all.forEach((audio) => {
                audio.addEventListener('error', () => {
                    this.setStatus(
                        'Fichier audio manquant : ' + audio.getAttribute('src') + '. Ajoute-le dans media/audio/.',
                        'error'
                    );
                });
            });
        }

        /* ================= CASSETTES ================= */

        bindTapes() {
            document.querySelectorAll('.tape [data-action]').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const tape = btn.dataset.tape;
                    const action = btn.dataset.action;
                    if (action === 'play') this.playTape(tape);
                    if (action === 'stop') this.stopAll();
                });
            });
        }

        stopAll() {
            this.morseTimers.forEach((t) => clearTimeout(t));
            this.morseTimers = [];
            this.oscillators.forEach((o) => {
                try { o.stop(); } catch (err) { /* déjà arrêté */ }
            });
            this.oscillators = [];
            this.el.audioCountdown.pause();
            this.el.tapes.A.pause();
            this.el.tapes.B.pause();
            this.setPlaying(null);
        }

        setPlaying(tape) {
            this.playing = tape;
            document.querySelectorAll('.tape').forEach((t) => {
                t.classList.toggle('is-playing', t.dataset.tape === tape);
            });
        }

        /**
         * Lecture d'une cassette : compte à rebours, puis phrase et bips Morse simultanés.
         */
        async playTape(tape) {
            this.stopAll();
            this.setPlaying(tape);
            this.setStatus('');

            const countdown = this.el.audioCountdown;
            const phrase = this.el.tapes[tape];

            try {
                countdown.currentTime = 0;
                await countdown.play();
                await new Promise((resolve) => {
                    countdown.onended = resolve;
                    countdown.onerror = resolve;
                });
                if (this.playing !== tape) return;

                const ctx = this.getAudioContext();
                const startAt = ctx.currentTime + 0.05;
                phrase.currentTime = 0;
                await phrase.play();
                this.scheduleMorse(tape, startAt);
                phrase.onended = () => this.setPlaying(null);
            } catch (err) {
                this.setPlaying(null);
            }
        }

        /**
         * Planifie les bips Morse en même temps que la phrase.
         */
        scheduleMorse(tape, startAt) {
            const ctx = this.getAudioContext();
            const sequence = MORSE_SEQUENCES[tape];
            let t = startAt;

            const tone = (start, duration) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.value = 880;
                gain.gain.setValueAtTime(0, start);
                gain.gain.linearRampToValueAtTime(0.2, start + 0.01);
                gain.gain.setValueAtTime(0.2, start + duration - 0.01);
                gain.gain.linearRampToValueAtTime(0, start + duration);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(start);
                osc.stop(start + duration + 0.02);
                this.oscillators.push(osc);
            };

            sequence.forEach((code) => {
                for (const symbol of code) {
                    const dur = symbol === '.' ? DOT : DASH;
                    tone(t, dur);
                    t += dur + SYMBOL_GAP;
                }
                t += DIGIT_GAP;
            });

            return t - startAt;
        }

        /* ================= RÉPONSE ================= */

        bindAnswer() {
            this.el.digitsInput.addEventListener('input', () => {
                this.el.digitsInput.value = this.el.digitsInput.value.replace(/[^0-9]/g, '');
            });

            this.el.answerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.checkAnswer();
            });
        }

        async checkAnswer() {
            if (this.solved) return;

            if (!window.crypto || !window.crypto.subtle) {
                this.el.answerFb.className = 'feedback is-error';
                this.el.answerFb.textContent =
                    'Ce navigateur ne peut pas vérifier le code. Ouvre le jeu depuis une adresse https ou localhost.';
                return;
            }

            const choice = this.el.answerForm.querySelector('input[name="tape"]:checked');
            const digits = this.el.digitsInput.value.trim();

            if (!choice) {
                this.answerFail('Choisis la cassette qui correspond au carnet.');
                return;
            }

            if (choice.value !== TRUE_TAPE) {
                this.answerFail("Cette bande ne correspond pas au carnet. Écoute-la de nouveau, jusqu'à la fin.");
                return;
            }

            if (!digits) {
                this.answerFail('Tape les deux chiffres obtenus.');
                return;
            }

            const hash = await sha256Hex(digits);
            if (hash === EXPECTED_HASH) {
                this.succeed();
            } else {
                this.answerFail(
                    this.answerErrors >= 2
                        ? 'Mauvais chiffres. Indice : un bip court suivi d\'un bip long vaut un chiffre. Compte les bips.'
                        : 'Mauvais chiffres. Relis les signaux Morse.'
                );
            }
        }

        answerFail(message) {
            this.answerErrors++;
            window.playAnswerSound('wrong');
            this.el.answerFb.className = 'feedback is-error';
            this.el.answerFb.textContent = message;
        }

        succeed() {
            window.playAnswerSound('correct');
            this.solved = true;
            this.stopAll();
            this.el.digitsInput.disabled = true;
            this.el.btnAnswer.disabled = true;
            this.el.answerFb.className = 'feedback';
            this.el.answerFb.textContent = '';
            this.el.stepTapes.hidden = true;
            this.el.stepAnswer.hidden = true;
            this.el.reveal.hidden = false;
            this.setStatus('✓ La cassette B est décodée. Souviens-toi du numéro 31.', 'success');
        }
    }

    function start() {
        window.bandeNiveau3 = new BandeNiveau3(window.baraqueConfig || {});
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
