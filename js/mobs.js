import * as THREE from 'three';
import * as B from './blocks.js';
import { WORLD_H } from './world.js';
import { sfx } from './audio.js';

const TYPES = {
    sheep: {
        label: 'Sheep',
        body: 0xe8e6e0,
        head: 0xf0eee8,
        leg: 0xd8d5cd,
        wool: true,
        speed: 1.35,
        hp: 8,
        drops: ['wool'],
    },
    cow: {
        label: 'Cow',
        body: 0x4a3327,
        head: 0x3b2820,
        leg: 0x2f201a,
        spots: true,
        speed: 1.2,
        hp: 10,
    },
    pig: {
        label: 'Pig',
        body: 0xe8a0a4,
        head: 0xf0acae,
        leg: 0xd88e92,
        speed: 1.25,
        hp: 10,
    },
    chicken: {
        label: 'Chicken',
        body: 0xf2f0ea,
        head: 0xe84a3c,
        leg: 0xe0a83a,
        small: true,
        speed: 1.4,
        hp: 4,
    },
};

const GROUP = 12;
let nextId = 1;

const mobMaterials = new Map();

function mobMat(color) {
    const key = color;
    let m = mobMaterials.get(key);
    if (!m) {
        m = new THREE.MeshLambertMaterial({ color });
        mobMaterials.set(key, m);
    }
    return m;
}

function box(w, h, d, color) {
    const g = new THREE.BoxGeometry(w, h, d);
    return new THREE.Mesh(g, mobMat(color));
}

function buildSheepModel(type) {
    const t = TYPES[type];
    const g = new THREE.Group();
    const s = t.small ? 0.55 : 1;
    const body = box(0.9 * s, 0.72 * s, 1.25 * s, t.body);
    body.position.y = 0.95 * s;
    g.add(body);

    if (t.spots) {
        for (let i = 0; i < 4; i++) {
            const p = new THREE.Mesh(
                new THREE.BoxGeometry(0.2 * s, 0.2 * s, 0.05),
                mobMat(0xe8e4dc)
            );
            p.position.set(
                (Math.random() - 0.5) * 0.6 * s,
                0.95 * s + (Math.random() - 0.5) * 0.4 * s,
                (i % 2 ? 1 : -1) * 0.63 * s
            );
            g.add(p);
        }
    }

    const headG = new THREE.Group();
    const head = box(0.5 * s, 0.5 * s, 0.5 * s, t.head);
    head.position.set(0, 0.05, 0.2);
    headG.add(head);
    if (type === 'pig') {
        const snout = box(0.25 * s, 0.2 * s, 0.1, 0xd97f86);
        snout.position.set(0, -0.05, 0.47);
        headG.add(snout);
    }
    if (type === 'chicken') {
        const beak = box(0.14 * s, 0.14 * s, 0.16, 0xe8a83a);
        beak.position.set(0, 0, 0.5);
        headG.add(beak);
    }
    for (const sx of [-1, 1]) {
        const eye = new THREE.Mesh(
            new THREE.BoxGeometry(0.09 * s, 0.09 * s, 0.04),
            mobMat(0x14100e)
        );
        eye.position.set(0.14 * sx * s, 0.14 * s, 0.44);
        headG.add(eye);
    }
    headG.position.set(0, 1.12 * s, -0.72 * s);
    g.add(headG);

    const legs = [];
    const legH = (type === 'chicken' ? 0.35 : 0.6) * s;
    for (const [lx, lz] of [[-0.28, -0.42], [0.28, -0.42], [-0.28, 0.42], [0.28, 0.42]]) {
        const leg = box(0.24 * s, legH, 0.24 * s, t.leg);
        leg.position.set(lx * s, legH / 2, lz * s);
        g.add(leg);
        legs.push(leg);
    }
    if (type === 'chicken') {
        for (const sx of [-1, 1]) {
            const wing = box(0.12 * s, 0.3 * s, 0.5 * s, t.body);
            wing.position.set(0.46 * s, 0.95 * s, 0);
            g.add(wing);
        }
    }
    g.userData.legs = legs;
    g.userData.head = headG;
    g.userData.scale = s;
    return g;
}

