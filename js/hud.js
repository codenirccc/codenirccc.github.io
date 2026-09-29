import * as B from './blocks.js';
import { blockIcon } from './icons.js';
import { sfx } from './audio.js';

export class Hud {
    constructor() {
        this.slots = B.HOTBAR_DEFAULT.map((n) => B.byName(n));
        this.selected = 0;
        this.build();
    }

    build() {
        const hotbar = document.getElementById('hotbar');
        hotbar.innerHTML = '';
        this.slotEls = [];
        for (let i = 0; i < 9; i++) {
            const el = document.createElement('div');
            el.className = 'slot';
            const img = document.createElement('img');
            img.className = 'slot-icon';
            const num = document.createElement('div');
            num.className = 'slot-num';
            num.textContent = String(i + 1);
            el.appendChild(img);
            el.appendChild(num);
            el.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.select(i);
            });
            hotbar.appendChild(el);
            this.slotEls.push({ el, img, last: -1 });
        }
        this.refresh();
        this.select(0, true);
    }

    refresh() {
        for (let i = 0; i < 9; i++) {
            const b = this.slots[i];
            const e = this.slotEls[i];
            if (e.last === b.id) continue;
            e.img.src = blockIcon(b);
            e.last = b.id;
        }
    }

    setSlot(index, blockId) {
        this.slots[index] = B.byId(blockId);
        this.refresh();
    }

    select(i, silent) {
        this.selected = ((i % 9) + 9) % 9;
        for (let k = 0; k < 9; k++) this.slotEls[k].el.classList.toggle('active', k === this.selected);
        const label = document.getElementById('itemName');
        label.textContent = this.current().label;
        label.classList.remove('show');
        void label.offsetWidth;
        label.classList.add('show');
        if (!silent) sfx.click();
    }

    scroll(dir) {
        this.select(this.selected + dir);
    }

    current() {
        return this.slots[this.selected];
    }
}
