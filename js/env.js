import * as THREE from 'three';

function pixelTexture(size, draw) {
    const cv = document.createElement('canvas');
    cv.width = size;
    cv.height = size;
    const cx = cv.getContext('2d');
    cx.imageSmoothingEnabled = false;
    draw(cx, size);
    const t = new THREE.CanvasTexture(cv);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

const SKY_VERT = `
varying vec3 vDir;
void main() {
    vDir = normalize(position);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_Position.z = gl_Position.w;
}`;

const SKY_FRAG = `
#include <common>
uniform vec3 uTop;
uniform vec3 uMid;
uniform vec3 uBottom;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uSunStrength;
varying vec3 vDir;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 col;
    if (h > 0.0) {
        col = mix(uMid, uTop, pow(clamp(h, 0.0, 1.0), 0.65));
    } else {
        col = mix(uMid, uBottom, pow(clamp(-h, 0.0, 1.0), 0.5));
    }
    float sun = max(dot(d, normalize(uSunDir)), 0.0);
    float glow = pow(sun, 8.0) * 0.55 + pow(sun, 64.0) * 0.9;
    float horizon = exp(-abs(h) * 7.0);
    col += uSunColor * (glow + horizon * sun * 0.35) * uSunStrength;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
}`;

function buildVoxelDisc(count, color, size, thickness) {
    const geo = new THREE.BoxGeometry(size, size, thickness);
    const mat = new THREE.MeshBasicMaterial({ color });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const m = new THREE.Matrix4();
    const n = Math.ceil(Math.sqrt(count));
    for (let i = 0; i < count; i++) {
        const gx = (i % n) - (n - 1) / 2;
        const gy = Math.floor(i / n) - (n - 1) / 2;
        m.makeTranslation(gx * size, gy * size, 0);
        mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
}

function buildCloudLayer(seed, size, thick) {
    const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
        fog: false,
    });
    const geo = new THREE.BoxGeometry(size, thick, size);
    const count = 900;
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const m = new THREE.Matrix4();
    let rnd = seed >>> 0;
    const rand = () => {
        rnd = (Math.imul(rnd, 1664525) + 1013904223) >>> 0;
        return rnd / 4294967296;
    };
    const cell = 24;
    const grid = 22;
    for (let i = 0; i < count; i++) {
        const gx = Math.floor(rand() * grid);
        const gz = Math.floor(rand() * grid);
        m.makeTranslation(
            (gx - grid / 2) * cell,
            Math.floor(rand() * 2) * 8,
            (gz - grid / 2) * cell
        );
        mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    return mesh;
}

export class Environment {
    constructor(scene, renderer) {
        this.scene = scene;
        this.renderer = renderer;
        this.time = 0.28;
        this.daySpeed = 1 / 600;
        this.paused = false;

        this.skyUniforms = {
            uTop: { value: new THREE.Color(0x4a86d8) },
            uMid: { value: new THREE.Color(0x8fc0f0) },
            uBottom: { value: new THREE.Color(0x1a2a3a) },
            uSunDir: { value: new THREE.Vector3(0, 1, 0) },
            uSunColor: { value: new THREE.Color(0xfff2c0) },
            uSunStrength: { value: 1 },
        };

        this.sky = new THREE.Mesh(
            new THREE.SphereGeometry(1, 24, 16),
            new THREE.ShaderMaterial({
                uniforms: this.skyUniforms,
                vertexShader: SKY_VERT,
                fragmentShader: SKY_FRAG,
                side: THREE.BackSide,
                depthWrite: false,
                fog: false,
            })
        );
        this.sky.frustumCulled = false;
        this.sky.renderOrder = -1000;
        scene.add(this.sky);

        this.sun = buildVoxelDisc(64, 0xfff3c4, 3.2, 1.4);
        this.sun.renderOrder = -900;
        scene.add(this.sun);

        this.moon = buildVoxelDisc(48, 0xdfe6f5, 2.4, 1.2);
        this.moon.renderOrder = -900;
        scene.add(this.moon);

        this.clouds = buildCloudLayer(918273, 13, 3.5);
        this.clouds.position.y = 110;
        this.clouds.renderOrder = -800;
        scene.add(this.clouds);

        this.starCount = 900;
        const sPos = new Float32Array(this.starCount * 3);
        const sSize = new Float32Array(this.starCount);
        for (let i = 0; i < this.starCount; i++) {
            const th = Math.random() * Math.PI * 2;
            const ph = Math.acos(Math.random());
            const r = 320;
            sPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
            sPos[i * 3 + 1] = Math.abs(r * Math.cos(ph)) + 12;
            sPos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
            sSize[i] = 1 + Math.random() * 2.2;
        }
        const sGeo = new THREE.BufferGeometry();
        sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
        sGeo.setAttribute('size', new THREE.BufferAttribute(sSize, 1));
        this.starMat = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 2.2,
            sizeAttenuation: false,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            fog: false,
            map: pixelTexture(8, (cx, s) => {
                cx.fillStyle = '#fff';
                cx.fillRect(1, 1, s - 2, s - 2);
            }),
        });
        this.stars = new THREE.Points(sGeo, this.starMat);
        this.stars.frustumCulled = false;
        this.stars.renderOrder = -950;
        scene.add(this.stars);

        this.fogColor = new THREE.Color(0x8fc0f0);
        scene.fog = new THREE.Fog(0x8fc0f0, 60, 190);
        this.moonDir = new THREE.Vector3(0, -1, 0);
        this.skyLight = 1;
        this.nightTint = new THREE.Color(0xffffff);
        this.fogDistance = 110;

        this.setTime(this.time);
    }

    setFogDistance(blocks) {
        this.fogDistance = Math.max(40, blocks);
        this.apply();
    }

    setTime(t) {
        this.time = ((t % 1) + 1) % 1;
        this.apply();
    }

    get isNight() {
        return this.nightAmount > 0.5;
    }

    apply() {
        const a = (this.time - 0.25) * Math.PI * 2;
        const sx = Math.cos(a);
        const sy = Math.sin(a);
        const dir = new THREE.Vector3(sx, sy, 0.22).normalize();
        this.sunDir = dir;
        this.moonDir = dir.clone().multiplyScalar(-1);

        const day = THREE.MathUtils.smoothstep(sy, -0.22, 0.2);
        const night = 1 - day;
        this.dayAmount = day;
        this.nightAmount = night;

        const topDay = new THREE.Color(0x3f7fd6);
        const topNight = new THREE.Color(0x050a1c);
        const topDusk = new THREE.Color(0x2b3a72);
        const midDay = new THREE.Color(0x8cc4f2);
        const midNight = new THREE.Color(0x0a1024);
        const midDusk = new THREE.Color(0xd88a52);
        const botDay = new THREE.Color(0x9fd0e8);
        const botNight = new THREE.Color(0x04060f);
        const botDusk = new THREE.Color(0x6b3a3a);

        const dusk = Math.max(0, 1 - Math.abs(sy) * 4.2);

        const top = topNight.clone().lerp(topDay, day).lerp(topDusk, dusk * 0.6);
        const mid = midNight.clone().lerp(midDay, day).lerp(midDusk, dusk * 0.8);
        const bot = botNight.clone().lerp(botDay, day).lerp(botDusk, dusk * 0.7);

        this.skyUniforms.uTop.value.copy(top);
        this.skyUniforms.uMid.value.copy(mid);
        this.skyUniforms.uBottom.value.copy(bot);
        this.skyUniforms.uSunDir.value.copy(dir);
        this.skyUniforms.uSunStrength.value = THREE.MathUtils.clamp(sy * 2 + 0.25, 0, 1);

        this.fogColor.copy(mid).lerp(bot, 0.35);
        this.scene.fog.color.copy(this.fogColor);
        const d = this.fogDistance;
        this.scene.fog.near = d * 0.55;
        this.scene.fog.far = d;

        this.starMat.opacity = Math.pow(night, 1.6) * 0.95;

        this.sunColor = new THREE.Color(0xfff3c4).multiplyScalar(0.35 + day * 0.65);
        this.sun.material.color.copy(this.sunColor);
        this.moon.material.color.setHex(0xdfe6f5).multiplyScalar(0.3 + night * 0.7);

        const dim = 0.22 + day * 0.78;
        this.clouds.material.color.setRGB(dim, dim, dim).lerp(new THREE.Color(0xff9a5a), dusk * 0.45);
        this.clouds.material.opacity = 0.5 + day * 0.4;

        this.skyLight = THREE.MathUtils.lerp(0.16, 1, day);
        this.nightTint = new THREE.Color(0x2c3f6b).lerp(new THREE.Color(0xffffff), day);
    }

    update(dt, camPos) {
        if (!this.paused) {
            this.time = (this.time + dt * this.daySpeed) % 1;
            this.apply();
        }
        this.sky.position.copy(camPos);
        this.stars.position.copy(camPos);
        this.clouds.position.x = camPos.x;
        this.clouds.position.z = camPos.z;
        this.clouds.rotation.y += dt * 0.004;

        this.sun.position.copy(camPos).addScaledVector(this.sunDir, 300);
        this.sun.lookAt(camPos);
        this.moon.position.copy(camPos).addScaledVector(this.moonDir, 300);
        this.moon.lookAt(camPos);
    }

    get clockLabel() {
        const total = this.time * 24;
        const h = Math.floor(total);
        const m = Math.floor((total - h) * 60);
        return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    }
}
