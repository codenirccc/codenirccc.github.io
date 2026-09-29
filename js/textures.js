import { mulberry32 } from './noise.js';

export const TILE = 16;

const order = [];
const data = {};
const canvases = {};

function hex(h) {
    return [(h >> 16) & 255, (h >> 8) & 255, h & 255];
}

function shade(c, f) {
    return [
        Math.max(0, Math.min(255, Math.round(c[0] * f))),
        Math.max(0, Math.min(255, Math.round(c[1] * f))),
        Math.max(0, Math.min(255, Math.round(c[2] * f))),
    ];
}

function jitter(c, rnd, amt) {
    const d = (rnd() - 0.5) * amt;
    return shade(c, 1 + d / 255);
}

function makeCanvas(t) {
    const cv = document.createElement('canvas');
    cv.width = TILE;
    cv.height = TILE;
    const cx = cv.getContext('2d');
    const img = cx.createImageData(TILE, TILE);
    img.data.set(data[t]);
    cx.putImageData(img, 0, 0);
    return cv;
}

function reg(name, seed, fn) {
    const rnd = mulberry32(seed);
    const d = new Uint8ClampedArray(TILE * TILE * 4);
    const api = {
        rnd,
        set(x, y, c, a = 255) {
            if (x < 0 || y < 0 || x >= TILE || y >= TILE) return;
            const i = (y * TILE + x) * 4;
            d[i] = c[0];
            d[i + 1] = c[1];
            d[i + 2] = c[2];
            d[i + 3] = a;
        },
        get(x, y) {
            const i = (((y + TILE) % TILE) * TILE + ((x + TILE) % TILE)) * 4;
            return [d[i], d[i + 1], d[i + 2], d[i + 3]];
        },
        mul(x, y, f, a) {
            if (x < 0 || y < 0 || x >= TILE || y >= TILE) return;
            const i = (y * TILE + x) * 4;
            d[i] = Math.min(255, Math.round(d[i] * f));
            d[i + 1] = Math.min(255, Math.round(d[i + 1] * f));
            d[i + 2] = Math.min(255, Math.round(d[i + 2] * f));
            if (a !== undefined) d[i + 3] = a;
        },
        fill(c, a = 255) {
            for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) api.set(x, y, c, a);
        },
    };
    fn(api, hex);
    data[name] = d;
    canvases[name] = makeCanvas(name);
    order.push(name);
    return d;
}

function speckle(t, base, rnd, amt, density = 1) {
    for (let y = 0; y < TILE; y++) {
        for (let x = 0; x < TILE; x++) {
            if (rnd() > density) continue;
            t.set(x, y, jitter(base, rnd, amt));
        }
    }
}

function blobs(t, rnd, count, radius, color, edge) {
    for (let i = 0; i < count; i++) {
        const cx = Math.floor(rnd() * TILE);
        const cy = Math.floor(rnd() * TILE);
        const r = radius[0] + rnd() * (radius[1] - radius[0]);
        for (let y = Math.floor(cy - r); y <= cy + r; y++) {
            for (let x = Math.floor(cx - r); x <= cx + r; x++) {
                const d = Math.hypot(x - cx, y - cy);
                if (d > r) continue;
                if (edge && d > r - 1 && rnd() < 0.55) continue;
                const c = jitter(color, rnd, 26);
                t.set((x + TILE) % TILE, (y + TILE) % TILE, c);
            }
        }
    }
}

function planks(t, hex, base, dark, light) {
    for (let y = 0; y < TILE; y++) {
        const board = Math.floor(y / 4);
        const shadeF = [1, 0.94, 1.04, 0.97][board % 4];
        for (let x = 0; x < TILE; x++) {
            let c = jitter(base, t.rnd, 20);
            c = shade(c, shadeF);
            if (y % 4 === 3) c = shade(dark, 1);
            if (x === 0 || x === 15 || ((x + board * 5) % 16 === 0 && y % 4 !== 3)) c = shade(dark, 0.94);
            if (t.rnd() < 0.1) c = shade(c, 1.06);
            t.set(x, y, c);
        }
    }
    for (let i = 0; i < 3; i++) {
        const gy = Math.floor(t.rnd() * TILE);
        const gx = Math.floor(t.rnd() * TILE);
        const len = 3 + Math.floor(t.rnd() * 6);
        for (let k = 0; k < len; k++) t.mul((gx + k) % TILE, gy, 0.9);
    }
    void light;
}