export class Mob {
    constructor(type, x, y, z) {
        this.id = nextId++;
        this.type = type;
        this.def = TYPES[type];
        this.pos = new THREE.Vector3(x, y, z);
        this.vel = new THREE.Vector3();
        this.yaw = Math.random() * Math.PI * 2;
        this.model = buildSheepModel(type);
        this.model.position.copy(this.pos);
        this.onGround = false;
        this.onGroundPrev = true;
        this.jumpQueued = false;
        this.state = 'idle';
        this.timer = 1 + Math.random() * 3;
        this.path = [];
        this.repathTimer = 0;
        this.walkPhase = Math.random() * 6;
        this.headBob = Math.random() * 6;
        this.hp = this.def.hp;
        this.panic = 0;
        this.eatTimer = 0;
        this.loveTimer = 0;
        this.baby = false;
    }

    get scale() {
        return this.model.userData.scale;
    }

    setBaby(v) {
        this.baby = v;
        this.model.scale.setScalar(this.baby ? 0.6 : 1);
    }
}

export class MobManager {
    constructor(world, scene) {
        this.world = world;
        this.scene = scene;
        this.mobs = [];
        this.group = new THREE.Group();
        scene.add(this.group);
        this.maxMobs = 22;
        this.spawnTimer = 3;
        this.difficulty = 1;
    }

