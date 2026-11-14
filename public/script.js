  // scatter a small starfield
const starsEl = document.getElementById('stars');
const STAR_COUNT = 60;
for (let i = 0; i < STAR_COUNT; i++) {
    const s = document.createElement('div');
    s.className = 'star';
    s.style.left = Math.random() * 100 + 'vw';
    s.style.top = Math.random() * 100 + 'vh';
    s.style.animationDelay = (Math.random() * 3.5) + 's';
    s.style.opacity = (0.2 + Math.random() * 0.5).toFixed(2);
    const size = Math.random() < 0.15 ? 3 : 2;
    s.style.width = size + 'px';
    s.style.height = size + 'px';
    starsEl.appendChild(s);
}