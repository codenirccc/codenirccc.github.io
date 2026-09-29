import { CHUNK, WORLD_H, chunkIndex } from './world.js';
import * as B from './blocks.js';
import { TILE } from './textures.js';

const FACES = [
    { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },
    { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
    { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] },
    { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
    { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
    { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] },
];

const CORNERS = [
    [0, 0], [1, 0], [1, 1], [0, 1],
];

const FACE_SHADE = [0.66, 0.66, 1.0, 0.5, 0.84, 0.84];

export class Mesher {
    constructor(world, textureArray) {
        this.world = world;
        this.tex = textureArray;
        this.pos = new Float32Array(0);
        this.uv = new Float32Array(0);
        this.layer = new Float32Array(0);
        this.light = new Float32Array(0);
        this.idx = new Uint32Array(0);
    }

    blockAt(c, x, y, z) {
        if (y < 0) return -1;
        if (y >= WORLD_H) return 0;
        if (x >= 0 && z >= 0 && x < CHUNK && z < CHUNK) return c.blocks[chunkIndex(x, y, z)];
        return this.world.getBlock(c.cx * CHUNK + x, y, c.cz * CHUNK + z);
    }

    lightAt(c, x, y, z) {
        if (y < 0) return 0;
        if (y >= WORLD_H) return 15;
        if (x >= 0 && z >= 0 && x < CHUNK && z < CHUNK) return c.light[chunkIndex(x, y, z)];
        return this.world.getLight(c.cx * CHUNK + x, y, c.cz * CHUNK + z);
    }

    isHidden(c, x, y, z, id) {
        const nb = this.blockAt(c, x, y, z);
        if (nb === id) return true;
        if (nb === 0) return false;
        if (B.isOpaque(nb)) return true;
        if (B.isLiquid(nb) && !B.isLiquid(id)) return true;
        if (B.isTransparent(id) && !B.isLiquid(id) && B.isTransparent(nb) && !B.isLiquid(nb)) return false;
        if (!B.isTransparent(id)) return true;
        return false;
    }

    vertexAO(c, x, y, z, f, corner, faceIdx) {
        const n = FACES[faceIdx].n;
        const su = FACES[faceIdx].u;
        const sv = FACES[faceIdx].v;
        const du = corner[0] === 1 ? 1 : -1;
        const dv = corner[1] === 1 ? 1 : -1;
        const bx = x + n[0], by = y + n[1], bz = z + n[2];
        const ax = bx + su[0] * du, ay = by + su[1] * du, az = bz + su[2] * du;
        const cx2 = bx + sv[0] * dv, cy2 = by + sv[1] * dv, cz2 = bz + sv[2] * dv;
        const dx = bx + su[0] * du + sv[0] * dv;
        const dy = by + su[1] * du + sv[1] * dv;
        const dz = bz + su[2] * du + sv[2] * dv;
        const s1 = B.isOpaque(this.blockAt(c, ax, ay, az)) ? 1 : 0;
        const s2 = B.isOpaque(this.blockAt(c, cx2, cy2, cz2)) ? 1 : 0;
        const cr = B.isOpaque(this.blockAt(c, dx, dy, dz)) ? 1 : 0;
        if (s1 && s2) return 0;
        return 3 - (s1 + s2 + cr);
    }

    smoothLight(c, x, y, z, f, corner, faceIdx) {
        const n = FACES[faceIdx].n;
        const su = FACES[faceIdx].u;
        const sv = FACES[faceIdx].v;
        const du = corner[0] === 1 ? 1 : -1;
        const dv = corner[1] === 1 ? 1 : -1;
        const bx = x + n[0], by = y + n[1], bz = z + n[2];
        let sum = this.lightAt(c, bx, by, bz);
        let count = 1;
        const ax = bx + su[0] * du, ay = by + su[1] * du, az = bz + su[2] * du;
        const cx2 = bx + sv[0] * dv, cy2 = by + sv[1] * dv, cz2 = bz + sv[2] * dv;
        const dx = bx + su[0] * du + sv[0] * dv, dy = by + su[1] * du + sv[1] * dv, dz = bz + su[2] * du + sv[2] * dv;
        if (!B.isOpaque(this.blockAt(c, ax, ay, az))) { sum += this.lightAt(c, ax, ay, az); count++; }
        if (!B.isOpaque(this.blockAt(c, cx2, cy2, cz2))) { sum += this.lightAt(c, cx2, cy2, cz2); count++; }
        if (!B.isOpaque(this.blockAt(c, dx, dy, dz))) { sum += this.lightAt(c, dx, dy, dz); count++; }
        return sum / count / 15;
    }

    build(c) {
        const pos = [];
        const uv = [];
        const lay = [];
        const lit = [];
        const sky = [];
        const ind = [];
        const wpos = [];
        const wuv = [];
        const wlay = [];
        const wlit = [];
        const wsky = [];
        const wind = [];
        let vi = 0;
        let wvi = 0;
        const ox = c.cx * CHUNK;
        const oz = c.cz * CHUNK;

        for (let y = 0; y < WORLD_H; y++) {
            for (let z = 0; z < CHUNK; z++) {
                for (let x = 0; x < CHUNK; x++) {
                    const id = c.blocks[chunkIndex(x, y, z)];
                    if (id === 0) continue;
                    const liquid = B.isLiquid(id);
                    const block = B.byId(id);
                    if (!liquid) {
                        if (y === 0) continue;
                        if (
                            B.isOpaque(this.blockAt(c, x + 1, y, z)) &&
                            B.isOpaque(this.blockAt(c, x - 1, y, z)) &&
                            B.isOpaque(this.blockAt(c, x, y + 1, z)) &&
                            B.isOpaque(this.blockAt(c, x, y - 1, z)) &&
                            B.isOpaque(this.blockAt(c, x, y, z + 1)) &&
                            B.isOpaque(this.blockAt(c, x, y, z - 1))
                        ) {
                            continue;
                        }
                    }
                    for (let fi = 0; fi < 6; fi++) {
                        const f = FACES[fi];
                        const nx = x + f.n[0], ny = y + f.n[1], nz = z + f.n[2];
                        if (liquid) {
                            if (fi === 3) continue;
                            if (fi !== 2) {
                                const nb = this.blockAt(c, nx, ny, nz);
                                if (nb === id) continue;
                                if (B.isOpaque(nb)) continue;
                            } else {
                                const nb = this.blockAt(c, nx, ny, nz);
                                if (B.isLiquid(nb)) continue;
                            }
                        } else if (this.isHidden(c, nx, ny, nz, id)) {
                            continue;
                        }
                        const tile = B.faceTile(block, fi);
                        const layer = this.tex.indexOf(tile);
                        const target = liquid ? 1 : 0;
                        const P = target ? wpos : pos;
                        const U = target ? wuv : uv;
                        const L = target ? wlay : lay;
                        const Li = target ? wlit : lit;
                        const S = target ? wsky : sky;
                        const I = target ? wind : ind;
                        const base = target ? wvi : vi;

                        for (let ci = 0; ci < 4; ci++) {
                            const [cu, cv] = CORNERS[ci];
                            const px = x + (f.n[0] > 0 ? 1 : 0) + f.u[0] * cu + f.v[0] * cv;
                            let py = y + (f.n[1] > 0 ? 1 : 0) + f.u[1] * cu + f.v[1] * cv;
                            const pz = z + (f.n[2] > 0 ? 1 : 0) + f.u[2] * cu + f.v[2] * cv;
                            if (liquid && fi === 2) py = y + 0.875;
                            P.push(px, py, pz);
                            U.push(cu, 1 - cv);
                            L.push(layer);
                            const ao = this.vertexAO(c, x, y, z, f, [cu, cv], fi) / 3;
                            const l = this.smoothLight(c, x, y, z, f, [cu, cv], fi);
                            const shade = FACE_SHADE[fi] * (0.3 + l * 0.7) * (0.55 + ao * 0.45);
                            S.push(l);
                            if (target) {
                                const v = liquid ? shade * 0.85 : shade;
                                Li.push(v, v, v, 1);
                            } else {
                                Li.push(shade, shade, shade, 1);
                            }
                        }
                        I.push(base, base + 1, base + 2, base, base + 2, base + 3);
                        if (target) wvi += 4;
                        else vi += 4;
                    }
                }
            }
        }

        void wpos;
        return {
            pos: new Float32Array(pos),
            uv: new Float32Array(uv),
            layer: new Float32Array(lay),
            light: new Float32Array(lit),
            sky: new Float32Array(sky),
            idx: new Uint32Array(ind),
            wpos: new Float32Array(wpos),
            wuv: new Float32Array(wuv),
            wlayer: new Float32Array(wlay),
            wlight: new Float32Array(wlit),
            wsky: new Float32Array(wsky),
            widx: new Uint32Array(wind),
            origin: [ox, 0, oz],
        };
    }
}

export { FACES, TILE };