    solidAt(x, y, z) {
        if (y < 0) return true;
        if (y >= WORLD_H) return false;
        return B.isSolid(this.world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)));
    }

    blockAt(x, y, z) {
        return this.world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
    }

    canStand(x, y, z) {
        const s = this.baby ? 0.5 : 0.75;
        if (this.solidAt(x, y, z)) return false;
        if (this.solidAt(x, y + 1, z)) return false;
        void s;
        return true;
    }

    spawn(type, x, y, z) {
        if (this.mobs.length >= this.maxMobs) return null;
        const sy = this.world.surfaceY(Math.floor(x), Math.floor(z));
        const m = new Mob(type, x, Math.max(y, sy) + 0.2, z);
        this.mobs.push(m);
        this.group.add(m.model);
        return m;
    }

    despawn(m) {
        const i = this.mobs.indexOf(m);
        if (i >= 0) this.mobs.splice(i, 1);
        this.group.remove(m.model);
        m.model.traverse((o) => {
            if (o.geometry) o.geometry.dispose();
        });
    }

    tryNaturalSpawn(px, pz) {
        if (this.mobs.length >= this.maxMobs) return;
        const ang = Math.random() * Math.PI * 2;
        const dist = 26 + Math.random() * 30;
        const x = Math.floor(px + Math.cos(ang) * dist);
        const z = Math.floor(pz + Math.sin(ang) * dist);
        const surface = this.world.surfaceY(x, z);
        const biome = this.world.biomeAt(x, z);
        if (surface <= 1) return;
        if (this.world.getBlock(x, surface, z) !== 0) return;
        if (B.isLiquid(this.world.getBlock(x, surface - 1, z))) return;
        if (biome === 'ocean') return;
        const roll = Math.random();
        let type = 'sheep';
        if (biome === 'plains' || biome === 'forest') {
            if (roll < 0.45) type = 'sheep';
            else if (roll < 0.72) type = 'cow';
            else if (roll < 0.9) type = 'pig';
            else type = 'chicken';
        } else {
            type = roll < 0.6 ? 'sheep' : 'cow';
        }
        if (biome === 'mountains' || biome === 'snow') type = roll < 0.5 ? 'sheep' : 'cow';
        const count = 1 + Math.floor(Math.random() * 3);
        for (let i = 0; i < count; i++) {
            const ox = x + (Math.random() * 6 - 3);
            const oz = z + (Math.random() * 6 - 3);
            const sy = this.world.surfaceY(Math.floor(ox), Math.floor(oz));
            if (this.world.getBlock(Math.floor(ox), sy, Math.floor(oz)) === 0) {
                this.spawn(type, Math.floor(ox) + 0.5, sy, Math.floor(oz) + 0.5);
            }
        }
    }

    findPath(m, target) {
        const maxNodes = 900;
        const step = 1;
        const sx = Math.floor(m.pos.x);
        const sy = Math.floor(m.pos.y);
        const sz = Math.floor(m.pos.z);
        const gx = Math.floor(target.x);
        const gy = Math.floor(target.y);
        const gz = Math.floor(target.z);
        if (sx === gx && sz === gz) return [];

        const key = (x, y, z) => (x + 512) * 1048576 + (z + 512) * 1024 + (y + 64);
        const open = [{ x: sx, y: sy, z: sz, g: 0, f: 0, p: null }];
        const seen = new Map();
        let iterations = 0;
        const dirs = [
            [1, 0], [-1, 0], [0, 1], [0, -1],
            [1, 1], [1, -1], [-1, 1], [-1, -1],
        ];
        const goalOk = (x, y, z) => {
            if (Math.abs(x - gx) <= 1 && Math.abs(z - gz) <= 1 && Math.abs(y - gy) <= 2) {
                if (this.canStand(x, y, z) || this.solidAt(x, y - 1, z) === false) return true;
            }
            return false;
        };

        while (open.length && iterations++ < maxNodes) {
            let bi = 0;
            for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
            const cur = open.splice(bi, 1)[0];
            if (cur.x === gx && cur.z === gz) return this.reconstruct(cur);
            if (goalOk(cur.x, cur.y, cur.z)) return this.reconstruct(cur);
            const ck = key(cur.x, cur.y, cur.z);
            if (seen.has(ck) && seen.get(ck) <= cur.g) continue;
            seen.set(ck, cur.g);

            for (const [dx, dz] of dirs) {
                for (let dy = 1; dy >= -2; dy--) {
                    const nx = cur.x + dx * step;
                    const ny = cur.y + dy;
                    const nz = cur.z + dz * step;
                    if (ny < 1 || ny >= WORLD_H - 2) continue;
                    if (this.solidAt(nx, ny, nz)) continue;
                    if (this.solidAt(nx, ny + 1, nz)) continue;
                    if (dy === -2) {
                        if (!this.solidAt(nx, ny, nz) && !this.solidAt(cur.x, cur.y, cur.z)) continue;
                    }
                    const g = cur.g + 1;
                    const h = Math.abs(nx - gx) + Math.abs(nz - gz) + Math.abs(ny - gy) * 0.9;
                    open.push({ x: nx, y: ny, z: nz, g, f: g + h, p: cur });
                    break;
                }
            }
        }
        return null;
    }

    reconstruct(node) {
        const out = [];
        let c = node.p;
        let guard = 0;
        while (c && guard++ < 200) {
            out.push({ x: c.x + 0.5, y: c.y, z: c.z + 0.5 });
            c = c.p;
        }
        out.reverse();
        return out;
    }

    chooseWanderTarget(m) {
        const ang = Math.random() * Math.PI * 2;
        const dist = 4 + Math.random() * 9;
        const tx = m.pos.x + Math.cos(ang) * dist;
        const tz = m.pos.z + Math.sin(ang) * dist;
        const sy = this.world.surfaceY(Math.floor(tx), Math.floor(tz));
        if (sy < 1) return null;
        return { x: tx, y: sy, z: tz };
    }

    pickBlock(m) {
        const r = Math.random();
        if (r < 0.22) return 'oak_leaves';
        if (r < 0.6) return 'grass_block';
        if (r < 0.8) return 'birch_leaves';
        if (r < 0.92) return 'dirt';
        return 'oak_planks';
    }

    tickMob(m, dt, player) {
        if (dt <= 0) return;
        const speed = m.def.speed * (m.baby ? 1.3 : 1) * (m.panic > 0 ? 1.9 : 1);
        m.timer -= dt;
        m.repathTimer -= dt;
        m.panic = Math.max(0, m.panic - dt);

        const dx = m.pos.x - player.pos.x;
        const dz = m.pos.z - player.pos.z;
        const dy = m.pos.y - player.pos.y;
        const dist2 = dx * dx + dz * dz + dy * dy;

        if (dist2 < 22 && m.timer > 0.6 && m.panic <= 0 && Math.random() < dt * 2.4) {
            m.panic = 4;
        }

        if (m.panic > 0) {
            const away = Math.atan2(dz, dx) + (Math.random() - 0.5) * 0.6;
            this.steer(m, Math.cos(away) * 4, Math.sin(away) * 4, speed, dt);
            if (Math.random() < dt * 3) sfx.pop();
        } else if (m.state === 'graze') {
            m.state = 'idle';
            m.timer = 1.5 + Math.random() * 3;
        } else if (m.state === 'idle') {
            m.vel.x *= 0.82;
            m.vel.z *= 0.82;
            if (m.timer <= 0) {
                const r = Math.random();
                if (r < 0.58) {
                    const t = this.chooseWanderTarget(m);
                    if (t) {
                        const p = this.findPath(m, t);
                        if (p && p.length) {
                            m.path = p;
                            m.state = 'walk';
                        } else {
                            m.timer = 1.5;
                        }
                    } else {
                        m.timer = 1.5;
                    }
                } else if (r < 0.78) {
                    m.state = 'graze';
                    m.timer = 2.5 + Math.random() * 4;
                } else {
                    m.timer = 2 + Math.random() * 4;
                }
            }
        } else if (m.state === 'walk') {
            if (!m.path.length) {
                m.state = 'idle';
                m.timer = 1 + Math.random() * 3;
            } else {
                const node = m.path[0];
                const ddx = node.x - m.pos.x;
                const ddz = node.z - m.pos.z;
                if (Math.hypot(ddx, ddz) < 0.35) {
                    m.path.shift();
                } else {
                    const jump = node.y - m.pos.y > 0.6;
                    this.steer(m, ddx, ddz, speed, dt, jump);
                }
            }
            if (m.timer <= 0 && Math.random() < 0.3) {
                m.state = 'graze';
                m.timer = 2 + Math.random() * 3;
                m.path = [];
            }
        }

        m.onGround = false;
        m.vel.y -= 24 * dt;
        if (m.vel.y < -40) m.vel.y = -40;

        if (B.isLiquid(this.blockAt(m.pos.x, m.pos.y + 0.4, m.pos.z))) {
            if (m.vel.y < 1.6) m.vel.y = 1.6;
        }

        const hw = m.baby ? 0.22 : 0.32;
        const h = m.baby ? 0.62 : 1.0;

        const blocked = (x, y, z) => {
            const x0 = Math.floor(x - hw), x1 = Math.floor(x + hw);
            const y0 = Math.floor(y), y1 = Math.floor(y + h - 0.02);
            const z0 = Math.floor(z - hw), z1 = Math.floor(z + hw);
            for (let bx = x0; bx <= x1; bx++) {
                for (let by = y0; by <= y1; by++) {
                    for (let bz = z0; bz <= z1; bz++) {
                        if (this.solidAt(bx, by, bz)) return true;
                    }
                }
            }
            return false;
        };

        let stepUp = 0;
        if (m.jumpQueued && m.onGroundPrev) {
            const up = m.pos.y + 1.02;
            if (!blocked(m.pos.x + m.vel.x * 0.18, up, m.pos.z + m.vel.z * 0.18)) m.vel.y = 7.2;
            m.jumpQueued = false;
        }

        const stepX = m.vel.x * dt;
        const stepY = m.vel.y * dt;
        const stepZ = m.vel.z * dt;

        if (stepX !== 0) {
            const nx = m.pos.x + stepX;
            if (!blocked(nx, m.pos.y, m.pos.z)) m.pos.x = nx;
            else {
                m.vel.x = 0;
                m.jumpQueued = true;
                stepUp = 1;
            }
        }
        if (stepZ !== 0) {
            const nz = m.pos.z + stepZ;
            if (!blocked(m.pos.x, m.pos.y, nz)) m.pos.z = nz;
            else {
                m.vel.z = 0;
                m.jumpQueued = true;
                stepUp = 1;
            }
        }
        if (stepUp && m.vel.y <= 0) {
            for (let up = 0.6; up <= 1.02; up += 0.21) {
                if (!blocked(m.pos.x, m.pos.y + up, m.pos.z)) {
                    m.pos.y += up;
                    break;
                }
            }
        }

        if (stepY !== 0) {
            const ny = m.pos.y + stepY;
            if (!blocked(m.pos.x, ny, m.pos.z)) {
                m.pos.y = ny;
            } else {
                if (stepY < 0) m.onGround = true;
                m.vel.y = 0;
            }
        }

        if (!m.onGround) m.onGround = this.solidAt(m.pos.x, m.pos.y - 0.06, m.pos.z);
        m.onGroundPrev = m.onGround;

        if (m.pos.y < -8) {
            m.pos.y = this.world.surfaceY(Math.floor(m.pos.x), Math.floor(m.pos.z)) + 1;
            m.vel.set(0, 0, 0);
        }

        const moving = Math.hypot(m.vel.x, m.vel.z) > 0.05;
        if (moving) {
            const want = Math.atan2(m.vel.x, m.vel.z);
            let diff = want - m.yaw;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            m.yaw += diff * Math.min(1, dt * 9);
        }
        m.walkPhase += moving ? dt * 9 * (m.baby ? 1.2 : 1) : dt * 1.6;

        m.model.position.copy(m.pos);
        m.model.rotation.y = m.yaw;
        const legs = m.model.userData.legs;
        for (let i = 0; i < legs.length; i++) {
            const off = (i === 0 || i === 3) ? 0 : Math.PI;
            legs[i].rotation.x = Math.sin(m.walkPhase + off) * (moving ? 0.75 : 0.04);
        }
        const head = m.model.userData.head;
        if (head) {
            m.headBob += dt * 2;
            const graze = m.state === 'graze' ? 0.85 : 0;
            head.rotation.x = graze + (moving ? Math.sin(m.headBob) * 0.06 : Math.sin(m.headBob * 0.4) * 0.08);
        }
        m.model.position.y = m.pos.y + (m.onGround ? Math.abs(Math.sin(m.walkPhase)) * 0.035 * (moving ? 1 : 0) : 0);
    }

    steer(m, dx, dz, speed, dt, jump) {
        const len = Math.hypot(dx, dz) || 1;
        const tx = (dx / len) * speed;
        const tz = (dz / len) * speed;
        const accel = 8;
        m.vel.x += (tx - m.vel.x) * Math.min(1, accel * dt);
        m.vel.z += (tz - m.vel.z) * Math.min(1, accel * dt);
        if (jump && m.onGround) m.vel.y = 7.6;
    }

    hit(m, dmg, knockFrom) {
        m.hp -= dmg;
        m.panic = 6;
        if (knockFrom) {
            const a = Math.atan2(m.pos.z - knockFrom.z, m.pos.x - knockFrom.x);
            m.vel.x += Math.cos(a) * 6.5;
            m.vel.z += Math.sin(a) * 6.5;
            m.vel.y = Math.max(m.vel.y, 4.2);
        }
        sfx.hurt();
        if (m.hp <= 0) {
            this.despawn(m);
            return true;
        }
        return false;
    }

    update(dt, player) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
            this.spawnTimer = 4 + Math.random() * 6;
            this.tryNaturalSpawn(player.pos.x, player.pos.z);
        }

        let guard = 0;
        for (let i = this.mobs.length - 1; i >= 0; i--) {
            const m = this.mobs[i];
            const dx = m.pos.x - player.pos.x;
            const dz = m.pos.z - player.pos.z;
            const dy = m.pos.y - player.pos.y;
            if (dx * dx + dz * dz + dy * dy > 100 * 100) {
                this.despawn(m);
                continue;
            }
            this.tickMob(m, Math.min(dt, 0.05), player);
            if (guard++ > 64) break;
        }

        for (let i = 0; i < this.mobs.length; i++) {
            for (let j = i + 1; j < this.mobs.length; j++) {
                const a = this.mobs[i];
                const b = this.mobs[j];
                const ddx = a.pos.x - b.pos.x;
                const ddz = a.pos.z - b.pos.z;
                const d2 = ddx * ddx + ddz * ddz;
                if (d2 < 0.9 && d2 > 0.0001) {
                    const push = (0.95 - Math.sqrt(d2)) * 0.5;
                    const l = Math.sqrt(d2);
                    a.pos.x += (ddx / l) * push;
                    a.pos.z += (ddz / l) * push;
                    b.pos.x -= (ddx / l) * push;
                    b.pos.z -= (ddz / l) * push;
                }
            }
        }
    }

    raycastMob(origin, dir, maxDist) {
        let best = null;
        let bestT = maxDist;
        for (const m of this.mobs) {
            const s = m.baby ? 0.4 : 0.6;
            const minX = m.pos.x - s;
            const maxX = m.pos.x + s;
            const minY = m.pos.y;
            const maxY = m.pos.y + 1.4 * (m.baby ? 0.6 : 1);
            const minZ = m.pos.z - s * 1.4;
            const maxZ = m.pos.z + s * 1.4;
            let t0 = 0;
            let t1 = bestT;
            const slab = (o, d, lo, hi) => {
                if (Math.abs(d) < 1e-6) return o >= lo && o <= hi;
                let a = (lo - o) / d;
                let b = (hi - o) / d;
                if (a > b) {
                    const t = a;
                    a = b;
                    b = t;
                }
                t0 = Math.max(t0, a);
                t1 = Math.min(t1, b);
                return t1 >= t0;
            };
            if (!slab(origin.x, dir.x, minX, maxX)) continue;
            if (!slab(origin.y, dir.y, minY, maxY)) continue;
            if (!slab(origin.z, dir.z, minZ, maxZ)) continue;
            if (t0 < bestT) {
                bestT = t0;
                best = { mob: m, dist: t0 };
            }
        }
        return best;
    }

    count() {
        const c = { sheep: 0, cow: 0, pig: 0, chicken: 0 };
        for (const m of this.mobs) c[m.type]++;
        return c;
    }
}

export { TYPES as MOB_TYPES, GROUP };
