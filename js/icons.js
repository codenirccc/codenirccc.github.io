import * as B from './blocks.js';
import { textureCanvas } from './textures.js';

const TILE = 16;
const cache = new Map();

function shadedTile(name, bright) {
    const src = textureCanvas(name);
    const cv = document.createElement('canvas');
    cv.width = TILE;
    cv.height = TILE;
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0);
    const img = ctx.getImageData(0, 0, TILE, TILE);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
        d[i] = Math.min(255, d[i] * bright);
        d[i + 1] = Math.min(255, d[i + 1] * bright);
        d[i + 2] = Math.min(255, d[i + 2] * bright);
    }
    ctx.putImageData(img, 0, 0);
    return cv;
}

function face(ctx, tile, a, b, c, d, e, f) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(e, f);
    ctx.lineTo(e + a, f + b);
    ctx.lineTo(e + a + c, f + b + d);
    ctx.lineTo(e + c, f + d);
    ctx.closePath();
    ctx.clip();
    ctx.setTransform(a / TILE, b / TILE, c / TILE, d / TILE, e, f);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tile, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.restore();
}

export function blockIcon(block) {
    if (cache.has(block.id)) return cache.get(block.id);

    const S = 64;
    const cv = document.createElement('canvas');
    cv.width = S;
    cv.height = S;
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    const w = 44;
    const rh = 22;
    const side = 30;
    const cx = S / 2;
    const top = 10;
    const Lx = cx - w / 2;
    const Ly = top + rh / 2;
    const Bx = cx;
    const By = top + rh;

    const sideName = block.side || block.all || 'stone';
    const topName = block.top || sideName;
    const bottomName = block.bottom || sideName;

    const topTile = shadedTile(topName, 1);
    const leftTile = shadedTile(sideName, 0.72);
    const rightTile = shadedTile(sideName, 0.88);
    const bottomTile = shadedTile(bottomName, 0.6);

    void bottomTile;

    face(ctx, topTile, w / 2, -rh / 2, w / 2, rh / 2, Lx, Ly);
    face(ctx, leftTile, w / 2, rh / 2, 0, side, Lx, Ly);
    face(ctx, rightTile, w / 2, -rh / 2, 0, side, Bx, By);

    const url = cv.toDataURL();
    cache.set(block.id, url);
    return url;
}

export function iconForName(name) {
    return blockIcon(B.byName(name));
}
