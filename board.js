// Calibration dot board: a circle grid seen from a camera whose pose follows the pointer.
(function () {
    const canvas = document.getElementById('board');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const COLS = 9, ROWS = 9;
    const rest = { rx: 0.55, ry: -0.38 };     // resting camera pose (radians)
    let target = { ...rest }, pose = { ...rest };
    let size = 0, raf = 0;

    function colors() {
        const s = getComputedStyle(document.documentElement);
        return { dot: s.getPropertyValue('--dot').trim(), signal: s.getPropertyValue('--signal').trim(), rule: s.getPropertyValue('--rule').trim() };
    }
    let col = colors();

    function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        size = canvas.clientWidth;
        canvas.width = size * dpr; canvas.height = size * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        draw();
    }

    // board point (x,y in -1..1) -> screen
    function project(x, y, p) {
        const cx = Math.cos(p.rx), sx = Math.sin(p.rx), cy = Math.cos(p.ry), sy = Math.sin(p.ry);
        // rotate around X then Y
        let X = x, Y = y * cx, Z = y * sx;
        const X2 = X * cy + Z * sy, Z2 = -X * sy + Z * cy;
        const f = 3.2, d = f / (f + Z2);
        const k = size * 0.43;
        return { x: size / 2 + X2 * d * k, y: size / 2 + Y * d * k, s: d };
    }

    function draw() {
        if (!size) return;
        ctx.clearRect(0, 0, size, size);
        const p = pose;
        const step = 2 / (COLS - 1) * 0.86;
        const r0 = size * 0.018;

        // board outline
        const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => project(x, y, p));
        ctx.beginPath();
        corners.forEach((c, i) => i ? ctx.lineTo(c.x, c.y) : ctx.moveTo(c.x, c.y));
        ctx.closePath();
        ctx.strokeStyle = col.rule; ctx.lineWidth = 1.5; ctx.stroke();

        // dots; skewed by finite differences to look like true ellipses
        for (let j = 0; j < ROWS; j++) {
            for (let i = 0; i < COLS; i++) {
                const x = -0.86 + i * step, y = -0.86 + j * step;
                const c = project(x, y, p);
                const e = 0.01;
                const ux = project(x + e, y, p), uy = project(x, y + e, p);
                const ax = (ux.x - c.x) / e, ay = (ux.y - c.y) / e, bx = (uy.x - c.x) / e, by = (uy.y - c.y) / e;
                const sc = r0 / (size * 0.43);
                ctx.save();
                ctx.setTransform(ctx.getTransform().multiply(new DOMMatrix([ax * sc, ay * sc, bx * sc, by * sc, c.x, c.y])));
                ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2);
                // three marker dots fix the board's orientation, as on a real target
                const marker = (i === 0 && j === 0) || (i === 1 && j === 0) || (i === 0 && j === 1);
                ctx.fillStyle = marker ? col.signal : col.dot;
                ctx.fill();
                ctx.restore();
            }
        }

        // detected-corner brackets
        ctx.strokeStyle = col.signal; ctx.lineWidth = 2;
        corners.forEach((c, i) => {
            const n = corners[(i + 1) % 4], pr = corners[(i + 3) % 4], L = 0.12;
            ctx.beginPath();
            ctx.moveTo(c.x + (pr.x - c.x) * L, c.y + (pr.y - c.y) * L);
            ctx.lineTo(c.x, c.y);
            ctx.lineTo(c.x + (n.x - c.x) * L, c.y + (n.y - c.y) * L);
            ctx.stroke();
        });
    }

    function tick() {
        pose.rx += (target.rx - pose.rx) * 0.12;
        pose.ry += (target.ry - pose.ry) * 0.12;
        draw();
        if (Math.abs(target.rx - pose.rx) + Math.abs(target.ry - pose.ry) > 0.0005) raf = requestAnimationFrame(tick);
        else raf = 0;
    }
    function aim(rx, ry) {
        target = { rx, ry };
        if (reduce) { pose = { ...target }; draw(); return; }
        if (!raf) raf = requestAnimationFrame(tick);
    }

    const hero = canvas.closest('.hero') || canvas;
    hero.addEventListener('pointermove', e => {
        if (e.pointerType === 'touch') return;
        const r = canvas.getBoundingClientRect();
        const dx = Math.max(-1.5, Math.min(1.5, (e.clientX - (r.left + r.width / 2)) / r.width));
        const dy = Math.max(-1.5, Math.min(1.5, (e.clientY - (r.top + r.height / 2)) / r.height));
        aim(0.25 + dy * 0.6, -dx * 0.9);
    });
    hero.addEventListener('pointerleave', () => aim(rest.rx, rest.ry));
    canvas.addEventListener('pointerdown', e => {
        if (e.pointerType !== 'touch') return;
        const r = canvas.getBoundingClientRect();
        aim(0.25 + ((e.clientY - r.top) / r.height - 0.5) * 1.1, -((e.clientX - r.left) / r.width - 0.5) * 1.6);
    });

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { col = colors(); draw(); });
    new ResizeObserver(resize).observe(canvas);
})();
