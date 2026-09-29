import { Noise, hash2i, mulberry32 } from './noise.js';
import * as B from './blocks.js';

export const CHUNK = 16;
export const WORLD_H = 96;
export const SEA = 34;

const IDX = (x, y, z) => (y * CHUNK + z) * CHUNK + x;

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

const smoothstep = (a, b, x) => {
    const t = clamp01((x - a) / (b - a));
    return t * t * (3 - 2 * t);
};

export class Chunk {
    constructor(cx, cz) {
        this.cx = cx;
        this.cz = cz;
        this.blocks = new Uint8Array(CHUNK * CHUNK * WORLD_H);
        this.light = new Uint8Array(CHUNK * CHUNK * WORLD_H);
        this.height = new Uint8Array(CHUNK * CHUNK);
        this.generated = false;
        this.lit = false;
        this.dirty = true;
        this.mesh = null;
        this.waterMesh = null;
        this.empty = true;
        this.decorated = false;
        this.meshed = false;
        this.pending = false;
    }
}

export class World {
    constructor(seed) {
        this.seed = seed | 0;
        this.nCont = new Noise(seed);
        this.nHill = new Noise(seed + 7717);
        this.nRidge = new Noise(seed + 13331);
        this.nCave = new Noise(seed + 20261);
        this.nTemp = new Noise(seed + 30011);
        this.nHum = new Noise(seed + 41113);
        this.chunks = new Map();
        this.edits = new Map();
        this.dirtyChunks = new Set();
        this.biomes = new Map();
        this.listeners = [];
    }

    key(cx, cz) {
        return cx + ',' + cz;
    }

    getChunk(cx, cz) {
        return this.chunks.get(cx + ',' + cz);
    }

    ensureChunk(cx, cz) {
        const k = cx + ',' + cz;
        let c = this.chunks.get(k);
        if (!c) {
            c = new Chunk(cx, cz);
            this.chunks.set(k, c);
        }
        return c;
    }

    heightAt(wx, wz) {
        return SEA + this.terrainHeight(wx, wz);
    }

    terrainHeight(wx, wz) {
        const warpX = this.nHill.n2(wx * 0.0052 + 31.7, wz * 0.0052 - 12.3) * 34;
        const warpZ = this.nHill.n2(wx * 0.0052 - 77.1, wz * 0.0052 + 55.9) * 34;
        const px = wx + warpX;
        const pz = wz + warpZ;

        const cont = clamp01((this.nCont.fbm2(px * 0.0011, pz * 0.0011, 5) / 0.36 + 1) * 0.5);
        const hills = this.nHill.fbm2(px * 0.0046, pz * 0.0046, 4) / 0.3;
        const rid = this.nRidge.ridge2(px * 0.0028, pz * 0.0028, 4);

        const ocean = smoothstep(0.46, 0.28, cont);
        const coast = smoothstep(0.44, 0.5, cont);
        const land = smoothstep(0.5, 0.62, cont);
        const highland = smoothstep(0.66, 0.8, cont);
        const alpine = smoothstep(0.82, 0.94, cont);

        let h = 0;
        h += ocean * (SEA - 14 - ocean * 8);
        h += coast * (SEA - 3);
        h += land * (6 + land * 8);
        h += highland * (12 + highland * 16);
        h += alpine * (30 + rid * rid * 40);
        h += land * hills * (3 + land * 9);
        h += land * this.nHill.fbm2(px * 0.019, pz * 0.019, 3) * 2.6;

        h = Math.round(h);
        return Math.max(2, Math.min(WORLD_H - 14, h));
    }

    fbmOct(wx, wz, oct, scale) {
        return this.nHill.fbm2(wx * scale, wz * scale, oct) * 0.5 + 0.5;
    }

    biomeAt(wx, wz) {
        const k = (wx >> 3) + ':' + (wz >> 3);
        let b = this.biomes.get(k);
        if (b) return b;
        const t = this.nTemp.fbm2(wx * 0.0008, wz * 0.0008, 3);
        const hum = this.nHum.fbm2(wx * 0.0011 + 40, wz * 0.0011 - 40, 3);
        const h = this.terrainHeight(wx, wz);
        if (h > SEA + 40) b = 'mountains';
        else if (h < SEA - 4) b = 'ocean';
        else if (t < -0.22) b = 'snow';
        else if (t > 0.22 && hum < 0) b = 'desert';
        else if (hum > 0.12) b = 'forest';
        else b = 'plains';
        this.biomes.set(k, b);
        return b;
    }

