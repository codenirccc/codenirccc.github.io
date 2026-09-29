import * as THREE from 'three';
import { textureCanvas } from './textures.js';
import * as B from './blocks.js';

const FACE_BASIS = [
    { rx: Math.PI / 2, ry: 0, pos: [0.5, 0, 0], roll: 0 },
    { rx: -Math.PI / 2, ry: 0, pos: [-0.5, 0, 0], roll: 0 },
    { rx: 0, ry: 0, pos: [0, 0.5, 0], roll: Math.PI / 2 },
    { rx: Math.PI, ry: 0, pos: [0, -0.5, 0], roll: Math.PI / 2 },
    { rx: 0, ry: 0, pos: [0, 0, 0.5], roll: 0 },
    { rx: 0, ry: Math.PI, pos: [0, 0, -0.5], roll: 0 },
];

export class HandView {
    constructor(camera, scene, arrayTex, layerIndex) {
        this.camera = camera;
        this.arrayTex = arrayTex;
        this.layerIndex = layerIndex;
        this.group = new THREE.Group();
        this.group.matrixAutoUpdate = true;
        this.block = null;
        this.current = -1;
        this.swing = 0;
        this.swinging = false;
        this.equipAnim = 0;
        this.base = new THREE.Vector3(0.44, -0.4, -0.62);

        this.material = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
        this.material.onBeforeCompile = (shader) => {
            shader.uniforms.uAtlas = { value: arrayTex };
            shader.uniforms.uLight = { value: 1 };
            shader.vertexShader = shader.vertexShader
                .replace(
                    '#include <common>',
                    `#include <common>
                    attribute float layer;
                    varying float vLayerIdx;
                    varying vec2 vAtlasUv;`
                )
                .replace(
                    '#include <begin_vertex>',
                    `#include <begin_vertex>
                    vLayerIdx = layer;
                    vAtlasUv = uv;`
                );
            shader.fragmentShader = shader.fragmentShader
                .replace(
                    '#include <common>',
                    `#include <common>
                    uniform sampler2DArray uAtlas;
                    uniform float uLight;
                    varying float vLayerIdx;
                    varying vec2 vAtlasUv;`
                )
                .replace(
                    '#include <color_fragment>',
                    `#include <color_fragment>
                    vec4 hs = texture(uAtlas, vec3(vAtlasUv, vLayerIdx));
                    diffuseColor.rgb *= hs.rgb * uLight;`
                );
            this.material.userData.shader = shader;
        };

        camera.add(this.group);
        scene.add(camera);
        this.geo = new THREE.BufferGeometry();
        this.geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(24 * 3), 3));
        this.geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(24 * 2), 2));
        this.geo.setAttribute('layer', new THREE.Float32BufferAttribute(new Float32Array(24), 1));
        this.geo.setIndex(new THREE.Uint32BufferAttribute(new Uint32Array(36), 1));
        this.mesh = new THREE.Mesh(this.geo, this.material);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = 10;
        this.group.add(this.mesh);
    }

    buildCube(block) {
        const pos = this.geo.attributes.position.array;
        const uv = this.geo.attributes.uv.array;
        const lay = this.geo.attributes.layer.array;
        const idx = this.geo.index.array;
        const side = block.side || block.all || 'stone';
        const top = block.top || side;
        const bottom = block.bottom || side;
        const tiles = [side, side, top, bottom, side, side];
        const s = 0.5;
        let v = 0;
        for (let f = 0; f < 6; f++) {
            const b = FACE_BASIS[f];
            const n = b.pos;
            const right = new THREE.Vector3()
                .crossVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(n[0], n[1], n[2]))
                .normalize();
            if (!Number.isFinite(right.x)) right.set(1, 0, 0);
            const realUp = new THREE.Vector3()
                .crossVectors(new THREE.Vector3(n[0], n[1], n[2]), right)
                .normalize();
            if (!Number.isFinite(realUp.x)) realUp.set(0, 1, 0);
            const layer = this.layerIndex(tiles[f]);
            for (const [cu, cv] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
                const sx = cu === 0 ? -s : s;
                const sy = cv === 0 ? -s : s;
                pos[v * 3] = n[0] + right.x * sx + realUp.x * sy;
                pos[v * 3 + 1] = n[1] + right.y * sx + realUp.y * sy;
                pos[v * 3 + 2] = n[2] + right.z * sx + realUp.z * sy;
                uv[v * 2] = cu;
                uv[v * 2 + 1] = 1 - cv;
                lay[v] = layer;
                v++;
            }
            const b0 = f * 4;
            idx[f * 6] = b0;
            idx[f * 6 + 1] = b0 + 1;
            idx[f * 6 + 2] = b0 + 2;
            idx[f * 6 + 3] = b0;
            idx[f * 6 + 4] = b0 + 2;
            idx[f * 6 + 5] = b0 + 3;
        }
        this.geo.attributes.position.needsUpdate = true;
        this.geo.attributes.uv.needsUpdate = true;
        this.geo.attributes.layer.needsUpdate = true;
        this.geo.index.needsUpdate = true;
        this.geo.computeBoundingSphere();
    }

    setBlock(id) {
        if (this.current === id) return;
        this.current = id;
        const block = id ? B.byId(id) : null;
        if (!block) {
            this.mesh.visible = false;
            return;
        }
        this.mesh.visible = true;
        this.buildCube(block);
        this.equipAnim = 1;
    }

    startSwing() {
        this.swinging = true;
        this.swing = 0;
    }

    setLight(v) {
        const sh = this.material.userData.shader;
        if (sh) sh.uniforms.uLight.value = v;
    }

    update(dt, player, mouseDown) {
        if (this.swinging) {
            this.swing += dt * 4.4;
            if (this.swing >= 1) {
                this.swing = 0;
                this.swinging = mouseDown;
            }
        }
        if (this.equipAnim > 0) this.equipAnim = Math.max(0, this.equipAnim - dt * 3.4);

        const amt = player.bobAmount();
        const moving = Math.hypot(player.vel.x, player.vel.z) > 0.4;
        const active = Math.max(amt, player.flying && moving ? 0.5 : 0);
        this.bob = (this.bob || 0) + dt * (active > 0.02 ? 9.4 : 1.2);
        const t = this.bob;

        let x = this.base.x;
        let y = this.base.y;
        let z = this.base.z;
        let rx = 0.08;
        let ry = -0.6;
        let rz = 0.12;

        if (active > 0.02) {
            x += Math.cos(t) * 0.03 * active;
            y -= Math.abs(Math.sin(t)) * 0.024 * active;
            z += Math.sin(t * 2) * 0.016 * active;
            rx += Math.sin(t * 2) * 0.1 * active;
            rz -= Math.cos(t) * 0.055 * active;
        }

        if (player.pitch < 0) {
            y += player.pitch * 0.16;
            rx += player.pitch * 0.7;
        } else {
            y -= player.pitch * 0.06;
            rx += player.pitch * 0.3;
        }

        const sw = this.swinging ? Math.sin(Math.pow(this.swing, 0.6) * Math.PI) : 0;
        y -= sw * 0.24;
        z += sw * 0.14;
        rx -= sw * 1.2;
        rz += sw * 0.28;

        if (this.equipAnim > 0) {
            const e = this.equipAnim;
            y -= (1 - e) * 0.55;
            rx += (1 - e) * 1;
        }

        this.group.position.set(x, y, z);
        this.group.rotation.set(rx, ry, rz);
        this.mesh.scale.setScalar(0.3);
    }
}
