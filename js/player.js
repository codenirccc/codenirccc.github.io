import * as THREE from 'three';
import { WORLD_H, CHUNK } from './world.js';
import * as B from './blocks.js';

const WIDTH = 0.62;
const HEIGHT = 1.78;
const EYE = 1.62;

export class Player {
    constructor(world, camera) {
        this.world = world;
        this.camera = camera;
        this.pos = new THREE.Vector3(0.5, 80, 0.5);
        this.vel = new THREE.Vector3();
        this.yaw = 0;
        this.pitch = 0;
        this.onGround = false;
        this.flying = true;
        this.sprinting = false;
        this.inWater = false;
        this.headInWater = false;
        this.bob = 0;
        this.reach = 5.2;
        this.walkSpeed = 4.4;
        this.flySpeed = 11;
        this.sneak = false;
        this.stepDistance = 0;
        this.lastStepSound = 0;
        this.breakTarget = null;
        this.placeTarget = null;
    }

    setPosition(x, y, z) {
        this.pos.set(x, y, z);
        this.vel.set(0, 0, 0);
    }

    get eyeY() {
        return this.pos.y + EYE - (this.sneak ? 0.22 : 0);
    }

    eyePosition(out) {
        return (out || new THREE.Vector3()).set(this.pos.x, this.eyeY, this.pos.z);
    }

    bobAmount() {
        if (this.flying) return 0;
        if (!this.onGround) return 0;
        const sp = Math.hypot(this.vel.x, this.vel.z);
        return Math.min(1, sp / this.walkSpeed);
    }

    updateCamera() {
        this.camera.position.copy(this.eyePosition());
        this.camera.rotation.set(0, 0, 0);
        this.camera.rotateY(-this.yaw);
        this.camera.rotateX(this.pitch);

        const amt = this.bobAmount();
        if (amt > 0.001) {
            const t = this.bob;
            this.camera.position.y += Math.sin(t * 2) * 0.055 * amt;
            this.camera.position.x += Math.cos(t) * 0.045 * amt * Math.cos(this.yaw);
            this.camera.position.z -= Math.cos(t) * 0.045 * amt * Math.sin(this.yaw);
            this.camera.rotateX(Math.sin(t * 2 + 0.6) * 0.016 * amt);
            this.camera.rotateY(Math.cos(t) * 0.02 * amt);
            this.camera.rotateZ(Math.cos(t) * 0.022 * amt);
        } else if (this.flying && Math.hypot(this.vel.x, this.vel.z) > 0.4) {
            const t = this.bob * 0.6;
            this.camera.rotateZ(Math.sin(t) * 0.008);
        }
    }