    caveAt(wx, wy, wz) {
        if (wy < 2) return false;
        const a = this.nCave.fbm3(wx * 0.028, wy * 0.05, wz * 0.028, 3);
        const b = this.nCave.fbm3(wx * 0.011 + 50, wy * 0.022, wz * 0.011 - 50, 2);
        const v = a * 0.75 + b * 0.45;
        return v > 0.42;
    }

    generateChunk(c) {
        const ox = c.cx * CHUNK;
        const oz = c.cz * CHUNK;
        const rnd = mulberry32((c.cx * 341873128 + c.cz * 132897987 + this.seed) | 0);
        const blocks = c.blocks;

        for (let z = 0; z < CHUNK; z++) {
            for (let x = 0; x < CHUNK; x++) {
                const wx = ox + x;
                const wz = oz + z;
                const h = this.terrainHeight(wx, wz);
                const biome = this.biomeAt(wx, wz);
                c.height[z * CHUNK + x] = h;

                for (let y = 0; y <= h; y++) {
                    let id = 0;
                    if (y === 0) id = B.byName('bedrock').id;
                    else if (y < 4 && rnd() < 0.7) id = B.byName('bedrock').id;
                    else if (y === h) {
                        if (h < SEA - 1) id = B.byName(h < SEA - 6 ? 'deepslate' : 'gravel').id;
                        else if (biome === 'desert') id = B.byName('sand').id;
                        else if (biome === 'snow' && h > SEA + 26) id = B.byName('andesite').id;
                        else id = B.byName('grass_block').id;
                    } else if (y > h - 4) {
                        if (h < SEA - 1) id = B.byName(h < SEA - 6 ? 'deepslate' : 'sand').id;
                        else if (biome === 'desert') id = B.byName('sand').id;
                        else id = B.byName('dirt').id;
                    } else {
                        id = y < 12 ? B.byName('deepslate').id : B.byName('stone').id;
                    }

                    if (id !== 0 && y > 1 && y < h && this.caveAt(wx, y, wz)) id = 0;
                    if (id !== 0) blocks[IDX(x, y, z)] = id;
                }

                for (let y = h + 1; y <= SEA; y++) {
                    blocks[IDX(x, y, z)] = B.WATER;
                }
            }
        }

        c.empty = false;
        c.generated = true;
        this.decorate(c);
        this.applyEdits(c);
        c.decorated = true;
        this.computeHeight(c);
        return c;
    }

    computeHeight(c) {
        const blocks = c.blocks;
        for (let z = 0; z < CHUNK; z++) {
            for (let x = 0; x < CHUNK; x++) {
                let h = 0;
                for (let y = WORLD_H - 1; y >= 0; y--) {
                    const id = blocks[IDX(x, y, z)];
                    if (id !== 0 && !B.isLiquid(id)) {
                        h = y;
                        break;
                    }
                }
                c.height[z * CHUNK + x] = h;
            }
        }
    }

    decorate(c) {
        const ox = c.cx * CHUNK;
        const oz = c.cz * CHUNK;
        const pad = 2;
        for (let dz = -pad; dz < CHUNK + pad; dz++) {
            for (let dx = -pad; dx < CHUNK + pad; dx++) {
                const wx = ox + dx;
                const wz = oz + dz;
                const biome = this.biomeAt(wx, wz);
                if (biome === 'ocean') continue;
                const h = this.terrainHeight(wx, wz);
                if (h <= SEA) continue;
                const r = hash2i(wx, wz, this.seed + 991);
                let density = 0.006;
                let kind = 'oak';
                if (biome === 'forest') density = 0.05;
                else if (biome === 'plains') density = 0.008;
                else if (biome === 'mountains') {
                    density = 0.012;
                    kind = 'spruce';
                } else if (biome === 'snow') {
                    density = 0.02;
                    kind = 'spruce';
                } else if (biome === 'desert') {
                    density = 0;
                }
                if (r > density) continue;
                this.placeTree(c, wx, h + 1, wz, kind);
            }
        }
    }

