const B = [];
let nextId = 1;

function def(name, opts) {
    const b = Object.assign(
        {
            id: 0,
            name,
            label: name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
            solid: true,
            transparent: false,
            liquid: false,
            light: 0,
            hardness: 1,
            group: 'stone',
            top: null,
            bottom: null,
            side: null,
            all: null,
        },
        opts
    );
    b.id = nextId++;
    B.push(b);
    return b;
}

def('air', { solid: false, transparent: true, all: 'stone' });

def('stone', { all: 'stone', group: 'stone' });
def('cobblestone', { all: 'cobblestone', group: 'stone' });
def('mossy_cobblestone', { all: 'mossy_cobblestone', group: 'stone' });
def('stone_bricks', { all: 'stone_bricks', group: 'stone' });
def('cracked_stone_bricks', { all: 'cracked_stone_bricks', group: 'stone' });
def('andesite', { all: 'andesite', group: 'stone' });
def('deepslate', { all: 'deepslate', group: 'stone' });
def('bricks', { all: 'bricks', group: 'stone' });
def('gravel', { all: 'gravel', group: 'stone' });
def('sandstone', { all: 'sandstone', group: 'stone' });
def('sand', { all: 'sand', group: 'stone' });
def('dirt', { all: 'dirt', group: 'stone' });
def('bedrock', { all: 'bedrock', hardness: 999, group: 'stone' });
def('glass', { all: 'glass', transparent: true, hardness: 0.4, group: 'stone' });

def('grass_block', {
    top: 'grass_top',
    bottom: 'dirt',
    side: 'grass_side',
    group: 'stone',
});

def('oak_log', { top: 'oak_log_top', bottom: 'oak_log_top', side: 'oak_log_side', group: 'wood' });
def('oak_planks', { all: 'oak_planks', group: 'wood' });
def('oak_leaves', { all: 'oak_leaves', transparent: true, group: 'wood' });
def('birch_log', { top: 'birch_log_top', bottom: 'birch_log_top', side: 'birch_log_side', group: 'wood' });
def('birch_planks', { all: 'birch_planks', group: 'wood' });
def('birch_leaves', { all: 'birch_leaves', transparent: true, group: 'wood' });
def('spruce_log', { top: 'spruce_log_top', bottom: 'spruce_log_top', side: 'spruce_log_side', group: 'wood' });
def('spruce_planks', { all: 'spruce_planks', group: 'wood' });
def('spruce_leaves', { all: 'spruce_leaves', transparent: true, group: 'wood' });

def('water', { all: 'water', solid: false, transparent: true, liquid: true, all6: 1, group: 'liquid' });
def('glowstone', { all: 'glowstone', light: 15, group: 'stone' });
def('lantern', { top: 'lantern_top', bottom: 'lantern_top', side: 'oak_planks', light: 14, group: 'wood' });

export const AIR = 1;
export const WATER = B.find((b) => b.name === 'water').id;

export const BLOCKS = B;
export const BY_NAME = new Map(B.map((b) => [b.name, b]));
export const BY_ID = new Map(B.map((b) => [b.id, b]));

export function byId(id) {
    return BY_ID.get(id) || B[0];
}

export function byName(name) {
    return BY_NAME.get(name);
}

const TILE_KEYS = ['top', 'bottom', 'side', 'all'];

export function faceTile(block, face) {
    if (face === 2 || face === 3) {
        const k = face === 2 ? block.top : block.bottom;
        if (k) return k;
        return block.side || block.all;
    }
    return block.side || block.all;
}

export function blockTileKeys(block) {
    for (const k of TILE_KEYS) {
        if (block[k]) return [block[k]];
    }
    return ['stone'];
}

const opaqueList = new Set();
const solidList = new Set();
const transparentList = new Set();
const liquidList = new Set();
const lightList = new Int8Array(256);

for (const b of B) {
    const trans = b.transparent || b.liquid;
    if (!trans) opaqueList.add(b.id);
    if (b.solid) solidList.add(b.id);
    if (trans) transparentList.add(b.id);
    if (b.liquid) liquidList.add(b.id);
    lightList[b.id] = b.light;
}

export const OPAQUE = opaqueList;
export const SOLID = solidList;
export const TRANSPARENT = transparentList;
export const LIQUID = liquidList;
export const LIGHT_EMIT = lightList;

export function isOpaque(id) {
    return opaqueList.has(id);
}

export function isSolid(id) {
    return solidList.has(id);
}

export function isTransparent(id) {
    return transparentList.has(id);
}

export function isLiquid(id) {
    return liquidList.has(id);
}

export function lightOf(id) {
    return lightList[id] || 0;
}

export const HOTBAR_DEFAULT = [
    'grass_block',
    'oak_planks',
    'oak_log',
    'cobblestone',
    'stone_bricks',
    'glass',
    'oak_leaves',
    'bricks',
    'glowstone',
];

export const PALETTE = [
    'oak_planks', 'oak_log', 'oak_leaves',
    'birch_planks', 'birch_log', 'birch_leaves',
    'spruce_planks', 'spruce_log', 'spruce_leaves',
    'stone', 'cobblestone', 'mossy_cobblestone',
    'stone_bricks', 'cracked_stone_bricks', 'andesite',
    'deepslate', 'bricks', 'sandstone',
    'glass', 'glowstone', 'gravel',
    'sand', 'dirt', 'grass_block',
];
