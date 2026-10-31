/**
 * LA BARAQUE DES HORREURS - NIVEAU 4 : LE LABYRINTHE DES BALISES
 * JavaScript natif. Aucune dépendance.
 *
 * Configuration optionnelle (à définir AVANT ce script dans index.html) :
 * window.baraqueConfig = {
 *   onLevelComplete: function (data) {}   // reçoit { level: 4, status: 'completed', timeElapsed }
 * };
 *
 * Mécanique :
 * - Les commandes sont inversées (haut = bas, gauche = droite).
 * - Trois parcours successifs contiennent 3, 5 puis 9 balises.
 * - Il faut les toucher dans l'ordre du signal. Une erreur réinitialise le parcours courant.
 * - Les parcours révèlent LUI, PORTE puis INTERLUDE.
 * - L'interlude se débloque après la sortie du troisième parcours.
 */
(function () {
    'use strict';

    const MAZE_STAGES = [
        {
            beaconCount: 3,
            letters: 'LUI',
            map: [
                '#############',
                '#S..#....3#.#',
                '#.#.#.###.#.#',
                '#.#.......#.#',
                '#.#####.###.#',
                '#...#.2.#...#',
                '###.#.#.#.#.#',
                '#1..#.#...#E#',
                '#############'
            ]
        },
        { width: 17, height: 13, beaconCount: 5, letters: 'PORTE' },
        { width: 23, height: 17, beaconCount: 9, letters: 'INTERLUDE' }
    ];

    function generateMaze(stage) {
        const grid = Array.from({ length: stage.height }, () => Array(stage.width).fill('#'));
        const stack = [{ row: 1, column: 1 }];
        const carveDirections = [
            { row: -2, column: 0 },
            { row: 2, column: 0 },
            { row: 0, column: -2 },
            { row: 0, column: 2 }
        ];
        grid[1][1] = '.';

        while (stack.length) {
            const current = stack[stack.length - 1];
            const neighbors = carveDirections
                .map(direction => ({
                    row: current.row + direction.row,
                    column: current.column + direction.column
                }))
                .filter(next => next.row > 0 && next.row < stage.height - 1 &&
                    next.column > 0 && next.column < stage.width - 1 &&
                    grid[next.row][next.column] === '#');

            if (!neighbors.length) {
                stack.pop();
                continue;
            }

            const next = neighbors[Math.floor(Math.random() * neighbors.length)];
            grid[(current.row + next.row) / 2][(current.column + next.column) / 2] = '.';
            grid[next.row][next.column] = '.';
            stack.push(next);
        }

        const passageCandidates = [];
        for (let row = 1; row < stage.height - 1; row++) {
            for (let column = 1; column < stage.width - 1; column++) {
                if (grid[row][column] !== '#') continue;

                const verticalPassage = grid[row - 1][column] !== '#' && grid[row + 1][column] !== '#';
                const horizontalPassage = grid[row][column - 1] !== '#' && grid[row][column + 1] !== '#';
                if (verticalPassage || horizontalPassage) passageCandidates.push({ row, column });
            }
        }

        for (let index = passageCandidates.length - 1; index > 0; index--) {
            const randomIndex = Math.floor(Math.random() * (index + 1));
            [passageCandidates[index], passageCandidates[randomIndex]] =
                [passageCandidates[randomIndex], passageCandidates[index]];
        }

        const extraPassages = Math.max(stage.beaconCount * 2, Math.floor(stage.width * stage.height * 0.06));
        passageCandidates.slice(0, extraPassages).forEach(({ row, column }) => {
            grid[row][column] = '.';
        });

        const startKey = '1,1';
        const queue = [{ row: 1, column: 1 }];
        const parents = new Map([[startKey, null]]);
        const distances = new Map([[startKey, 0]]);
        const walkDirections = [
            { row: -1, column: 0 },
            { row: 1, column: 0 },
            { row: 0, column: -1 },
            { row: 0, column: 1 }
        ];
        let exit = queue[0];

        for (let queueIndex = 0; queueIndex < queue.length; queueIndex++) {
            const current = queue[queueIndex];
            const currentKey = `${current.row},${current.column}`;
            if (distances.get(currentKey) > distances.get(`${exit.row},${exit.column}`)) {
                exit = current;
            }

            walkDirections.forEach(direction => {
                const next = {
                    row: current.row + direction.row,
                    column: current.column + direction.column
                };
                const nextKey = `${next.row},${next.column}`;
                if (grid[next.row]?.[next.column] === '#' || parents.has(nextKey)) return;
                parents.set(nextKey, currentKey);
                distances.set(nextKey, distances.get(currentKey) + 1);
                queue.push(next);
            });
        }

        const path = [];
        let pathKey = `${exit.row},${exit.column}`;
        while (pathKey !== null) {
            const [row, column] = pathKey.split(',').map(Number);
            path.push({ row, column });
            pathKey = parents.get(pathKey);
        }
        path.reverse();

        const beaconCells = [];
        const selectedBeaconCells = [];
        for (let row = 1; row < stage.height - 1; row++) {
            for (let column = 1; column < stage.width - 1; column++) {
                if (grid[row][column] === '.' && !(row === 1 && column === 1) &&
                    !(row === exit.row && column === exit.column)) {
                    beaconCells.push({ row, column });
                }
            }
        }

        for (let beaconIndex = 0; beaconIndex < stage.beaconCount; beaconIndex++) {
            const scores = beaconCells.map((candidate, index) => ({
                index,
                distance: beaconIndex === 0
                    ? Math.abs(candidate.row - 1) + Math.abs(candidate.column - 1)
                    : Math.min(...selectedBeaconCells.map(prior => {
                        return Math.abs(candidate.row - prior.row) + Math.abs(candidate.column - prior.column);
                    }))
            }));
            const maxDistance = Math.max(...scores.map(score => score.distance));
            const farthest = scores.filter(score => score.distance === maxDistance);
            const selected = farthest[Math.floor(Math.random() * farthest.length)];
            const cell = beaconCells.splice(selected.index, 1)[0];
            selectedBeaconCells.push(cell);
            grid[cell.row][cell.column] = String(beaconIndex + 1);
        }

        grid[1][1] = 'S';
        grid[exit.row][exit.column] = 'E';
        return grid.map(row => row.join(''));
    }

    // Répliques aléatoires quand le joueur heurte un mur
    const WALL_PHRASES = [
        // Angoisse
        "Tu crois que c’est un mur ? Il respire.",
        "Ça fait trois fois que tu passes par ici. Tu ne te souviens pas de la première.",
        "Le couloir d’avant était plus long. Tu l’as raccourci en avançant.",
        "Il y a quelqu’un de l’autre côté. Il tape doucement, depuis longtemps.",
        "Tu as entendu ton prénom ? Non ? Attends encore un peu.",
        "Ce mur est plus froid que les autres. Il a été froid plus longtemps.",
        "Tes pas résonnent un peu après toi. Ce n’est pas un écho.",
        "Quelqu’un a ouvert cette porte avant toi. Elle n’a jamais été refermée.",
        "Tu ne retrouveras pas l’entrée. Elle s’est déplacée derrière toi.",
        "Le labyrinthe connaît ton nom. Il attend que tu le prononces.",
        "Tu sens l’air d’une pièce qui n’a pas été aérée depuis des années.",
        "Ce mur a une empreinte de main. Elle est plus petite que la tienne.",

        // Oppression
        "Les murs se rapprochent quand tu ne regardes pas.",
        "Ça ne sert à rien de courir. Le chemin tourne toujours du même côté.",
        "Tu as aimé avancer dans le noir ? Alors reste-y.",
        "Il n’y a pas de sortie. Il y a seulement des endroits où tu n’es pas encore allé.",
        "Tu as fait la même erreur que le dernier visiteur. Il a dit exactement la même chose.",
        "Plus tu tournes, plus le plafond descend. Tu n’as pas remarqué ?",
        "Le couloir t’a déjà pris deux pas de plus que tu n’en as faits.",
        "Tu ne peux pas sortir, tu peux seulement t’enfoncer.",
        "Ce mur n’est pas là pour te bloquer. Il est là pour te garder.",
        "Chaque virage te ramène au même endroit, un peu plus sombre.",

        // Moquerie
        "Ah, tu trembles ? C’est mignon. Continue.",
        "Tu es perdu ? Bien sûr que tu es perdu, tu as les yeux fermés.",
        "Encore un qui se croit malin. Le mur te remercie pour ta visite.",
        "Tu as tourné à gauche, puis à droite, puis tu as paniqué. Classique.",
        "Tu cherches la sortie ? Tu l’as déjà ratée trois fois, pauvre idiot.",
        "Tu avances comme un chien qui a perdu son maître.",
        "Tu crois vraiment que la lumière de ta lampe te protège ? Quelle naïveté.",
        "Pas mal pour quelqu’un qui hurle chaque fois qu’il touche un mur.",
        "Tu fais peine à voir. Vraiment. Même le couloir s’ennuie.",
        "Tu es le visiteur le plus lent qu’on ait eu depuis longtemps.",

        // Colère
        "Arrête de taper dans mes murs, tu me fais mal à la tête.",
        "Tu n’as rien à faire ici. Tu l’as compris, ou tu veux que je te l’écrive ?",
        "Dégage de là, ou je te garde avec moi jusqu’à la fin de la fête.",
        "Tu me fatigues. Tu me fatigues vraiment. Continue, et tu verras.",
        "Qui t’a dit de toucher mes murs ? Personne, parce que personne n’est assez stupide.",
        "Ça suffit, tu fais trop de bruit. Tu vas attirer les autres.",
        "Tu veux une sortie ? Demande-la poliment, pour voir si je réponds.",
        "Ferme ta lampe. Tu n’as pas à voir ce qui te regarde.",
        "Je t’ai donné un chemin, et tu l’as pris de travers. Typique.",
        "La prochaine fois que tu cognes, je ne ralentis pas le couloir.",

        // Malaise
        "Un cri vient de la pièce à côté. Il s’arrête brusquement. Tu ne l’entends plus.",
        "Ce mur est encore tiède. Quelqu’un vient de le toucher, de l’autre côté.",
        "Tu entends la respiration de quelqu’un qui se rapproche par le couloir de droite.",
        "Le sol est plus collant à cet endroit. Ne regarde pas tes semelles.",
        "Une voix t’appelle par ton surnom d’enfance. Tu ne l’as dit à personne.",
        "Le mur vient de frapper trois fois. Tu n’as touché personne.",
        "Tu n’es pas le premier à être resté coincé ici. Tu es le premier à être encore là.",
        "Tu as laissé quelque chose derrière toi. Il est maintenant devant toi.",

        // Fin de niveau ou de répétition
        "Tu tournes en rond, comme les autres. Ça ne leur a pas réussi non plus.",
        "Tu es revenu au même mur. Tu sais ce que ça veut dire ?",
        "Tu crois avancer. Le sol te ramène chaque fois au même point.",
        "Tu finiras par comprendre. Ou tu finiras comme ceux qui ont compris trop tard.",
        "Les autres ont trouvé la sortie en fermant les yeux. Essaie.",
        "Chaque mur porte le nom d’un visiteur. Le tien n’est pas encore écrit.",
        "Une lampe s’est éteinte derrière toi. Tu ne l’as pas entendu tomber.",
        "Tu n’es plus seul dans ce couloir, et tu le sais depuis le début.",
        "Il reste une sortie. Elle est juste en face de toi, et tu ne la vois pas.",
        "Tu vas réussir. Oui. Tu vas réussir, et ça te fera encore plus peur."
    ];

    const DIRECTIONS = {
        up:    { dr: 1, dc: 0 },   // inversé : haut = descendre
        down:  { dr: -1, dc: 0 },  // inversé : bas = monter
        left:  { dr: 0, dc: 1 },   // inversé : gauche = aller à droite
        right: { dr: 0, dc: -1 }   // inversé : droite = aller à gauche
    };

    const KEYBOARD = {
        ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
        w: 'up', s: 'down', a: 'left', d: 'right',
        W: 'up', S: 'down', A: 'left', D: 'right'
    };

    function wait(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    class LabyrintheBalises {
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
                counter: document.getElementById('counter'),
                maze: document.getElementById('maze'),
                wallMsg: document.getElementById('wallMsg'),
                dpad: document.getElementById('dpad'),
                btnFlash: document.getElementById('btnFlash'),
                result: document.getElementById('result'),
                resultLabel: document.getElementById('resultLabel'),
                resultMessage: document.getElementById('resultMessage'),
                key: document.getElementById('key'),
                btnContinue: document.getElementById('btnContinue')
            };

            this.stageIndex = 0;
            this.stage = null;
            this.map = [];
            this.rows = 0;
            this.cols = 0;
            this.beaconOrder = [];
            this.cells = [];          // éléments DOM, par index [r][c]
            this.beacons = {};        // n -> { r, c, el }
            this.start = null;
            this.exit = null;

            this.player = { r: 0, c: 0 };
            this.nextBeacon = 1;
            this.collected = [];      // lettres trouvées, dans l'ordre
            this.busy = false;        // vrai pendant les flashs
            this.solved = false;

            this.prepareStage();
            this.bindGate();
            this.bindControls();
            this.el.btnContinue.addEventListener('click', () => {
                if (!this.solved || typeof this.config.onLevelComplete !== 'function') return;
                this.el.btnContinue.disabled = true;
                if (this.stageIndex < MAZE_STAGES.length - 1) {
                    this.stageIndex++;
                    this.prepareStage();
                    this.el.status.textContent = `Nouveau parcours : ${this.beaconOrder.length} balises.`;
                    this.flashSequence();
                    return;
                }
                this.config.onLevelComplete({
                    level: 4,
                    status: 'completed',
                    timeElapsed: Math.round((Date.now() - this.startTime) / 1000)
                });
            });
            this.updateCounter();
        }

        /* ================= CONSTRUCTION ================= */

        prepareStage() {
            this.stage = MAZE_STAGES[this.stageIndex];
            this.map = this.stage.map || generateMaze(this.stage);
            this.rows = this.map.length;
            this.cols = this.map[0].length;
            this.beaconOrder = Array.from({ length: this.stage.beaconCount }, (_, index) => index + 1);
            this.cells = [];
            this.beacons = {};
            this.start = null;
            this.exit = null;
            this.player = { r: 0, c: 0 };
            this.nextBeacon = 1;
            this.collected = [];
            this.busy = false;
            this.solved = false;
            this.el.result.hidden = true;
            this.el.resultLabel.textContent = `MOT DU PARCOURS ${this.stageIndex + 1}`;
            this.el.key.textContent = this.stage.letters;
            this.el.btnContinue.disabled = false;
            this.el.dpad.hidden = false;
            this.el.btnFlash.hidden = false;
            this.el.maze.style.gridTemplateColumns = `repeat(${this.cols}, minmax(0, 1fr))`;
            this.el.maze.style.aspectRatio = `${this.cols} / ${this.rows}`;
            this.el.maze.setAttribute('aria-label', `Labyrinthe ${this.stageIndex + 1} sur ${MAZE_STAGES.length}`);
            this.buildMaze();
            this.updateCounter();
        }

        buildMaze() {
            this.el.maze.innerHTML = '';
            this.cells = [];

            for (let r = 0; r < this.rows; r++) {
                const rowCells = [];
                for (let c = 0; c < this.cols; c++) {
                    const ch = this.map[r][c];
                    const div = document.createElement('div');
                    div.className = 'cell';

                    if (ch === '#') {
                        div.classList.add('wall');
                    } else {
                        div.classList.add('floor');
                    }

                    if (ch === 'S') {
                        this.start = { r, c };
                    } else if (ch === 'E') {
                        div.classList.remove('floor');
                        div.classList.add('exit');
                        this.exit = { r, c };
                    } else if (/[1-9]/.test(ch)) {
                        div.classList.add('beacon');
                        div.dataset.beacon = ch;
                        this.beacons[ch] = { r, c, el: div };
                    }

                    this.el.maze.appendChild(div);
                    rowCells.push(div);
                }
                this.cells.push(rowCells);
            }

            this.player = { r: this.start.r, c: this.start.c };
            this.drawPlayer();
        }

        drawPlayer() {
            this.cells.forEach((row) => row.forEach((cell) => cell.classList.remove('player')));
            this.cells[this.player.r][this.player.c].classList.add('player');
        }

        /* ================= PORTE 18+ ================= */

        bindGate() {
            this.el.btnEnter.addEventListener('click', () => {
                this.el.gate.hidden = true;
                this.el.game.hidden = false;
                this.el.missionBox.hidden = false;
                this.flashSequence();
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
            this.el.dpad.querySelectorAll('[data-dir]').forEach((btn) => {
                btn.addEventListener('click', () => this.move(btn.dataset.dir));
            });

            document.addEventListener('keydown', (e) => {
                if (this.el.game.hidden || this.solved) return;
                const dir = KEYBOARD[e.key];
                if (dir) {
                    e.preventDefault();
                    this.move(dir);
                }
            });

            this.el.btnFlash.addEventListener('click', () => {
                if (!this.busy && !this.solved) this.flashSequence();
            });
        }

        /* ================= BALISES ================= */

        setBeaconState(n, state) {
            const b = this.beacons[n];
            b.el.classList.remove('is-lit', 'is-done');
            if (state) b.el.classList.add(state);
        }

        /** Les balises clignotent dans l'ordre, deux fois. */
        async flashSequence() {
            this.busy = true;
            this.el.status.textContent = 'Mémorise l\'ordre des balises…';
            this.el.status.className = 'status';

            for (let round = 0; round < 2; round++) {
                for (const n of this.beaconOrder) {
                    if (this.collected.length === 0) {
                        this.setBeaconState(n, 'is-lit');
                    }
                    await wait(650);
                    this.setBeaconState(n, this.isCollected(n) ? 'is-done' : null);
                    await wait(250);
                }
            }

            this.busy = false;
            this.el.status.textContent = 'Touche les balises dans cet ordre.';
            this.redrawBeacons();
        }

        isCollected(n) {
            return this.beaconOrder.indexOf(n) < this.nextBeacon - 1;
        }

        redrawBeacons() {
            this.beaconOrder.forEach((n) => {
                this.setBeaconState(n, this.isCollected(n) ? 'is-done' : null);
            });
        }

        updateCounter() {
            const shown = this.beaconOrder.map((n, i) => (i < this.collected.length ? this.collected[i] : '_')).join(' ');
            this.el.counter.textContent = 'Lettres trouvées : ' + shown;
        }

        /* ================= DÉPLACEMENT ================= */

        move(direction) {
            if (this.busy || this.solved) return;
            const delta = DIRECTIONS[direction];
            if (!delta) return;

            const nr = this.player.r + delta.dr;
            const nc = this.player.c + delta.dc;

            // Mur : message, pas de déplacement
            if (this.map[nr][nc] === '#') {
                this.bumpWall();
                return;
            }

            this.player = { r: nr, c: nc };
            this.drawPlayer();
            this.onEnterCell(this.map[nr][nc]);
        }

        bumpWall() {
            const phrase = WALL_PHRASES[Math.floor(Math.random() * WALL_PHRASES.length)];
            this.el.wallMsg.textContent = '« ' + phrase + ' »';
        }

        onEnterCell(ch) {
            if (/[1-9]/.test(ch)) {
                this.touchBeacon(Number(ch));
                return;
            }

            if (ch === 'E') {
                this.tryExit();
            }
        }

        touchBeacon(n) {
            // Déjà touchée : rien ne se passe
            if (this.isCollected(n)) return;

            if (n === this.nextBeacon) {
                window.playAnswerSound('correct');
                this.nextBeacon++;
                this.collected.push(this.stage.letters[n - 1]);
                this.setBeaconState(n, 'is-done');
                this.updateCounter();
                this.el.status.textContent = 'Balise ' + n + ' touchée.';
                this.el.status.className = 'status is-success';
                return;
            }

            // Mauvais ordre : tout se rallume depuis le début
            window.playAnswerSound('wrong');
            this.nextBeacon = 1;
            this.collected = [];
            this.redrawBeacons();
            this.updateCounter();
            this.el.status.textContent = 'Ce n\'est pas l\'ordre des balises. Tout recommence.';
            this.el.status.className = 'status is-error';
        }

        tryExit() {
            if (this.nextBeacon <= this.beaconOrder.length) {
                window.playAnswerSound('wrong');
                this.el.status.textContent = 'La sortie reste fermée. Il manque une balise.';
                this.el.status.className = 'status is-error';
                return;
            }
            this.succeed();
        }

        /* ================= RÉUSSITE ================= */

        succeed() {
            window.playAnswerSound('correct');
            this.solved = true;
            this.el.status.textContent = '✓ La sortie s\'ouvre.';
            this.el.status.className = 'status is-success';
            this.el.wallMsg.textContent = '';
            this.el.dpad.hidden = true;
            this.el.btnFlash.hidden = true;
            this.el.resultLabel.textContent = `MOT DU PARCOURS ${this.stageIndex + 1}`;
            this.el.key.textContent = this.stage.letters;
            this.el.resultMessage.textContent = this.stageIndex === MAZE_STAGES.length - 1
                ? 'Souviens-toi du mot : l’accès à l’interlude est déverrouillé.'
                : `Souviens-toi de ce mot. Le parcours ${this.stageIndex + 2} contient ${MAZE_STAGES[this.stageIndex + 1].beaconCount} balises.`;
            this.el.btnContinue.textContent = this.stageIndex === MAZE_STAGES.length - 1
                ? 'Passer à l’interlude'
                : `Continuer vers le parcours ${this.stageIndex + 2}`;
            this.el.result.hidden = false;
        }
    }

    function start() {
        window.labyrintheBalises = new LabyrintheBalises(window.baraqueConfig || {});
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