    placeTree(c, wx, wy, wz, kind) {
        const x = wx - c.cx * CHUNK;
        const z = wz - c.cz * CHUNK;
        if (x < -3 || z < -3 || x > CHUNK + 2 || z > CHUNK + 2) return;
        const rnd = mulberry32((wx * 73856093 + wz * 19349663 + this.seed) | 0);
        const blocks = c.blocks;
        const put = (lx, ly, lz, id, replace) => {
            if (lx < 0 || lz < 0 || lx >= CHUNK || lz >= CHUNK || ly < 0 || ly >= WORLD_H) return;
            const i = IDX(lx, ly, lz);
            const cur = blocks[i];
            if (!replace && cur !== 0) return;
            if (replace && cur !== 0 && !B.isLiquid(cur) && cur !== B.byName('oak_leaves').id && cur !== B.byName('birch_leaves').id && cur !== B.byName('spruce_leaves').id) return;
            blocks[i] = id;
        };

        if (kind === 'spruce') {
            const th = 7 + Math.floor(rnd() * 5);
            const log = B.byName('spruce_log').id;
            const lv = B.byName('spruce_leaves').id;
            for (let y = 0; y < th; y++) put(x, wy + y, z, log, true);
            for (let y = th - 1; y >= 2; y--) {
                const layer = th - 1 - y;
                const r = layer % 3 === 0 ? 2 : layer % 3 === 1 ? 1 : 2;
                for (let dz = -r; dz <= r; dz++) {
                    for (let dx = -r; dx <= r; dx++) {
                        if (Math.abs(dx) + Math.abs(dz) > r + 1) continue;
                        if (dx === 0 && dz === 0 && y < th) continue;
                        put(x + dx, wy + y, z + dz, lv, true);
                    }
                }
            }
            put(x, wy + th, z, lv, true);
            return;
        }

        const birch = kind === 'birch';
        const log = B.byName(birch ? 'birch_log' : 'oak_log').id;
        const lv = B.byName(birch ? 'birch_leaves' : 'oak_leaves').id;
        const th = 4 + Math.floor(rnd() * 3);
        for (let y = 0; y < th; y++) put(x, wy + y, z, log, true);
        const top = wy + th;
        for (let dy = -2; dy <= 1; dy++) {
            for (let dz = -2; dz <= 2; dz++) {
                for (let dx = -2; dx <= 2; dx++) {
                    const d = Math.abs(dx) + Math.abs(dy) + Math.abs(dz);
                    if (d > 3) continue;
                    if (dx === 0 && dz === 0 && dy <= 0) continue;
                    if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
                    put(x + dx, top + dy, z + dz, lv, true);
                }
            }
        }
        put(x, top + 1, z, lv, true);
    }

    applyEdits(c) {
        const list = this.edits.get(c.cx + ',' + c.cz);
        if (!list) return;
        for (const [i, id] of list) c.blocks[i] = id;
    }

    recordEdit(cx, cz, i, id) {
        const k = cx + ',' + cz;
        let list = this.edits.get(k);
        if (!list) {
            list = new Map();
            this.edits.set(k, list);
        }
        list.set(i, id);
    }

    getBlock(wx, wy, wz) {
        if (wy < 0 || wy >= WORLD_H) return 0;
        const cx = wx >> 4, cz = wz >> 4;
        const c = this.chunks.get(cx + ',' + cz);
        if (!c) return 0;
        return c.blocks[IDX(wx - (cx << 4), wy, wz - (cz << 4))];
    }

    getBlockLocal(c, x, y, z) {
        if (y < 0 || y >= WORLD_H) return 0;
        return c.blocks[IDX(x, y, z)];
    }

    getLight(wx, wy, wz) {
        if (wy < 0 || wy >= WORLD_H) return wy >= WORLD_H ? 15 : 0;
        const cx = wx >> 4, cz = wz >> 4;
        const c = this.chunks.get(cx + ',' + cz);
        if (!c) return 15;
        return c.light[IDX(wx - (cx << 4), wy, wz - (cz << 4))];
    }