function logSide(t, hex, bark, barkDark, barkLight, marks) {
    for (let x = 0; x < TILE; x++) {
        const stripe = Math.sin(x * 1.7) * 0.5 + 0.5;
        for (let y = 0; y < TILE; y++) {
            let c = shade(bark, 0.9 + stripe * 0.2);
            if (x % 5 === 0) c = shade(barkDark, 0.95 + stripe * 0.1);
            if (x % 7 === 3) c = shade(barkLight, 1);
            if (t.rnd() < 0.14) c = shade(c, 0.88 + t.rnd() * 0.2);
            t.set(x, y, c);
        }
    }
    if (marks === 'birch') {
        for (let i = 0; i < 5; i++) {
            const y = Math.floor(t.rnd() * TILE);
            const x = Math.floor(t.rnd() * TILE);
            const w = 2 + Math.floor(t.rnd() * 4);
            for (let k = 0; k < w; k++) {
                t.set((x + k) % TILE, y, hex(0x2b2b28));
                t.set((x + k) % TILE, (y + 1) % TILE, hex(0x3a3a36));
            }
        }
    } else if (marks === 'spruce') {
        for (let i = 0; i < 8; i++) {
            const x = Math.floor(t.rnd() * TILE);
            const y0 = Math.floor(t.rnd() * TILE);
            const len = 4 + Math.floor(t.rnd() * 8);
            for (let k = 0; k < len; k++) t.set(x, (y0 + k) % TILE, shade(barkDark, 0.85));
        }
    }
}

function logTop(t, hex, ring, core) {
    const mid = 7.5;
    for (let y = 0; y < TILE; y++) {
        for (let x = 0; x < TILE; x++) {
            const d = Math.hypot(x - mid, y - mid);
            const band = Math.sin(d * 2.1) * 0.5 + 0.5;
            let c = shade(ring, 0.88 + band * 0.22);
            if (d < 1.2) c = core;
            if (d > 7.1) c = shade(hex(0x3a2a18), 1);
            t.set(x, y, jitter(c, t.rnd, 16));
        }
    }
}

function leaves(t, hex, dark, light, holes) {
    for (let y = 0; y < TILE; y++) {
        for (let x = 0; x < TILE; x++) {
            const r = t.rnd();
            let c = r < 0.25 ? dark : r < 0.75 ? light : shade(light, 1.12);
            c = jitter(c, t.rnd, 30);
            const hole = t.rnd() < holes;
            t.set(x, y, c, hole ? 0 : 255);
        }
    }
    for (let i = 0; i < 6; i++) {
        const x = Math.floor(t.rnd() * TILE);
        const y = Math.floor(t.rnd() * TILE);
        t.mul(x, y, 0.82, 255);
    }
    void hex;
}

function cobble(t, hex, stone, mortar) {
    t.fill(mortar);
    const cells = [
        [0, 0, 5], [6, 0, 4], [11, 0, 5],
        [0, 5, 4], [5, 6, 5], [11, 5, 5],
        [0, 10, 5], [6, 11, 4], [11, 11, 5],
    ];
    for (const [ox, oy, size] of cells) {
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const edge = x === 0 || y === 0 || x === size - 1 || y === size - 1;
                let c = jitter(stone, t.rnd, 34);
                if (edge && t.rnd() < 0.6) c = shade(c, 0.82);
                if (!edge && y === 1 && x > 0) c = shade(c, 1.1);
                t.set((ox + x) % TILE, (oy + y) % TILE, c);
            }
        }
    }
    void hex;
}

function brickPattern(t, hex, brick, mortar) {
    for (let y = 0; y < TILE; y++) {
        const row = Math.floor(y / 4);
        const off = row % 2 === 0 ? 0 : 4;
        for (let x = 0; x < TILE; x++) {
            const sx = (x + off) % 8;
            const isMortar = y % 4 === 3 || sx === 7;
            t.set(x, y, isMortar ? jitter(mortar, t.rnd, 14) : jitter(brick, t.rnd, 26));
        }
    }
    void hex;
}

function stoneBricks(t, hex, stone, mortar) {
    for (let y = 0; y < TILE; y++) {
        const row = Math.floor(y / 8);
        const off = row % 2 === 0 ? 0 : 4;
        for (let x = 0; x < TILE; x++) {
            const sx = (x + off) % 8;
            const isMortar = y % 8 === 7 || sx === 7;
            let c = isMortar ? jitter(mortar, t.rnd, 12) : jitter(stone, t.rnd, 22);
            if (!isMortar && y % 8 === 0) c = shade(c, 1.08);
            t.set(x, y, c);
        }
    }
    void hex;
}

