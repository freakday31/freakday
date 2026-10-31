(() => {
    const scriptUrl = document.currentScript.src;
    const typingSound = new Audio(new URL('media/typing.mp3', scriptUrl));
    const correctSound = new Audio(new URL('media/ting.mp3', scriptUrl));
    const wrongSound = new Audio(new URL('media/wrong.mp3', scriptUrl));
    const textTargets = [
        'input:not([type])',
        'input[type="text"]',
        'input[type="search"]',
        'input[type="email"]',
        'input[type="url"]',
        'input[type="tel"]',
        'input[type="password"]',
        'input[type="number"]',
        'textarea',
        '[contenteditable]:not([contenteditable="false"])'
    ].join(', ');

    typingSound.preload = 'auto';
    correctSound.preload = 'auto';
    wrongSound.preload = 'auto';

    window.playAnswerSound = (result) => {
        const sound = result === 'correct' ? correctSound : result === 'wrong' ? wrongSound : null;
        if (!sound) return;

        sound.currentTime = 0;
        sound.play().catch(() => {});
    };

    if (window.parent !== window) {
        const reportFrameHeight = () => {
            const height = Math.ceil(Math.max(
                document.documentElement.scrollHeight,
                document.body?.scrollHeight || 0
            ));
            window.parent.postMessage({ type: 'freak-day-frame-resize', height }, '*');
        };

        const observeFrameContent = () => {
            document.body.style.minHeight = '0';
            const resizeObserver = new ResizeObserver(reportFrameHeight);
            resizeObserver.observe(document.documentElement);
            resizeObserver.observe(document.body);

            const mutationObserver = new MutationObserver(reportFrameHeight);
            mutationObserver.observe(document.body, {
                attributes: true,
                childList: true,
                characterData: true,
                subtree: true
            });

            window.addEventListener('load', reportFrameHeight);
            document.addEventListener('load', reportFrameHeight, true);
            reportFrameHeight();
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', observeFrameContent, { once: true });
        } else {
            observeFrameContent();
        }
    }

    document.addEventListener('keydown', (event) => {
        if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
        if (event.key.length !== 1 && event.key !== 'Backspace') return;

        const target = event.target;
        if (!(target instanceof Element) || !target.closest(textTargets)) return;

        typingSound.currentTime = 0;
        typingSound.play().catch(() => {});
    }, true);
})();
