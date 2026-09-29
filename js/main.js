import * as THREE from 'three';
import { buildAtlas, TILE } from './textures.js';
import * as B from './blocks.js';
import { World, CHUNK, WORLD_H, SEA } from './world.js';
import { Mesher } from './mesher.js';
import { Environment } from './env.js';
import { Player } from './player.js';
import { HandView } from './hand.js';
import { MobManager } from './mobs.js';
import { Hud } from './hud.js';
import { initAudio, resumeAudio, setVolume, sfx } from './audio.js';
import { blockIcon } from './icons.js';
import * as Save from './storage.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x8fc0f0);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.08, 1400);

const ambient = new THREE.HemisphereLight(0xcfe6ff, 0x4a4436, 0.85);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xfff2d0, 1.15);
scene.add(sun);
scene.add(sun.target);

const atlas = buildAtlas();
const layerNames = atlas.names;
const depth = layerNames.length;
const texData = new Uint8Array(TILE * TILE * 4 * depth);
for (let i = 0; i < depth; i++) {
    texData.set(atlas.data[layerNames[i]], i * TILE * TILE * 4);
}
const arrayTex = new THREE.DataArrayTexture(texData, TILE, TILE, depth);
arrayTex.format = THREE.RGBAFormat;
arrayTex.type = THREE.UnsignedByteType;
arrayTex.magFilter = THREE.NearestFilter;
arrayTex.minFilter = THREE.NearestMipmapLinearFilter;
arrayTex.generateMipmaps = true;
arrayTex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
arrayTex.colorSpace = THREE.SRGBColorSpace;
arrayTex.needsUpdate = true;

const terrainMat = new THREE.MeshBasicMaterial({ vertexColors: true });
terrainMat.onBeforeCompile = (shader) => {
    shader.uniforms.uAtlas = { value: arrayTex };
    shader.uniforms.uUnderwater = { value: 0 };
    shader.uniforms.uSkyLight = { value: 1 };
    shader.uniforms.uNightTint = { value: new THREE.Color(0xffffff) };
    shader.vertexShader = shader.vertexShader
        .replace(
            '#include <common>',
            `#include <common>
            attribute float layer;
            attribute float skylight;
            varying float vLayerIdx;
            varying vec2 vAtlasUv;
            varying float vSky;`
        )
        .replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
            vLayerIdx = layer;
            vAtlasUv = uv;
            vSky = skylight;`
        );
    shader.fragmentShader = shader.fragmentShader
        .replace(
            '#include <common>',
            `#include <common>
            uniform sampler2DArray uAtlas;
            uniform float uUnderwater;
            uniform float uSkyLight;
            uniform vec3 uNightTint;
            varying float vLayerIdx;
            varying vec2 vAtlasUv;
            varying float vSky;`
        )
        .replace(
            '#include <color_fragment>',
            `#include <color_fragment>
            vec4 atlasSample = texture(uAtlas, vec3(vAtlasUv, vLayerIdx));
            vec3 blockColor = atlasSample.rgb;
            float lit = clamp(vSky * uSkyLight, 0.0, 1.0);
            lit = mix(lit, lit * 0.92 + 0.08, step(0.999, lit));
            vec3 skyTint = mix(uNightTint, vec3(1.0), lit);
            diffuseColor.rgb *= blockColor * skyTint * mix(0.35, 1.0, lit);
            if (uUnderwater > 0.5) {
                diffuseColor.rgb = mix(diffuseColor.rgb * vec3(0.34, 0.64, 1.0), vec3(0.05, 0.22, 0.5), 0.35);
            }`
        )
        .replace(
            '#include <fog_fragment>',
            `#ifdef USE_FOG
            #ifdef FOG_EXP2
            float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
            #else
            float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
            #endif
            vec3 fogTint = mix(fogColor, vec3(0.07, 0.30, 0.62), uUnderwater * 0.9);
            gl_FragColor.rgb = mix(gl_FragColor.rgb, fogTint, fogFactor);
            #endif`
        );
    terrainMat.userData.shader = shader;
};

const waterMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
});
waterMat.onBeforeCompile = (shader) => {
    shader.uniforms.uAtlas = { value: arrayTex };
    shader.uniforms.uTime = { value: 0 };
    shader.vertexShader = shader.vertexShader
        .replace(
            '#include <common>',
            `#include <common>
            attribute float layer;
            attribute float skylight;
            uniform float uTime;
            varying float vLayerIdx;
            varying vec2 vAtlasUv;
            varying float vSky;`
        )
        .replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
            vLayerIdx = layer;
            vAtlasUv = uv;
            vSky = skylight;
            if (transformed.y > 0.0) {
                float w = sin(position.x * 0.7 + uTime * 1.6) * 0.5 + sin(position.z * 0.9 - uTime * 1.2) * 0.5;
                transformed.y += w * 0.045;
            }`
        );
    shader.fragmentShader = shader.fragmentShader
        .replace(
            '#include <common>',
            `#include <common>
            uniform sampler2DArray uAtlas;
            varying float vLayerIdx;
            varying vec2 vAtlasUv;
            varying float vSky;`
        )
        .replace(
            '#include <color_fragment>',
            `#include <color_fragment>
            vec4 ws = texture(uAtlas, vec3(vAtlasUv, vLayerIdx));
            float wl = clamp(vSky, 0.0, 1.0);
            diffuseColor.rgb *= ws.rgb * vec3(0.42, 0.62, 0.95) * (0.45 + wl * 0.55);`
        );
    waterMat.userData.shader = shader;
};

const layerIndex = new Map(layerNames.map((n, i) => [n, i]));
const mesher = new Mesher(null, layerIndex);
mesher.tex = {
    indexOf(name) {
        const v = layerIndex.get(name);
        return v === undefined ? 0 : v;
    },
};

let seed = (Math.random() * 2147483647) | 0;
const saved = Save.load();
if (saved && saved.seed !== undefined) seed = saved.seed | 0;

const world = new World(seed);
mesher.world = world;

const env = new Environment(scene, renderer);
const player = new Player(world, camera);
const hand = new HandView(camera, scene, arrayTex, (n) => {
    const v = layerIndex.get(n);
    return v === undefined ? 0 : v;
});
const mobs = new MobManager(world, scene);
const hud = new Hud();

const selectionBox = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)),
    new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45 })
);
selectionBox.visible = false;
scene.add(selectionBox);

const breakBox = new THREE.Mesh(
    new THREE.BoxGeometry(1.01, 1.01, 1.01),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12 })
);
breakBox.visible = false;
scene.add(breakBox);

const MAX_PARTICLES = 320;
const particleGeo = new THREE.BoxGeometry(0.13, 0.13, 0.13);
const particleMesh = new THREE.InstancedMesh(
    particleGeo,
    new THREE.MeshBasicMaterial({ vertexColors: true }),
    MAX_PARTICLES
);
particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
particleMesh.frustumCulled = false;
particleMesh.count = 0;
particleMesh.setColorAt(0, new THREE.Color(1, 1, 1));
scene.add(particleMesh);

const particles = [];
const pMat = new THREE.Matrix4();
const pQuat = new THREE.Quaternion();
const pEuler = new THREE.Euler();
const pScale = new THREE.Vector3(1, 1, 1);
const pPos = new THREE.Vector3();
const tintCache = new Map();

function blockTint(blockId) {
    if (tintCache.has(blockId)) return tintCache.get(blockId);
    const block = B.byId(blockId);
    const tile = block.all || block.side || 'stone';
    const c = new THREE.Color(0.6, 0.6, 0.6);
    const px = atlas.data[tile];
    if (px) {
        let r = 0, g = 0, b = 0;
        for (let i = 0; i < 64; i++) {
            const o = (i * 17) * 4;
            r += px[o];
            g += px[o + 1];
            b += px[o + 2];
        }
        c.setRGB((r / 64) / 255, (g / 64) / 255, (b / 64) / 255);
    }
    tintCache.set(blockId, c);
    return c;
}

function spawnBreakParticles(x, y, z, blockId, count = 14) {
    if (!blockId) return;
    const base = blockTint(blockId);
    for (let i = 0; i < count; i++) {
        if (particles.length >= MAX_PARTICLES) particles.shift();
        particles.push({
            pos: new THREE.Vector3(x + Math.random(), y + Math.random(), z + Math.random()),
            vel: new THREE.Vector3((Math.random() - 0.5) * 3.4, Math.random() * 3.6, (Math.random() - 0.5) * 3.4),
            spin: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8),
            rot: new THREE.Euler(0, 0, 0),
            color: base.clone().multiplyScalar(0.65 + Math.random() * 0.55),
            life: 0.55 + Math.random() * 0.5,
        });
    }
}

function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        p.vel.y -= 16 * dt;
        p.pos.addScaledVector(p.vel, dt);
        p.rot.x += p.spin.x * dt;
        p.rot.y += p.spin.y * dt;
        p.rot.z += p.spin.z * dt;
        if (p.pos.y < 0) p.pos.y = 0;
        if (p.life <= 0) particles.splice(i, 1);
    }

    const n = Math.min(particles.length, MAX_PARTICLES);
    for (let i = 0; i < n; i++) {
        const p = particles[i];
        pEuler.copy(p.rot);
        pQuat.setFromEuler(pEuler);
        pPos.copy(p.pos);
        pMat.compose(pPos, pQuat, pScale);
        particleMesh.setMatrixAt(i, pMat);
        particleMesh.setColorAt(i, p.color);
    }
    particleMesh.count = n;
    if (n > 0) {
        particleMesh.instanceMatrix.needsUpdate = true;
        if (particleMesh.instanceColor) particleMesh.instanceColor.needsUpdate = true;
    }
}

const input = {
    forward: false,
    back: false,
    left: false,
    right: false,
    jump: false,
    sneak: false,
};

const settings = Object.assign(
    { render: 7, fov: 75, sens: 1, daySpeed: 1, vol: 0.5 },
    saved && saved.settings ? saved.settings : {}
);
let paused = true;
let started = false;
let showDebug = false;
let lastSpaceTap = 0;
let lastWTap = 0;
let breaking = false;
let breakingKey = '';
let breakProgress = 0;
let placeCooldown = 0;
let target = null;

camera.fov = settings.fov;
camera.updateProjectionMatrix();
env.daySpeed = (1 / 600) * settings.daySpeed;
env.setFogDistance(settings.render * CHUNK * 0.92);
setVolume(settings.vol);

if (saved && saved.player) {
    player.setPosition(saved.player.x, saved.player.y, saved.player.z);
    player.yaw = saved.player.yaw || 0;
    player.pitch = saved.player.pitch || 0;
    player.flying = saved.player.flying !== false;
} else {
    const s = world.findSpawn();
    player.setPosition(s.x, s.y + 1, s.z);
}
if (saved && saved.envTime) env.setTime(saved.envTime);
if (saved && saved.hotbar) {
    saved.hotbar.forEach((id, i) => {
        if (i < 9 && B.byId(id) && id !== 0) hud.setSlot(i, id);
    });
    hud.select(hud.selected, true);
}

let lastSave = performance.now();

function serializeEdits() {
    const out = [];
    for (const [k, map] of world.edits) {
        out.push([k, Array.from(map)]);
    }
    return out;
}

function doSave() {
    Save.save({
        seed: world.seed,
        edits: serializeEdits(),
        settings,
        envTime: env.time,
        player: { x: player.pos.x, y: player.pos.y, z: player.pos.z, yaw: player.yaw, pitch: player.pitch, flying: player.flying },
        hotbar: hud.slots.map((s) => s.id),
    });
}

function applySavedEdits() {
    if (!saved || !saved.edits) return;
    for (const [k, list] of saved.edits) {
        const map = new Map(list);
        world.edits.set(k, map);
    }
}

let queue = [];
let generating = false;

function wantedChunks(r) {
    const pcx = Math.floor(player.pos.x / CHUNK);
    const pcz = Math.floor(player.pos.z / CHUNK);
    const list = [];
    for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
            const d2 = dx * dx + dz * dz;
            if (d2 > (r + 0.5) * (r + 0.5)) continue;
            list.push({ cx: pcx + dx, cz: pcz + dz, d2 });
        }
    }
    list.sort((a, b) => a.d2 - b.d2);
    return list;
}

function chunkReady(c) {
    return [c.cx - 1, c.cx + 1].every((x) => {
        const n = world.getChunk(x, c.cz);
        return !n || n.generated;
    }) && [c.cz - 1, c.cz + 1].every((z) => {
        const n = world.getChunk(c.cx, z);
        return !n || n.generated;
    });
}

function meshChunk(c) {
    if (!chunkReady(c)) {
        c.pending = true;
        return false;
    }
    const data = mesher.build(c);
    const cx = c.cx * CHUNK;
    const cz = c.cz * CHUNK;

    if (c.mesh) {
        scene.remove(c.mesh);
        c.mesh.geometry.dispose();
        c.mesh = null;
    }
    if (c.waterMesh) {
        scene.remove(c.waterMesh);
        c.waterMesh.geometry.dispose();
        c.waterMesh = null;
    }

    if (data.idx.length) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(data.pos, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(data.uv, 2));
        g.setAttribute('layer', new THREE.Float32BufferAttribute(data.layer, 1));
        g.setAttribute('skylight', new THREE.Float32BufferAttribute(data.sky, 1));
        g.setAttribute('color', new THREE.Float32BufferAttribute(data.light, 4));
        g.setIndex(new THREE.Uint32BufferAttribute(data.idx, 1));
        g.computeBoundingSphere();
        const mesh = new THREE.Mesh(g, terrainMat);
        mesh.position.set(cx, 0, cz);
        mesh.renderOrder = 0;
        scene.add(mesh);
        c.mesh = mesh;
    }

    if (data.widx.length) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(data.wpos, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(data.wuv, 2));
        g.setAttribute('layer', new THREE.Float32BufferAttribute(data.wlayer, 1));
        g.setAttribute('skylight', new THREE.Float32BufferAttribute(data.wsky, 1));
        g.setAttribute('color', new THREE.Float32BufferAttribute(data.wlight, 4));
        g.setIndex(new THREE.Uint32BufferAttribute(data.widx, 1));
        g.computeBoundingSphere();
        const mesh = new THREE.Mesh(g, waterMat);
        mesh.position.set(cx, 0, cz);
        mesh.renderOrder = 2;
        scene.add(mesh);
        c.waterMesh = mesh;
    }
    c.dirty = false;
    c.pending = false;
    c.meshed = true;
    return true;
}

function processQueue(budget) {
    if (generating) return;
    generating = true;
    const start = performance.now();
    let count = 0;
    while (queue.length && performance.now() - start < budget) {
        const job = queue.shift();
        count++;
        if (job.type === 'gen') {
            const c = world.ensureChunk(job.cx, job.cz);
            if (!c.generated) {
                world.generateChunk(c);
                world.initLight(c);
            }
        } else if (job.type === 'mesh') {
            const c = world.getChunk(job.cx, job.cz);
            if (c && c.generated) meshChunk(c);
        }
    }
    generating = false;
    return count;
}

function updateQueue() {
    const r = settings.render;
    const want = wantedChunks(r);
    const pcx = Math.floor(player.pos.x / CHUNK);
    const pcz = Math.floor(player.pos.z / CHUNK);
    const wanted = new Set(want.map((w) => w.cx + ',' + w.cz));

    for (const [k, c] of world.chunks) {
        if (!wanted.has(k) && c.mesh) {
            scene.remove(c.mesh);
            c.mesh.geometry.dispose();
            c.mesh = null;
        }
        if (!wanted.has(k) && c.waterMesh) {
            scene.remove(c.waterMesh);
            c.waterMesh.geometry.dispose();
            c.waterMesh = null;
        }
    }

    const need = [];
    for (const w of want) {
        const k = w.cx + ',' + w.cz;
        const c = world.chunks.get(k);
        if (!c || !c.generated) need.push({ type: 'gen', cx: w.cx, cz: w.cz, d2: w.d2, key: k });
        else if (c.dirty || c.pending) need.push({ type: 'mesh', cx: w.cx, cz: w.cz, d2: w.d2, key: k });
    }
    need.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'gen' ? -1 : 1;
        return a.d2 - b.d2;
    });
    queue = need;

    const drop = (r + 3) * (r + 3);
    for (const k of world.chunks.keys()) {
        const [cx, cz] = k.split(',').map(Number);
        const dx = cx - pcx;
        const dz = cz - pcz;
        if (dx * dx + dz * dz > drop) {
            const c = world.chunks.get(k);
            if (c && c.mesh) {
                scene.remove(c.mesh);
                c.mesh.geometry.dispose();
            }
            if (c && c.waterMesh) {
                scene.remove(c.waterMesh);
                c.waterMesh.geometry.dispose();
            }
            world.chunks.delete(k);
        }
    }
    void WORLD_H;
    void SEA;
}

function seedMobs() {
    const types = ['sheep', 'cow', 'pig', 'sheep', 'chicken', 'sheep'];
    for (let i = 0; i < 10; i++) {
        const ang = (i / 10) * Math.PI * 2 + 0.4;
        const dist = 5 + (i % 4) * 3.2;
        const x = Math.floor(player.pos.x + Math.cos(ang) * dist);
        const z = Math.floor(player.pos.z + Math.sin(ang) * dist);
        mobs.spawn(types[i % types.length], x + 0.5, 0, z + 0.5);
    }
    mobs.spawnTimer = 6;
}

function buildPicker() {
    const grid = document.getElementById('pickerGrid');
    grid.innerHTML = '';
    for (const name of B.PALETTE) {
        const b = B.byName(name);
        const el = document.createElement('div');
        el.className = 'pick';
        const img = document.createElement('img');
        img.src = blockIcon(b);
        const lbl = document.createElement('span');
        lbl.textContent = b.label;
        el.appendChild(img);
        el.appendChild(lbl);
        el.addEventListener('click', () => {
            hud.setSlot(hud.selected, b.id);
            sfx.pop();
        });
        grid.appendChild(el);
    }
}

function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.add('hidden'), 1600);
}

function showMenu(show) {
    paused = show;
    document.getElementById('menu').classList.toggle('hidden', !show);
    if (show) doSave();
}

function showPicker(show) {
    document.getElementById('picker').classList.toggle('hidden', !show);
    if (show) {
        paused = true;
        if (document.pointerLockElement) document.exitPointerLock();
    } else if (started) {
        canvas.requestPointerLock();
    }
}

function breakBlock(t) {
    if (!t) return;
    if (!world.setBlock(t.x, t.y, t.z, 0)) return;
    spawnBreakParticles(t.x + 0.5, t.y + 0.5, t.z + 0.5, t.id);
    sfx.break(B.byId(t.id));
    hand.startSwing();
    breakProgress = 0;
}

function placeBlock(t) {
    if (!t) return;
    const x = t.x + t.nx;
    const y = t.y + t.ny;
    const z = t.z + t.nz;
    if (y < 1 || y >= WORLD_H) return;
    const existing = world.getBlock(x, y, z);
    if (existing !== 0 && !B.isLiquid(existing)) return;
    if (!player.canPlaceAt(x, y, z)) return;
    const id = hud.current().id;
    if (world.setBlock(x, y, z, id)) {
        sfx.place(B.byId(id));
        hand.startSwing();
    }
}

function attackMob(hit) {
    const m = hit.mob;
    const c = new THREE.Color(m.def.body);
    for (let i = 0; i < 9; i++) {
        if (particles.length >= MAX_PARTICLES) particles.shift();
        particles.push({
            pos: new THREE.Vector3(m.pos.x, m.pos.y + 0.5, m.pos.z),
            vel: new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 4, (Math.random() - 0.5) * 4),
            spin: new THREE.Vector3(Math.random() * 9, Math.random() * 9, Math.random() * 9),
            rot: new THREE.Euler(0, 0, 0),
            color: c.clone().multiplyScalar(0.7 + Math.random() * 0.5),
            life: 0.65,
        });
    }
    mobs.hit(m, 4, player.pos);
}

canvas.addEventListener('mousedown', (e) => {
    if (!started) return;
    if (paused) return;
    if (!document.pointerLockElement) {
        canvas.requestPointerLock();
        return;
    }
    if (e.button === 0) {
        breaking = true;
        hand.startSwing();
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        const hit = mobs.raycastMob(player.eyePosition(), dir, player.reach);
        if (hit) {
            attackMob(hit);
            breaking = false;
        }
    } else if (e.button === 2) {
        placeBlock(target);
        placeCooldown = 0.22;
    } else if (e.button === 1) {
        if (target) {
            hud.setSlot(hud.selected, target.id);
            toast('Picked ' + B.byId(target.id).label);
        }
    }
});

addEventListener('mouseup', (e) => {
    if (e.button === 0) {
        breaking = false;
        breakProgress = 0;
    }
});

addEventListener('mousemove', (e) => {
    if (!document.pointerLockElement) return;
    player.look(e.movementX, e.movementY, 0.0022 * settings.sens);
});

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

addEventListener('wheel', (e) => {
    if (paused) return;
    hud.scroll(e.deltaY > 0 ? 1 : -1);
}, { passive: true });

const keyMap = {
    KeyW: 'forward', ArrowUp: 'forward',
    KeyS: 'back', ArrowDown: 'back',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
};

addEventListener('keydown', (e) => {
    if (e.repeat) {
        if (keyMap[e.code]) e.preventDefault();
        return;
    }
    if (keyMap[e.code]) {
        input[keyMap[e.code]] = true;
        e.preventDefault();
        if (e.code === 'KeyW') {
            const now = performance.now();
            if (now - lastWTap < 280) {
                player.sprinting = true;
                lastWTap = 0;
            } else {
                lastWTap = now;
            }
        }
    }
    if (e.code === 'Space') {
        input.jump = true;
        e.preventDefault();
        const now = performance.now();
        if (now - lastSpaceTap < 300) {
            player.flying = !player.flying;
            player.vel.y = 0;
            toast(player.flying ? 'Flying' : 'Walking');
            lastSpaceTap = 0;
        } else {
            lastSpaceTap = now;
        }
    }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        input.sneak = true;
        player.sneak = true;
    }
    if (e.code === 'ControlLeft' || e.code === 'ControlRight') player.sprinting = true;
    if (e.code === 'KeyF') {
        player.flying = !player.flying;
        player.vel.y = 0;
        toast(player.flying ? 'Flying' : 'Walking');
    }
    if (e.code === 'KeyE') {
        showPicker(document.getElementById('picker').classList.contains('hidden'));
    }
    if (e.code === 'Escape') {
        if (!document.getElementById('picker').classList.contains('hidden')) showPicker(false);
        else showMenu(!paused);
    }
    if (e.code === 'F3') {
        showDebug = !showDebug;
        document.getElementById('debug').classList.toggle('hidden', !showDebug);
    }
    if (e.code.startsWith('Digit')) {
        const n = parseInt(e.code.slice(5), 10);
        if (n >= 1 && n <= 9) hud.select(n - 1);
    }
    if (e.code === 'KeyR') {
        const s = world.findSpawn();
        player.setPosition(s.x, s.y + 1, s.z);
        toast('Teleported to spawn');
    }
});

addEventListener('keyup', (e) => {
    if (keyMap[e.code]) input[keyMap[e.code]] = false;
    if (e.code === 'Space') input.jump = false;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        input.sneak = false;
        player.sneak = false;
    }
    if (e.code === 'ControlLeft' || e.code === 'ControlRight') player.sprinting = false;
    if (e.code === 'KeyW' && player.sprinting) player.sprinting = false;
});

addEventListener('blur', () => {
    for (const k in input) input[k] = false;
    player.sprinting = false;
    breaking = false;
});

document.addEventListener('pointerlockchange', () => {
    if (!document.pointerLockElement && started && document.getElementById('picker').classList.contains('hidden')) {
        showMenu(true);
    }
});

const settingsBind = [
    ['setRender', 'valRender', 'render', (v) => String(v)],
    ['setFov', 'valFov', 'fov', (v) => String(v)],
    ['setSens', 'valSens', 'sens', (v) => (v / 100).toFixed(2)],
    ['setDay', 'valDay', 'daySpeed', (v) => (v === 0 ? 'off' : (v / 10).toFixed(1) + 'x')],
    ['setVol', 'valVol', 'vol', (v) => String(Math.round(v * 100))],
];

for (const [inputId, valId, key, fmt] of settingsBind) {
    const el = document.getElementById(inputId);
    const val = document.getElementById(valId);
    if (key === 'vol') el.value = Math.round(settings.vol * 100);
    else el.value = settings[key];
    val.textContent = fmt(key === 'vol' ? settings.vol : settings[key]);
    el.addEventListener('input', () => {
        const v = parseFloat(el.value);
        if (key === 'vol') {
            settings.vol = v / 100;
            setVolume(settings.vol);
        } else {
            settings[key] = v;
        }
        val.textContent = fmt(v);
        if (key === 'fov') {
            camera.fov = v;
            camera.updateProjectionMatrix();
        }
        if (key === 'daySpeed') env.daySpeed = v === 0 ? 0 : (1 / 600) * v;
        if (key === 'render') {
            queue = [];
            env.setFogDistance(v * CHUNK * 0.92);
        }
    });
}

document.getElementById('btnResume').addEventListener('click', () => {
    showMenu(false);
    canvas.requestPointerLock();
});
document.getElementById('btnNewWorld').addEventListener('click', () => {
    Save.clear();
    location.reload();
});
document.getElementById('btnHome').addEventListener('click', () => {
    window.open('https://github.com/codenirccc', '_blank', 'noopener');
});
document.getElementById('btnPickerClose').addEventListener('click', () => showPicker(false));

for (const [id, type] of [['btnMobSheep', 'sheep'], ['btnMobCow', 'cow'], ['btnMobPig', 'pig'], ['btnMobChicken', 'chicken']]) {
    document.getElementById(id).addEventListener('click', () => {
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        const tx = Math.floor(player.pos.x + dir.x * 4);
        const tz = Math.floor(player.pos.z + dir.z * 4);
        const ty = world.surfaceY(tx, tz);
        const m = mobs.spawn(type, tx + 0.5, ty + 0.2, tz + 0.5);
        if (m) {
            const c = world.getChunk(Math.floor(tx / CHUNK), Math.floor(tz / CHUNK));
            if (c) c.dirty = true;
            toast('Spawned ' + m.def.label);
        }
    });
}

buildPicker();

addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
});

if ('ontouchstart' in window) {
    document.body.classList.add('touch');
    setupTouch();
}

const stickBase = document.getElementById('stickBase');
const stickKnob = document.getElementById('stickKnob');
let stickId = null;
let lookId = null;
let lookLast = { x: 0, y: 0 };
let stickVec = { x: 0, y: 0 };

function setupTouch() {
    if (paused) showMenu(false);

    stickBase.addEventListener('touchstart', (e) => {
        stickId = e.changedTouches[0].identifier;
        e.preventDefault();
    }, { passive: false });

    addEventListener('touchmove', (e) => {
        for (const t of e.changedTouches) {
            if (t.identifier === stickId) {
                const r = stickBase.getBoundingClientRect();
                const cx = r.left + r.width / 2;
                const cy = r.top + r.height / 2;
                let dx = t.clientX - cx;
                let dy = t.clientY - cy;
                const max = r.width / 2;
                const len = Math.hypot(dx, dy);
                if (len > max) {
                    dx = (dx / len) * max;
                    dy = (dy / len) * max;
                }
                stickVec = { x: dx / max, y: dy / max };
                stickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
                input.forward = stickVec.y < -0.24;
                input.back = stickVec.y > 0.24;
                input.left = stickVec.x < -0.24;
                input.right = stickVec.x > 0.24;
            } else if (t.identifier === lookId) {
                player.look((t.clientX - lookLast.x) * 1.6, (t.clientY - lookLast.y) * 1.6, 0.004 * settings.sens);
                lookLast = { x: t.clientX, y: t.clientY };
            }
        }
    }, { passive: true });

    addEventListener('touchend', (e) => {
        for (const t of e.changedTouches) {
            if (t.identifier === stickId) {
                stickId = null;
                stickVec = { x: 0, y: 0 };
                stickKnob.style.transform = '';
                input.forward = input.back = input.left = input.right = false;
            } else if (t.identifier === lookId) {
                lookId = null;
            }
        }
    });

    canvas.addEventListener('touchstart', (e) => {
        const t = e.changedTouches[0];
        lookId = t.identifier;
        lookLast = { x: t.clientX, y: t.clientY };
    });

    for (const btn of document.querySelectorAll('.tbtn')) {
        const act = btn.dataset.act;
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (act === 'jump') input.jump = true;
            if (act === 'fly') {
                player.flying = !player.flying;
                player.vel.y = 0;
            }
            if (act === 'break') {
                const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
                const hit = mobs.raycastMob(player.eyePosition(), dir, player.reach);
                if (hit) attackMob(hit);
                else breakBlock(target);
            }
            if (act === 'place') placeBlock(target);
        }, { passive: false });
        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            if (act === 'jump') input.jump = false;
        });
    }
}

const clock = new THREE.Clock();
let fps = 60;
let fpsAccum = 0;
let fpsFrames = 0;

function updateDebug() {
    if (!showDebug) return;
    const p = player.pos;
    const counts = mobs.count();
    const mobStr = Object.entries(counts).filter(([, v]) => v > 0).map(([k, v]) => k + ':' + v).join(' ') || 'none';
    const biome = world.biomeAt(Math.floor(p.x), Math.floor(p.z));
    const looking = target ? B.byId(target.id).label : '-';
    document.getElementById('debug').textContent =
        'FPS ' + fps.toFixed(0) +
        '\nXYZ ' + p.x.toFixed(2) + ' / ' + p.y.toFixed(2) + ' / ' + p.z.toFixed(2) +
        '\nChunk ' + Math.floor(p.x / CHUNK) + ', ' + Math.floor(p.z / CHUNK) +
        '\nBiome ' + biome +
        '\nTime ' + env.clockLabel + (env.isNight ? ' (night)' : ' (day)') +
        '\nLooking ' + looking +
        '\nChunks ' + world.chunks.size + ' | mobs ' + mobs.mobs.length + ' [' + mobStr + ']' +
        '\nMode ' + (player.flying ? 'flying' : 'walking') + (player.sprinting ? ' + sprint' : '') +
        '\nLight ' + world.getLight(Math.floor(p.x), Math.floor(p.y + 1), Math.floor(p.z)) +
        '\nSeed ' + world.seed;
}

let rafId = 0;

function frame() {
    rafId = requestAnimationFrame(frame);
    const dt = Math.min(0.05, clock.getDelta());

    fpsAccum += dt;
    fpsFrames++;
    if (fpsAccum >= 0.5) {
        fps = fpsFrames / fpsAccum;
        fpsAccum = 0;
        fpsFrames = 0;
    }

    if (started) {
        if (!paused) {
            player.update(dt, input);
            env.update(dt, player.eyePosition());
        } else {
            env.update(0, player.eyePosition());
        }

        updateQueue();
        processQueue(started && !paused ? 6 : 10);

        player.updateCamera();

        if (!paused) {
            mobs.update(dt, player);
            target = player.raycast(player.reach);
        } else {
            target = null;
        }

        selectionBox.visible = !!target;
        breakBox.visible = false;
        if (target) {
            selectionBox.position.set(target.x + 0.5, target.y + 0.5, target.z + 0.5);
            if (breaking) {
                const key = target.x + ',' + target.y + ',' + target.z;
                if (key !== breakingKey) {
                    breakingKey = key;
                    breakProgress = 0;
                }
                const hard = B.byId(target.id).hardness;
                const rate = 1 / Math.max(0.08, hard) * 1.6;
                breakProgress += dt * rate;
                breakBox.visible = true;
                breakBox.position.copy(selectionBox.position);
                breakBox.material.opacity = 0.1 + Math.sin(breakProgress * 22) * 0.05;
                if (breakProgress >= 1) {
                    breakBlock(target);
                    breakingKey = '';
                }
            }
        } else {
            breakingKey = '';
            breakProgress = 0;
        }

        placeCooldown = Math.max(0, placeCooldown - dt);
        if (!paused && input.forward === false && hand.swinging === false) void 0;

        hand.setBlock(hud.current().id);
        hand.setLight(0.55 + env.dayAmount * 0.45);
        hand.update(dt, player, breaking);

        if (player.stepDistance > 1.9 && player.onGround) {
            player.stepDistance = 0;
            const below = world.getBlock(Math.floor(player.pos.x), Math.floor(player.pos.y - 0.4), Math.floor(player.pos.z));
            if (below) sfx.step(B.byId(below));
        }

        updateParticles(dt);

        const dayF = env.dayAmount;
        ambient.intensity = 0.22 + dayF * 0.72;
        sun.intensity = 0.06 + dayF * 1.2;
        sun.position.copy(env.sunDir).multiplyScalar(100).add(player.pos);
        sun.target.position.copy(player.pos);
        sun.target.updateMatrixWorld();
        sun.color.setHSL(0.11, 0.35 + (1 - dayF) * 0.3, 0.5 + dayF * 0.2);
        ambient.color.setHSL(0.58, 0.35, 0.2 + dayF * 0.55);
        ambient.groundColor.setHSL(0.1, 0.25, 0.08 + dayF * 0.28);

        const tu = terrainMat.userData.shader;
        if (tu) {
            tu.uniforms.uUnderwater.value = player.headInWater ? 1 : 0;
            tu.uniforms.uSkyLight.value = env.skyLight;
            tu.uniforms.uNightTint.value.copy(env.nightTint);
        }
        if (waterMat.userData.shader) {
            waterMat.userData.shader.uniforms.uTime.value += dt;
        }

        renderer.render(scene, camera);
        updateDebug();

        if (performance.now() - lastSave > 20000) {
            lastSave = performance.now();
            doSave();
        }
    }
}

const loadBar = document.getElementById('loadBar');
const loadText = document.getElementById('loadText');
const playBtn = document.getElementById('playBtn');
const loading = document.getElementById('loading');

function applyEditsTo(c) {
    const map = world.edits.get(c.cx + ',' + c.cz);
    if (!map || !map.size) return;
    for (const [i, id] of map) c.blocks[i] = id;
    world.computeHeight(c);
}

function preGenerate() {
    const r = Math.min(4, settings.render);
    const want = wantedChunks(r).filter((w) => {
        const c = world.chunks.get(w.cx + ',' + w.cz);
        return !c || !c.generated;
    });

    if (!want.length) {
        for (const [, c] of world.chunks) {
            if (!c.generated) continue;
            applyEditsTo(c);
            meshChunk(c);
        }
        finishLoad();
        return;
    }

    applySavedEdits();

    const total = want.length;
    let i = 0;
    const pending = want.slice();

    const genStep = () => {
        const t = performance.now();
        while (i < total && performance.now() - t < 24) {
            const w = pending[i++];
            const c = world.ensureChunk(w.cx, w.cz);
            if (!c.generated) {
                world.generateChunk(c);
                world.initLight(c);
            }
        }
        const pct = Math.round(((i * 0.75) / total) * 100);
        loadBar.style.width = pct + '%';
        loadText.textContent = 'Building world ' + pct + '%';
        if (i < total) {
            requestAnimationFrame(genStep);
        } else {
            loadText.textContent = 'Lighting terrain';
            requestAnimationFrame(meshStep);
        }
    };

    const meshStep = () => {
        const t = performance.now();
        let done = 0;
        let passes = 0;
        while (done < total && performance.now() - t < 24) {
            done = 0;
            passes = 0;
            for (let i = 0; i < total; i++) {
                const w = pending[i];
                const c = world.getChunk(w.cx, w.cz);
                if (!c || !c.generated) continue;
                if (c.meshed && !c.dirty) {
                    done++;
                    continue;
                }
                if (c.dirty && passes > 1) {
                    done++;
                    continue;
                }
                applyEditsTo(c);
                meshChunk(c);
                if (c.meshed) done++;
            }
            passes++;
        }
        const pct = 75 + Math.round((done / total) * 25);
        loadBar.style.width = pct + '%';
        if (done < total) {
            requestAnimationFrame(meshStep);
        } else {
            finishLoad();
        }
    };

    requestAnimationFrame(genStep);
}

function finishLoad() {
    loadBar.style.width = '100%';
    loadText.textContent = 'Ready';
    playBtn.hidden = false;
    playBtn.addEventListener('click', () => {
        initAudio();
        resumeAudio();
        loading.classList.add('gone');
        started = true;
        paused = false;
        seedMobs();
        if (innerWidth > 700) canvas.requestPointerLock();
    });
}

frame();
preGenerate();

addEventListener('beforeunload', doSave);

window.game = {
    world,
    player,
    env,
    mobs,
    hud,
    settings,
    look(pitch, yaw) {
        if (pitch !== undefined) player.pitch = pitch;
        if (yaw !== undefined) player.yaw = yaw;
    },
    setTime(t) {
        env.setTime(t);
    },
    spawn(type) {
        const d = new THREE.Vector3();
        camera.getWorldDirection(d);
        const x = Math.floor(player.pos.x + d.x * 5);
        const z = Math.floor(player.pos.z + d.z * 5);
        return mobs.spawn(type, x + 0.5, world.surfaceY(x, z), z + 0.5);
    },
    stats() {
        const chunks = Array.from(world.chunks.values());
        return {
            fps: Math.round(fps),
            chunks: chunks.length,
            built: chunks.filter((c) => c.mesh).length,
            queued: queue.length,
            mobs: mobs.mobs.length,
            pos: [player.pos.x, player.pos.y, player.pos.z].map(Math.round),
            biome: world.biomeAt(Math.floor(player.pos.x), Math.floor(player.pos.z)),
            time: env.clockLabel,
            target: target ? B.byId(target.id).name : null,
            triangles: renderer.info.render.triangles,
            edits: world.edits.size,
        };
    },
};