function banded(t, colors, seedShift) {
    const rnd = mulberry32(9001 + seedShift);
    for (let y = 0; y < TILE; y++) {
        const band = Math.floor(y / 4) % colors.length;
        for (let x = 0; x < TILE; x++) {
            t.set(x, y, jitter(colors[band], rnd, 16));
        }
    }
}

function grassSide(t, hex, dirtCol, grassCol) {
    for (let y = 0; y < TILE; y++) {
        for (let x = 0; x < TILE; x++) {
            const d = jitter(dirtCol, t.rnd, 30);
            if (t.rnd() < 0.16) t.set(x, y, shade(d, 0.86));
            t.set(x, y, d);
        }
    }
    for (let x = 0; x < TILE; x++) {
        const depth = 3 + Math.floor(t.rnd() * 2);
        for (let k = 0; k < depth; k++) {
            const edge = k === depth - 1 && t.rnd() < 0.5;
            if (edge) continue;
            t.set(x, TILE - 1 - k, jitter(grassCol, t.rnd, 34));
        }
    }
    void hex;
}

export function buildAtlas() {
    reg('stone', 11, (t, hex) => {
        const base = hex(0x7d7d7d);
        speckle(t, base, t.rnd, 30, 1);
        for (let i = 0; i < 4; i++) blobs(t, t.rnd, 1, [1.5, 3], shade(base, 0.88), false);
        for (let i = 0; i < 5; i++) blobs(t, t.rnd, 1, [1, 2], shade(base, 1.12), false);
    });

    reg('cobblestone', 12, (t, hex) => cobble(t, hex, hex(0x8a8a8a), hex(0x5d5d5d)));

    reg('mossy_cobblestone', 13, (t, hex) => {
        cobble(t, hex, hex(0x84897e), hex(0x565b50));
        for (let y = 0; y < TILE; y++) {
            for (let x = 0; x < TILE; x++) {
                if (t.rnd() < 0.3) t.set(x, y, jitter(hex(0x5a7a3a), t.rnd, 40));
            }
        }
    });

    reg('stone_bricks', 14, (t, hex) => stoneBricks(t, hex, hex(0x7a7a7a), hex(0x606060)));
    reg('cracked_stone_bricks', 15, (t, hex) => {
        stoneBricks(t, hex, hex(0x767676), hex(0x5c5c5c));
        for (let i = 0; i < 4; i++) {
            let x = Math.floor(t.rnd() * TILE);
            let y = Math.floor(t.rnd() * TILE);
            for (let k = 0; k < 6; k++) {
                t.mul(x, y, 0.78);
                x = (x + (t.rnd() < 0.5 ? 1 : -1) + TILE) % TILE;
                y = (y + (t.rnd() < 0.5 ? 1 : 0) + TILE) % TILE;
            }
        }
    });
    reg('bricks', 16, (t, hex) => brickPattern(t, hex, hex(0x9c5a48), hex(0xb0aca4)));
    reg('andesite', 17, (t, hex) => {
        speckle(t, hex(0x8a8a8c), t.rnd, 22, 1);
        blobs(t, t.rnd, 6, [1, 2.4], hex(0x75757a), false);
    });
    reg('deepslate', 18, (t, hex) => {
        speckle(t, hex(0x4b4b50), t.rnd, 20, 1);
        for (let x = 0; x < TILE; x++) {
            if (x % 6 === 2) for (let y = 0; y < TILE; y++) t.mul(x, y, 0.86);
        }
    });
    reg('gravel', 19, (t, hex) => {
        speckle(t, hex(0x847f7c), t.rnd, 40, 1);
        blobs(t, t.rnd, 10, [1, 2.2], hex(0x5f5b58), true);
        blobs(t, t.rnd, 6, [0.8, 1.6], hex(0xa8a29d), true);
    });
    reg('sand', 20, (t, hex) => speckle(t, hex(0xdbd0a0), t.rnd, 22, 1));
    reg('sandstone', 21, (t, hex) => {
        banded(t, [hex(0xd8cb9b), hex(0xd3c58f), hex(0xdfd3a6)], 3);
    });
    reg('dirt', 22, (t, hex) => {
        speckle(t, hex(0x87603f), t.rnd, 30, 1);
        for (let i = 0; i < 8; i++) blobs(t, t.rnd, 1, [0.8, 1.6], hex(0x6d4c31), false);
    });
    reg('grass_top', 23, (t, hex) => {
        speckle(t, hex(0x79c05a), t.rnd, 28, 1);
        for (let i = 0; i < 10; i++) blobs(t, t.rnd, 1, [0.7, 1.7], hex(0x69a94c), false);
    });
    reg('grass_side', 24, (t, hex) => grassSide(t, hex, hex(0x87603f), hex(0x79c05a)));
    reg('bedrock', 25, (t, hex) => {
        speckle(t, hex(0x545454), t.rnd, 46, 1);
        blobs(t, t.rnd, 8, [1, 2.6], hex(0x2e2e2e), true);
        blobs(t, t.rnd, 4, [0.8, 1.4], hex(0x7a7a7a), true);
    });
    reg('water', 26, (t, hex) => {
        for (let y = 0; y < TILE; y++) {
            for (let x = 0; x < TILE; x++) {
                const w = Math.sin((x + y * 0.5) * 0.8) * 0.5 + 0.5;
                const c = shade(hex(0x2f6fd0), 0.9 + w * 0.22);
                t.set(x, y, c, 190);
            }
        }
    });
    reg('glass', 27, (t) => {
        t.fill([255, 255, 255], 0);
        for (let i = 0; i < TILE; i++) {
            t.set(i, 0, [214, 238, 255], 190);
            t.set(0, i, [214, 238, 255], 190);
            t.set(i, TILE - 1, [190, 220, 245], 170);
            t.set(TILE - 1, i, [190, 220, 245], 170);
        }
        for (let k = 0; k < 5; k++) t.set(3 + k, 11 - k, [255, 255, 255], 150);
        for (let k = 0; k < 3; k++) t.set(9 + k, 7 - k, [255, 255, 255], 110);
    });

    reg('oak_log_side', 31, (t, hex) => logSide(t, hex, hex(0x6f5230), hex(0x54401f), hex(0x87663c), 'oak'));
    reg('oak_log_top', 32, (t, hex) => logTop(t, hex, hex(0xb08a55), hex(0x8a6a3f)));
    reg('oak_planks', 33, (t, hex) => planks(t, hex, hex(0xb08a55), hex(0x8a6a3f), hex(0xc99c5f)));
    reg('oak_leaves', 34, (t, hex) => leaves(t, hex, hex(0x2f6a24), hex(0x4a8f31), 0.12));

    reg('birch_log_side', 35, (t, hex) => logSide(t, hex, hex(0xd6cfc0), hex(0xa8a294), hex(0xf0ece0), 'birch'));
    reg('birch_log_top', 36, (t, hex) => logTop(t, hex, hex(0xd3c39a), hex(0xb5a37a)));
    reg('birch_planks', 37, (t, hex) => planks(t, hex, hex(0xd3c08d), hex(0xab9870), hex(0xe2d2a6)));
    reg('birch_leaves', 38, (t, hex) => leaves(t, hex, hex(0x4d7a2a), hex(0x6ba03a), 0.14));

    reg('spruce_log_side', 39, (t, hex) => logSide(t, hex, hex(0x4a3520), hex(0x33240f), hex(0x5f452a), 'spruce'));
    reg('spruce_log_top', 40, (t, hex) => logTop(t, hex, hex(0x7a5a34), hex(0x5c4224)));
    reg('spruce_planks', 41, (t, hex) => planks(t, hex, hex(0x7a5a34), hex(0x5b4123), hex(0x8d6a3d)));
    reg('spruce_leaves', 42, (t, hex) => leaves(t, hex, hex(0x1f4a2a), hex(0x2f6b38), 0.16));

    reg('glowstone', 43, (t, hex) => {
        speckle(t, hex(0x9c7a3c), t.rnd, 30, 1);
        for (let i = 0; i < 14; i++) blobs(t, t.rnd, 1, [0.8, 1.8], hex(0xf6e6a8), false);
    });

    reg('lantern_top', 44, (t, hex) => speckle(t, hex(0x6f6a5c), t.rnd, 26, 1));

    return { names: order.slice(), data, canvases };
}

export function textureCanvas(name) {
    return canvases[name];
}

export function texIndex(name) {
    return order.indexOf(name);
}