    getLightLocal(c, x, y, z) {
        if (y < 0) return 0;
        if (y >= WORLD_H) return 15;
        return c.light[IDX(x, y, z)];
    }

    setBlock(wx, wy, wz, id) {
        if (wy < 1 || wy >= WORLD_H) return false;
        const cx = wx >> 4, cz = wz >> 4;
        const c = this.chunks.get(cx + ',' + cz);
        if (!c) return false;
        const lx = wx - (cx << 4);
        const lz = wz - (cz << 4);
        const i = IDX(lx, wy, lz);
        const old = c.blocks[i];
        if (old === id) return false;
        c.blocks[i] = id;
        this.recordEdit(cx, cz, i, id);
        this.relightAround(c, lx, wy, lz);
        this.computeHeight(c);
        c.dirty = true;
        this.dirtyChunks.add(cx + ',' + cz);
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            if ((lx === 0 && dx === -1) || (lx === CHUNK - 1 && dx === 1) || (lz === 0 && dz === -1) || (lz === CHUNK - 1 && dz === 1)) {
                const n = this.chunks.get(cx + dx + ',' + (cz + dz));
                if (n) {
                    n.dirty = true;
                    this.dirtyChunks.add(n.cx + ',' + n.cz);
                }
            }
        }
        return true;
    }

    relightAround(c, x, y, z) {
        const r = 16;
        const x0 = Math.max(0, x - r), x1 = Math.min(CHUNK - 1, x + r);
        const z0 = Math.max(0, z - r), z1 = Math.min(CHUNK - 1, z + r);
        this.computeLightColumn(c, x0, x1, z0, z1);
        this.floodLight(c, x, y, z);
        for (const n of this.neighborsOf(c)) {
            if (!n) continue;
            const nx0 = c.cx < n.cx ? CHUNK - 1 : 0;
            const nx1 = c.cx < n.cx ? 0 : CHUNK - 1;
            const nz0 = c.cz < n.cz ? CHUNK - 1 : 0;
            const nz1 = c.cz < n.cz ? 0 : CHUNK - 1;
            const lx = c.cx === n.cx ? x0 : nx0;
            const hx = c.cx === n.cx ? x1 : nx1;
            const lz = c.cz === n.cz ? z0 : nz0;
            const hz = c.cz === n.cz ? z1 : nz1;
            this.computeLightColumn(n, lx, hx, lz, hz);
            this.floodLight(n, lx, y, lz);
            n.dirty = true;
            this.dirtyChunks.add(n.cx + ',' + n.cz);
        }
    }

    neighborsOf(c) {
        return [
            this.chunks.get(c.cx + 1 + ',' + c.cz),
            this.chunks.get(c.cx - 1 + ',' + c.cz),
            this.chunks.get(c.cx + ',' + c.cz + 1),
            this.chunks.get(c.cx + ',' + c.cz - 1),
        ];
    }

    computeLightColumn(c, x0, x1, z0, z1) {
        const light = c.light;
        const blocks = c.blocks;
        for (let z = z0; z <= z1; z++) {
            for (let x = x0; x <= x1; x++) {
                let lvl = 15;
                for (let y = WORLD_H - 1; y >= 0; y--) {
                    const i = IDX(x, y, z);
                    const id = blocks[i];
                    if (B.isOpaque(id)) {
                        lvl = 0;
                        light[i] = 0;
                    } else if (lvl > 0) {
                        light[i] = lvl;
                        if (B.isLiquid(id) && lvl === 15) light[i] = 14;
                    }
                }
            }
        }
    }

    floodLight(c, sx, sy, sz) {
        const blocks = c.blocks;
        const light = c.light;
        let yTop = 0;
        for (let y = WORLD_H - 1; y >= 0; y--) {
            let any = false;
            for (let z = 0; z < CHUNK && !any; z++) {
                for (let x = 0; x < CHUNK; x++) {
                    if (light[IDX(x, y, z)] > 1) {
                        any = true;
                        break;
                    }
                }
            }
            if (any) {
                yTop = y + 1;
                break;
            }
        }

        const cap = 4 * CHUNK * CHUNK * 6;
        const queue = new Int32Array(4 * CHUNK * CHUNK * 6);
        let tail = 0;

        const x0 = Math.max(0, sx - 15);
        const x1 = Math.min(CHUNK - 1, sx + 15);
        const z0 = Math.max(0, sz - 15);
        const z1 = Math.min(CHUNK - 1, sz + 15);

        for (let y = 0; y <= yTop; y++) {
            for (let z = z0; z <= z1; z++) {
                for (let x = x0; x <= x1; x++) {
                    const i = IDX(x, y, z);
                    const l = light[i];
                    if (l > 1 && tail < cap) {
                        queue[tail++] = x;
                        queue[tail++] = y;
                        queue[tail++] = z;
                        queue[tail++] = l;
                    }
                }
            }
        }

        let head = 0;
        while (head < tail) {
            const x = queue[head++];
            const y = queue[head++];
            const z = queue[head++];
            const l = queue[head++];
            const down = l === 15 ? l : l - 1;
            const side = l - 1;

            if (x + 1 < CHUNK) {
                const i = IDX(x + 1, y, z);
                const b = blocks[i];
                if (side > 0 && light[i] < side && !B.OPAQUE.has(b)) {
                    light[i] = B.LIQUID.has(b) ? 14 : side;
                    if (tail < cap) { queue[tail++] = x + 1; queue[tail++] = y; queue[tail++] = z; queue[tail++] = light[i]; }
                }
            }
            if (x - 1 >= 0) {
                const i = IDX(x - 1, y, z);
                const b = blocks[i];
                if (side > 0 && light[i] < side && !B.OPAQUE.has(b)) {
                    light[i] = B.LIQUID.has(b) ? 14 : side;
                    if (tail < cap) { queue[tail++] = x - 1; queue[tail++] = y; queue[tail++] = z; queue[tail++] = light[i]; }
                }
            }
            if (z + 1 < CHUNK) {
                const i = IDX(x, y, z + 1);
                const b = blocks[i];
                if (side > 0 && light[i] < side && !B.OPAQUE.has(b)) {
                    light[i] = B.LIQUID.has(b) ? 14 : side;
                    if (tail < cap) { queue[tail++] = x; queue[tail++] = y; queue[tail++] = z + 1; queue[tail++] = light[i]; }
                }
            }
            if (z - 1 >= 0) {
                const i = IDX(x, y, z - 1);
                const b = blocks[i];
                if (side > 0 && light[i] < side && !B.OPAQUE.has(b)) {
                    light[i] = B.LIQUID.has(b) ? 14 : side;
                    if (tail < cap) { queue[tail++] = x; queue[tail++] = y; queue[tail++] = z - 1; queue[tail++] = light[i]; }
                }
            }
            if (y + 1 < WORLD_H) {
                const i = IDX(x, y + 1, z);
                const b = blocks[i];
                if (light[i] < l && !B.OPAQUE.has(b)) {
                    light[i] = B.LIQUID.has(b) ? Math.min(l, 14) : l;
                    if (tail < cap) { queue[tail++] = x; queue[tail++] = y + 1; queue[tail++] = z; queue[tail++] = light[i]; }
                }
            }
            if (y - 1 >= 0) {
                const i = IDX(x, y - 1, z);
                const b = blocks[i];
                if (down > 0 && light[i] < down && !B.OPAQUE.has(b)) {
                    light[i] = B.LIQUID.has(b) ? Math.min(down, 14) : down;
                    if (tail < cap) { queue[tail++] = x; queue[tail++] = y - 1; queue[tail++] = z; queue[tail++] = light[i]; }
                }
            }
        }
    }

    initLight(c) {
        this.computeLightColumn(c, 0, CHUNK - 1, 0, CHUNK - 1);
        this.floodLight(c, CHUNK >> 1, WORLD_H >> 1, CHUNK >> 1);
        for (const n of this.neighborsOf(c)) {
            if (n) {
                this.floodEdge(c, n);
                this.floodEdge(n, c);
            }
        }
        c.lit = true;
    }

    floodEdge(target, src) {
        const push = (tx, ty, tz, l) => {
            if (tx < 0 || tz < 0 || tx >= CHUNK || tz >= CHUNK || ty < 0 || ty >= WORLD_H) return;
            const i = IDX(tx, ty, tz);
            if (B.isOpaque(target.blocks[i])) return;
            const cap = B.isLiquid(target.blocks[i]) ? Math.min(l, 14) : l;
            if (target.light[i] >= cap) return;
            target.light[i] = cap;
            queue.push(tx, ty, tz, cap);
        };
        const queue = [];
        for (let y = 0; y < WORLD_H; y++) {
            if (src.cx < target.cx) {
                for (let z = 0; z < CHUNK; z++) {
                    const l = src.light[IDX(0, y, z)];
                    if (l > 1) push(CHUNK - 1, y, z, l - 1);
                }
            } else if (src.cx > target.cx) {
                for (let z = 0; z < CHUNK; z++) {
                    const l = src.light[IDX(CHUNK - 1, y, z)];
                    if (l > 1) push(0, y, z, l - 1);
                }
            }
            if (src.cz < target.cz) {
                for (let x = 0; x < CHUNK; x++) {
                    const l = src.light[IDX(x, y, 0)];
                    if (l > 1) push(x, y, CHUNK - 1, l - 1);
                }
            } else if (src.cz > target.cz) {
                for (let x = 0; x < CHUNK; x++) {
                    const l = src.light[IDX(x, y, CHUNK - 1)];
                    if (l > 1) push(x, y, 0, l - 1);
                }
            }
        }
        let head = 0;
        while (head < queue.length) {
            const x = queue[head++], y = queue[head++], z = queue[head++], l = queue[head++];
            if (l <= 1) continue;
            const spread = (nx, ny, nz, nl) => {
                if (nx < 0 || nz < 0 || nx >= CHUNK || nz >= CHUNK || ny < 0 || ny >= WORLD_H) return;
                const i = IDX(nx, ny, nz);
                if (B.isOpaque(target.blocks[i])) return;
                const cap = B.isLiquid(target.blocks[i]) ? Math.min(nl, 14) : nl;
                if (target.light[i] >= cap) return;
                target.light[i] = cap;
                queue.push(nx, ny, nz, cap);
            };
            spread(x + 1, y, z, l - 1);
            spread(x - 1, y, z, l - 1);
            spread(x, y + 1, z, l);
            spread(x, y, z + 1, l - 1);
            spread(x, y, z - 1, l - 1);
            spread(x, y - 1, z, Math.max(0, l - (l === 15 ? 0 : 1)));
        }
    }

    surfaceY(wx, wz) {
        const cx = wx >> 4, cz = wz >> 4;
        const c = this.chunks.get(cx + ',' + cz);
        if (c && c.generated) {
            const lx = wx - (cx << 4);
            const lz = wz - (cz << 4);
            return c.height[lz * CHUNK + lx] + 1;
        }
        return this.terrainHeight(wx, wz) + 1;
    }

    findSpawn() {
        for (let r = 0; r < 600; r++) {
            for (let a = 0; a < 16; a++) {
                const ang = (a / 16) * Math.PI * 2 + r * 0.11;
                const x = Math.round(Math.cos(ang) * r * 5);
                const z = Math.round(Math.sin(ang) * r * 5);
                const h = this.terrainHeight(x, z);
                if (h <= SEA + 1 || h > SEA + 20) continue;
                const biome = this.biomeAt(x, z);
                if (biome === 'ocean' || biome === 'desert') continue;
                if (this.clearSpawn(x, z, h)) return { x: x + 0.5, y: h + 1, z: z + 0.5 };
            }
        }
        return { x: 0.5, y: SEA + 8, z: 0.5 };
    }

    clearSpawn(x, z, h) {
        if (this.terrainHeight(x - 2, z) !== h || this.terrainHeight(x + 2, z) !== h) return false;
        if (this.terrainHeight(x, z - 2) !== h || this.terrainHeight(x, z + 2) !== h) return false;
        const treeR = mulberry32((x * 374761393 + z * 668265263 + this.seed) | 0);
        for (let dx = -3; dx <= 3; dx++) {
            for (let dz = -3; dz <= 3; dz++) {
                const hh = this.terrainHeight(x + dx, z + dz);
                if (hh !== h) return false;
                if (hash2i(x + dx, z + dz, this.seed + 991) < 0.09 && treeR() < 0.4) return false;
            }
        }
        return true;
    }
}

export { IDX as chunkIndex };
