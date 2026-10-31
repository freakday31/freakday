/**
 * LA BARAQUE DES HORREURS - NIVEAU 2 : LE CONTACT
 * JavaScript natif. Aucune dépendance. Aucun service externe.
 *
 * Configuration optionnelle (à définir AVANT ce script dans index.html) :
 * window.baraqueConfig = {
 *   onLevelComplete: function (data) {}   // reçoit { level: 2, status: 'completed', timeElapsed }
 * };
 *
 * Chaque nœud du dialogue contient :
 *   say      : les bulles de Dorian, dans l'ordre
 *   choices  : les réponses du joueur { label, to, d } (d = variation de confiance)
 *   end      : true si la conversation est réussie (affiche le mot DAY)
 *   cut      : true si Dorian coupe la conversation
 */
(function () {
    'use strict';

    const START_TRUST = 3;
    const MAX_TRUST = 3;

    const NODES = {
        start: {
            say: [
                'Qui t\'a donné mon numéro ?',
                'Dis vite. J\'ai pas que ça à foutre.',
                'Et réfléchis avant de répondre. Ma patience est déjà dans le rouge.'
            ],
            choices: [
                { label: 'Kursty. Il a écrit ton nom dans son carnet.', to: 'kursty', d: 0 },
                { label: 'Dis-moi où il est, connard.', to: 'insult1', d: -2 },
                { label: 'Je suis flic. Réponds.', to: 'lie', d: -1 },
                { label: 'J\'ai trouvé son carnet. Je veux comprendre ce qui lui est arrivé.', to: 'kursty', d: 1 }
            ]
        },

        kursty: {
            say: [
                'Kursty… Ce vieux fils de pute. Il est mort ou quoi ?',
                'Tout le monde le croyait charmant. C\'était un sacré numéro, ce connard.',
                'Vous les flics, vous arrivez toujours après la bataille.',
                'Alors, qu\'est-ce que tu lui veux ? Et me sors pas une histoire bidon.'
            ],
            choices: [
                { label: 'Qu\'est-ce qui s\'est passé la nuit de la fête ?', to: 'night', d: 1 },
                { label: 'Tu as peur de lui ?', to: 'fear', d: 0 },
                { label: 'Ferme ta gueule et parle.', to: 'insult2', d: -2 },
                { label: 'Tu bossais avec lui à la fête ?', to: 'worked', d: 1 }
            ]
        },

        worked: {
            say: [
                'Ouais. Je connaissais les coulisses mieux que les visiteurs.',
                'Au début, c\'était juste un boulot minable avec un patron minable.',
                'Puis j\'ai compris que Kursty ne jouait pas un rôle. Ce type était vraiment taré.'
            ],
            choices: [
                { label: 'Qu\'est-ce qui s\'est passé après 21h ?', to: 'night', d: 1 },
                { label: 'Pourquoi tu es resté à la baraque ?', to: 'door', d: 0 },
                { label: 'Tu aurais pu partir, merde.', to: 'insult2', d: -1 }
            ]
        },

        lie: {
            say: [
                'Flic ? Tu mens comme un gamin de quinze ans.',
                'Et ta voix tremble comme une feuille, putain.',
                'Refais ta copie, et vite, avant que je raccroche.'
            ],
            choices: [
                { label: 'Bon. Je suis visiteur. J\'ai juste un carnet.', to: 'kursty', d: 0 },
                { label: 'Je me fous de ce que tu penses.', to: 'insult2', d: -2 },
                { label: 'OK, je ne suis pas flic. J\'ai trouvé un carnet à son nom.', to: 'kursty', d: 0 }
            ]
        },

        insult1: {
            say: [
                'Tu me parles comme ça ? Tu veux que je raccroche, c\'est ça ?',
                'Je suis pas ton larbin, espèce de connard.',
                'Dégage ou je te bloque. C\'est ta dernière chance.'
            ],
            choices: [
                { label: 'Excuse-moi. Parle, s\'il te plaît.', to: 'kursty', d: 0 },
                { label: 'T\'es pas en position de faire le malin, pauvre con.', to: 'insult2', d: -2 },
                { label: 'D\'accord, je reprends. Je cherche juste des réponses.', to: 'kursty', d: 0 }
            ]
        },

        fear: {
            say: [
                'Peur ? T\'es con ou tu le fais exprès ?',
                'La peur, c\'est pour les gamins qui entrent dans la baraque.',
                'Moi, c\'est plutôt la haine qui me reste. Et crois-moi, elle tient chaud.'
            ],
            choices: [
                { label: 'Alors parle-moi de la baraque.', to: 'night', d: 1 },
                { label: 'Tu me fais chier avec tes histoires.', to: 'insult2', d: -1 },
                { label: 'Tu as vu Kursty faire quoi, exactement ?', to: 'worked', d: 1 }
            ]
        },

        insult2: {
            say: [
                'Ta gueule toi-même. Tu veux que je raccroche ? Je raccroche.',
                'Chaque seconde où je reste en ligne, je la regrette.',
                'Choisis tes mots, merde. Je ne vais pas répéter.'
            ],
            choices: [
                { label: 'Non. Attends. Continue.', to: 'night', d: 0 },
                { label: 'Vas-y, raccroche, t\'es rien du tout.', to: 'cut', d: -2 },
                { label: 'Je ne veux pas me battre. Parle-moi de la porte.', to: 'door', d: 1 }
            ]
        },

        night: {
            say: [
                'Après 21h, plus personne n\'entrait dans la baraque.',
                'Kursty disait que ça marchait mieux comme ça. Il les attendait.',
                'Les lumières restaient allumées, mais la musique s\'arrêtait. C\'était le signal.',
                'À ce moment-là, les visiteurs comprenaient qu\'ils étaient coincés.'
            ],
            choices: [
                { label: 'Qu\'est-ce qui marchait ?', to: 'door', d: 1 },
                { label: 'Dépêche-toi, accouche.', to: 'impatient', d: -1 },
                { label: 'Il est mort, c\'est ça ?', to: 'dead', d: 0 },
                { label: 'Pourquoi la musique s\'arrêtait après 21h ?', to: 'door', d: 1 }
            ]
        },

        impatient: {
            say: [
                'Me dépêcher ? J\'attends depuis vingt ans que quelqu\'un pose la bonne question.',
                'T\'es chanceux que je sois encore là.',
                'J\'ai déjà donné assez de temps à cette baraque de merde.',
                'Alors pose ta question et arrête de tourner autour du pot.'
            ],
            choices: [
                { label: 'Alors arrête ta diva et parle.', to: 'door', d: 0 },
                { label: 'Tu parles trop pour un mec qui a les chocottes.', to: 'insult2', d: -1 },
                { label: 'Pourquoi tu as attendu vingt ans pour en parler ?', to: 'door', d: 1 }
            ]
        },

        dead: {
            say: [
                'Mort ? Il est pire que mort. Pose une vraie question, espèce d\'idiot.',
                'Y a des choses qui auraient dû rester enterrées, bordel.',
                'Et si tu veux comprendre, arrête de deviner.'
            ],
            choices: [
                { label: 'Qu\'est-ce qui marchait, la baraque ?', to: 'door', d: 1 },
                { label: 'Tu racontes n\'importe quoi.', to: 'insult2', d: -1 },
                { label: 'Qu\'est-ce qu\'il a fait aux visiteurs ?', to: 'night', d: 1 }
            ]
        },

        door: {
            say: [
                'Tu veux savoir ce qui s\'est passé, ou tu veux juste te sentir malin ?',
                'Parce que moi, j\'ai vu cette porte se refermer. J\'entends encore le bruit.',
                'Alors pose une vraie question, pour une fois.'
            ],
            choices: [
                { label: 'Quelle porte ?', to: 'open', d: 1 },
                { label: 'Je veux savoir ce qui s\'est passé.', to: 'open', d: 0 },
                { label: 'Tu sais rien, t\'as rien à dire.', to: 'cut', d: -3 },
                { label: 'Tu l\'as verrouillée toi-même ?', to: 'open', d: 1 }
            ]
        },

        open: {
            say: [
                'La porte de la baraque, connard. Celle qu\'on ne rouvre pas.',
                'J\'ai aidé à la fermer la nuit de la disparition. Il y avait encore du monde à l\'intérieur.',
                'J\'ai tourné la clé. Kursty m\'a juré qu\'il n\'y avait plus personne.',
                'Je savais qu\'il mentait. J\'ai quand même obéi, putain.'
            ],
            choices: [
                { label: 'Qui était à l\'intérieur ?', to: 'final', d: 1 },
                { label: 'Pourquoi tu l\'as fait ?', to: 'final', d: 0 },
                { label: 'Tu as essayé de les faire sortir ?', to: 'final', d: 1 }
            ]
        },

        final: {
            say: [
                'Des gens qui voulaient voir. Kursty leur promettait la sortie.',
                'Il leur disait qu\'il y avait toujours une issue. Quel beau salaud.',
                'Il mentait sur un seul point. Ce soir-là, c\'était le jour de trop.'
            ],
            revealButton: true,
            choices: [
                { label: 'Pourquoi tu me racontes ça seulement maintenant ?', to: 'confession', d: 0 },
                { label: 'Qu\'est-ce que tu as fait après avoir fermé la porte ?', to: 'confession', d: 0 }
            ]
        },

        confession: {
            say: [
                'Parce que j\'en ai marre de me réveiller avec cette histoire dans le crâne.',
                'J\'ai gardé le silence pendant des années. Ça n\'a rien réparé, putain.',
                'Tu veux encore parler, ou tu veux enfin connaître le mot ?'
            ],
            revealButton: true,
            choices: [
                { label: 'Tu regrettes d\'avoir obéi à Kursty ?', to: 'regret', d: 0 },
                { label: 'Tu as essayé de les faire sortir ?', to: 'regret', d: 0 }
            ]
        },

        regret: {
            say: [
                'Bien sûr que je regrette. Je suis pas un putain de monstre.',
                'Mais le regret, ça ne rouvre pas une porte et ça ne rend personne.',
                'Je ne peux pas changer cette nuit-là. Toi, tu peux encore décider de la suite.'
            ],
            revealButton: true,
            choices: [
                { label: 'Continue. Qu\'est-ce que tu as vu ?', to: 'confession', d: 0 },
                { label: 'J\'ai compris. Pourquoi le mot DAY ?', to: 'final', d: 0 }
            ]
        },

        cut: {
            say: [
                'T\'es pas le premier à me casser les couilles. Dégage.',
                'Numéro bloqué. Et va te faire foutre.'
            ],
            cut: true
        }
    };

    function wait(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    class ContactDorian {
        constructor(config) {
            this.config = Object.assign({ onLevelComplete: null }, config || {});
            this.startTime = Date.now();
            this.sendMessageSound = new Audio('../media/sendsms.mp3');
            this.receiveMessageSound = new Audio('../media/newsms.mp3');
            this.sendMessageSound.preload = 'auto';
            this.receiveMessageSound.preload = 'auto';

            this.el = {
                gate: document.getElementById('gate'),
                btnEnter: document.getElementById('btnEnter'),
                btnLeave: document.getElementById('btnLeave'),
                leaveMsg: document.getElementById('leaveMsg'),
                game: document.getElementById('game'),
                missionBox: document.getElementById('missionBox'),
                btnMission: document.getElementById('btnMission'),
                gaugeFill: document.getElementById('gaugeFill'),
                chat: document.getElementById('chat'),
                choices: document.getElementById('choices'),
                btnReveal: document.getElementById('btnReveal'),
                btnRestart: document.getElementById('btnRestart'),
                result: document.getElementById('result')
            };

            this.trust = START_TRUST;
            this.busy = false;

            this.bindGate();
            this.el.btnReveal.addEventListener('click', () => this.endConversation(true));
            this.el.btnRestart.addEventListener('click', () => this.restart());
            this.updateGauge();
            this.restart(false);
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

        /* ================= AFFICHAGE ================= */

        updateGauge() {
            const pct = Math.max(0, Math.min(MAX_TRUST, this.trust)) / MAX_TRUST * 100;
            this.el.gaugeFill.style.width = pct + '%';
            this.el.gaugeFill.classList.toggle('is-low', this.trust <= 1);
        }

        addBubble(text, kind) {
            if (kind === 'me') this.playMessageSound(this.sendMessageSound);
            if (kind === 'dorian') this.playMessageSound(this.receiveMessageSound);

            const div = document.createElement('div');
            div.className = 'bubble ' + kind;
            div.textContent = text;
            this.el.chat.appendChild(div);
            this.scrollDown();
            return div;
        }

        /** Affiche le mot DAY en évidence dans une bulle */
        addDorianBubbleWithWord(text) {
            this.playMessageSound(this.receiveMessageSound);
            const div = document.createElement('div');
            div.className = 'bubble dorian';
            const parts = text.split('DAY');
            parts.forEach((part, i) => {
                div.appendChild(document.createTextNode(part));
                if (i < parts.length - 1) {
                    const span = document.createElement('span');
                    span.className = 'key-word';
                    span.textContent = 'DAY';
                    div.appendChild(span);
                }
            });
            this.el.chat.appendChild(div);
            this.scrollDown();
        }

        playMessageSound(sound) {
            sound.currentTime = 0;
            sound.play().catch(() => {});
        }

        addTyping() {
            const div = this.addBubble('Dorian écrit…', 'typing');
            return div;
        }

        scrollDown() {
            this.el.chat.scrollTop = this.el.chat.scrollHeight;
        }

        clearChoices() {
            this.el.choices.innerHTML = '';
        }

        renderChoices(choices) {
            this.clearChoices();
            const shuffledChoices = choices.slice();
            for (let currentIndex = shuffledChoices.length - 1; currentIndex > 0; currentIndex--) {
                const randomIndex = Math.floor(Math.random() * (currentIndex + 1));
                [shuffledChoices[currentIndex], shuffledChoices[randomIndex]] =
                    [shuffledChoices[randomIndex], shuffledChoices[currentIndex]];
            }

            shuffledChoices.forEach((choice) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'choice';
                btn.textContent = '> ' + choice.label;
                btn.addEventListener('click', () => this.pick(choice));
                this.el.choices.appendChild(btn);
            });
        }

        /* ================= DIALOGUE ================= */

        async playNode(id) {
            const node = NODES[id];
            this.busy = true;
            this.el.btnReveal.hidden = true;
            this.clearChoices();

            for (let i = 0; i < node.say.length; i++) {
                const typing = this.addTyping();
                await wait(900 + Math.random() * 1600);
                typing.remove();

                const isLast = i === node.say.length - 1;
                this.addBubble(node.say[i], 'dorian');
                await wait(350 + Math.random() * 650);
            }

            this.busy = false;

            if (node.cut) {
                this.endConversation(false);
                return;
            }
            this.el.btnReveal.hidden = !node.revealButton;
            this.renderChoices(node.choices);
        }

        pick(choice) {
            if (this.busy) return;
            this.busy = true;
            this.el.btnReveal.hidden = true;
            this.clearChoices();

            this.addBubble(choice.label, 'me');
            this.trust = Math.min(MAX_TRUST, this.trust + choice.d);
            this.updateGauge();

            const nextId = this.trust <= 0 ? 'cut' : choice.to;
            this.busy = false;
            setTimeout(() => this.playNode(nextId), 500 + Math.random() * 900);
        }

        endConversation(success) {
            if (success) {
                window.playAnswerSound('correct');
                this.el.btnReveal.hidden = true;
                this.clearChoices();
                this.el.result.hidden = false;
                this.el.btnRestart.hidden = true;
                const timeElapsed = Math.round((Date.now() - this.startTime) / 1000);
                if (typeof this.config.onLevelComplete === 'function') {
                    this.config.onLevelComplete({
                        level: 2,
                        status: 'completed',
                        timeElapsed: timeElapsed
                    });
                }
            } else {
                window.playAnswerSound('wrong');
                this.addBubble('Dorian a quitté la conversation.', 'system');
                this.el.btnRestart.hidden = false;
            }
        }

        restart(clear = true) {
            this.trust = START_TRUST;
            this.updateGauge();
            this.busy = false;
            this.el.chat.innerHTML = '';
            this.el.result.hidden = true;
            this.el.btnRestart.hidden = true;
            this.clearChoices();
            if (clear) {
                this.addBubble('Conversation ouverte avec Dorian.', 'system');
            }
            this.playNode('start');
        }
    }

    function start() {
        window.contactDorian = new ContactDorian(window.baraqueConfig || {});
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