    look(dx, dy, sens) {
        this.yaw += dx * sens;
        this.pitch -= dy * sens;
        const lim = Math.PI / 2 - 0.001;
        this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
        this.yaw = ((this.yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    }

    solidAt(x, y, z) {
        if (y < 0) return true;
        if (y >= WORLD_H) return false;
        const id = this.world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
        return B.isSolid(id);
    }

    boxCollides(px, py, pz) {
        const hw = WIDTH / 2;
        const x0 = Math.floor(px - hw), x1 = Math.floor(px + hw);
        const y0 = Math.floor(py), y1 = Math.floor(py + HEIGHT - 0.001);
        const z0 = Math.floor(pz - hw), z1 = Math.floor(pz + hw);
        for (let x = x0; x <= x1; x++) {
            for (let y = y0; y <= y1; y++) {
                for (let z = z0; z <= z1; z++) {
                    if (this.solidAt(x, y, z)) return true;
                }
            }
        }
        return false;
    }

    blockHere() {
        const x = Math.floor(this.pos.x);
        const y = Math.floor(this.pos.y + 0.1);
        const z = Math.floor(this.pos.z);
        return this.world.getBlock(x, y, z);
    }

    update(dt, input) {
        const sin = Math.sin(this.yaw);
        const cos = Math.cos(this.yaw);
        let fx = 0, fz = 0;
        if (input.forward) { fx += sin; fz -= cos; }
        if (input.back) { fx -= sin; fz += cos; }
        if (input.right) { fx += cos; fz += sin; }
        if (input.left) { fx -= cos; fz -= sin; }
        const len = Math.hypot(fx, fz);
        if (len > 0) {
            fx /= len;
            fz /= len;
        }

        const water = this.checkWater();
        this.inWater = water;
        this.headInWater = this.solidBlockAtEye() ? false : this.liquidAtEye();

        const sneakFactor = this.sneak && this.onGround ? 0.35 : 1;
        const speed = this.flying
            ? this.flySpeed * (this.sprinting ? 2.1 : 1) * sneakFactor
            : this.walkSpeed * (this.sprinting ? 1.55 : 1) * sneakFactor * (water ? 0.6 : 1);

        const target = new THREE.Vector3(fx * speed, 0, fz * speed);
        if (this.flying) {
            let vy = 0;
            if (input.jump) vy += speed;
            if (input.sneak) vy -= speed;
            target.y = vy;
            const accel = 12;
            this.vel.lerp(target, Math.min(1, accel * dt));
        } else {
            const accel = this.onGround ? 14 : 4;
            this.vel.x += (target.x - this.vel.x) * Math.min(1, accel * dt);
            this.vel.z += (target.z - this.vel.z) * Math.min(1, accel * dt);
            if (water) {
                this.vel.y -= 6 * dt;
                if (input.jump) this.vel.y = 4.2;
                this.vel.y = Math.max(-4, this.vel.y);
            } else {
                this.vel.y -= 26 * dt;
                if (input.jump && this.onGround) {
                    this.vel.y = 8.4;
                    this.onGround = false;
                }
                this.vel.y = Math.max(this.vel.y, -48);
            }
        }

        const step = this.move(this.vel.x * dt, this.vel.y * dt, this.vel.z * dt);
        const horizontal = Math.hypot(step.x, step.z);
        this.stepDistance += horizontal;

        const moving = len > 0 && (this.onGround || this.flying || water);
        if (moving) {
            const cadence = this.flying ? 7.5 : 9.4 * (this.sprinting ? 1.25 : 1);
            this.bob += dt * cadence;
        } else {
            this.bob += dt * 0.6;
        }

        if (this.pos.y < -12) {
            const s = this.world.findSpawn();
            this.setPosition(s.x, s.y + 2, s.z);
        }
    }

    move(dx, dy, dz) {
        const res = { x: 0, y: 0, z: 0 };
        const p = this.pos;

        if (dx !== 0) {
            const nx = p.x + dx;
            if (!this.boxCollides(nx, p.y, p.z)) {
                p.x = nx;
                res.x = dx;
            } else {
                this.vel.x = 0;
            }
        }
        if (dz !== 0) {
            const nz = p.z + dz;
            if (!this.boxCollides(p.x, p.y, nz)) {
                p.z = nz;
                res.z = dz;
            } else {
                this.vel.z = 0;
            }
        }
        if (dy !== 0) {
            const ny = p.y + dy;
            if (!this.boxCollides(p.x, ny, p.z)) {
                p.y = ny;
                res.y = dy;
                if (dy < 0) this.onGround = false;
            } else {
                if (dy < 0) this.onGround = true;
                this.vel.y = 0;
                if (this.flying) this.flyLock = true;
            }
        }

        if (this.flying) this.onGround = false;
        else if (!this.boxCollides(p.x, p.y - 0.02, p.z)) this.onGround = false;
        return res;
    }

    checkWater() {
        const hw = WIDTH / 2;
        const y0 = this.pos.y + 0.1;
        const y1 = this.pos.y + 0.9;
        const x0 = Math.floor(this.pos.x - hw), x1 = Math.floor(this.pos.x + hw);
        const z0 = Math.floor(this.pos.z - hw), z1 = Math.floor(this.pos.z + hw);
        for (let x = x0; x <= x1; x++) {
            for (let y = Math.floor(y0); y <= Math.floor(y1); y++) {
                for (let z = z0; z <= z1; z++) {
                    if (B.isLiquid(this.world.getBlock(x, y, z))) return true;
                }
            }
        }
        return false;
    }

    liquidAtEye() {
        const id = this.world.getBlock(
            Math.floor(this.pos.x),
            Math.floor(this.eyeY),
            Math.floor(this.pos.z)
        );
        return B.isLiquid(id);
    }

    solidBlockAtEye() {
        return this.solidAt(Math.floor(this.pos.x), Math.floor(this.eyeY), Math.floor(this.pos.z));
    }

    raycast(maxDist) {
        const origin = this.eyePosition();
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
        let x = Math.floor(origin.x);
        let y = Math.floor(origin.y);
        let z = Math.floor(origin.z);
        const stepX = dir.x > 0 ? 1 : -1;
        const stepY = dir.y > 0 ? 1 : -1;
        const stepZ = dir.z > 0 ? 1 : -1;
        const tDeltaX = Math.abs(1 / (dir.x || 1e-9));
        const tDeltaY = Math.abs(1 / (dir.y || 1e-9));
        const tDeltaZ = Math.abs(1 / (dir.z || 1e-9));
        let tMaxX = boundaryDist(origin.x, dir.x, x, stepX);
        let tMaxY = boundaryDist(origin.y, dir.y, y, stepY);
        let tMaxZ = boundaryDist(origin.z, dir.z, z, stepZ);
        let nx = 0, ny = 0, nz = 0;
        let t = 0;
        for (let i = 0; i < 200; i++) {
            const id = this.world.getBlock(x, y, z);
            if (id !== 0 && !B.isLiquid(id)) {
                return { x, y, z, nx, ny, nz, id, dist: t };
            }
            if (tMaxX < tMaxY && tMaxX < tMaxZ) {
                x += stepX;
                t = tMaxX;
                tMaxX += tDeltaX;
                nx = -stepX; ny = 0; nz = 0;
            } else if (tMaxY < tMaxZ) {
                y += stepY;
                t = tMaxY;
                tMaxY += tDeltaY;
                nx = 0; ny = -stepY; nz = 0;
            } else {
                z += stepZ;
                t = tMaxZ;
                tMaxZ += tDeltaZ;
                nx = 0; ny = 0; nz = -stepZ;
            }
            if (t > maxDist) break;
        }
        return null;
    }

    canPlaceAt(x, y, z) {
        const hw = WIDTH / 2;
        const bx0 = this.pos.x - hw, bx1 = this.pos.x + hw;
        const by0 = this.pos.y, by1 = this.pos.y + HEIGHT;
        const bz0 = this.pos.z - hw, bz1 = this.pos.z + hw;
        return !(x + 1 > bx0 && x < bx1 && y + 1 > by0 && y < by1 && z + 1 > bz0 && z < bz1);
    }
}

function boundaryDist(p, d, cell, step) {
    if (d === 0) return Infinity;
    const next = step > 0 ? cell + 1 : cell;
    return (next - p) / d;
}

export { WIDTH, HEIGHT, EYE, CHUNK };
