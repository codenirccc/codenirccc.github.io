export function mulberry32(a) {
    a = a | 0;
    return function () {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function hash3(x, y, z, seed) {
    let h = seed | 0;
    h = Math.imul(h ^ (x | 0), 0x27d4eb2d);
    h = Math.imul(h ^ (y | 0), 0x165667b1);
    h = Math.imul(h ^ (z | 0), 0x9e3779b1);
    h ^= h >>> 15;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h ^ (h >>> 16), 0xc2b2ae35);
    h ^= h >>> 16;
    return h | 0;
}

function rand2(x, y, seed) {
    return (hash3(x, y, 0, seed) >>> 8) / 16777216;
}

function rand3(x, y, z, seed) {
    return (hash3(x, y, z, seed) >>> 8) / 16777216;
}

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;

function grad2(hx, x, y) {
    switch (hx & 7) {
        case 0: return x + y;
        case 1: return x - y;
        case 2: return -x + y;
        case 3: return -x - y;
        case 4: return x;
        case 5: return -x;
        case 6: return y;
        default: return -y;
    }
}

function grad3(hx, x, y, z) {
    const u = hx < 8 ? x : y;
    const v = hx < 4 ? y : hx === 12 || hx === 14 ? x : z;
    return ((hx & 1) === 0 ? u : -u) + ((hx & 2) === 0 ? v : -v);
}

export class Noise {
    constructor(seed = 1337) {
        this.seed = seed | 0;
    }

    n2(x, y) {
        const xi = Math.floor(x), yi = Math.floor(y);
        const xf = x - xi, yf = y - yi;
        const u = fade(xf), v = fade(yf);
        const s = this.seed;
        const g00 = hash3(xi, yi, 0, s) & 7;
        const g10 = hash3(xi + 1, yi, 0, s) & 7;
        const g01 = hash3(xi, yi + 1, 0, s) & 7;
        const g11 = hash3(xi + 1, yi + 1, 0, s) & 7;
        const aa = grad2(g00, xf, yf);
        const ba = grad2(g10, xf - 1, yf);
        const ab = grad2(g01, xf, yf - 1);
        const bb = grad2(g11, xf - 1, yf - 1);
        return lerp(lerp(aa, ba, u), lerp(ab, bb, u), v);
    }

    n3(x, y, z) {
        const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
        const xf = x - xi, yf = y - yi, zf = z - zi;
        const u = fade(xf), v = fade(yf), w = fade(zf);
        const s = this.seed;
        const c000 = grad3(hash3(xi, yi, zi, s) & 15, xf, yf, zf);
        const c100 = grad3(hash3(xi + 1, yi, zi, s) & 15, xf - 1, yf, zf);
        const c010 = grad3(hash3(xi, yi + 1, zi, s) & 15, xf, yf - 1, zf);
        const c110 = grad3(hash3(xi + 1, yi + 1, zi, s) & 15, xf - 1, yf - 1, zf);
        const c001 = grad3(hash3(xi, yi, zi + 1, s) & 15, xf, yf, zf - 1);
        const c101 = grad3(hash3(xi + 1, yi, zi + 1, s) & 15, xf - 1, yf, zf - 1);
        const c011 = grad3(hash3(xi, yi + 1, zi + 1, s) & 15, xf, yf - 1, zf - 1);
        const c111 = grad3(hash3(xi + 1, yi + 1, zi + 1, s) & 15, xf - 1, yf - 1, zf - 1);
        const x00 = lerp(c000, c100, u);
        const x10 = lerp(c010, c110, u);
        const x01 = lerp(c001, c101, u);
        const x11 = lerp(c011, c111, u);
        return lerp(lerp(x00, x10, v), lerp(x01, x11, v), w);
    }

    fbm2(x, y, oct = 4, lac = 2, gain = 0.5) {
        let f = 1, a = 1, sum = 0, norm = 0;
        for (let i = 0; i < oct; i++) {
            sum += this.n2(x * f, y * f) * a;
            norm += a;
            f *= lac;
            a *= gain;
        }
        return sum / norm;
    }

    fbm3(x, y, z, oct = 3, lac = 2, gain = 0.5) {
        let f = 1, a = 1, sum = 0, norm = 0;
        for (let i = 0; i < oct; i++) {
            sum += this.n3(x * f, y * f, z * f) * a;
            norm += a;
            f *= lac;
            a *= gain;
        }
        return sum / norm;
    }

    ridge2(x, y, oct = 4) {
        let f = 1, a = 1, sum = 0, norm = 0;
        for (let i = 0; i < oct; i++) {
            const n = 1 - Math.abs(this.n2(x * f, y * f));
            sum += n * n * a;
            norm += a;
            f *= 2;
            a *= 0.5;
        }
        return sum / norm;
    }
}

export function hash2i(x, z, seed) {
    return rand2(x, z, seed);
}
