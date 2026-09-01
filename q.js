// q.js - Tools to interact with github.com/stephenlb/draw-on-my-face/pubnub.js
// Provides canvas drawing tools over PubNub and a clear-all-canvas command.

(function (global) {
    'use strict';

    const Q = {};

    // Default PubNub config (mirrors draw-on-my-face defaults)
    const CONFIG = {
        publishKey:   'demo',
        subscribeKey: 'demo',
        channel:      'draw-on-my-face',
        userId:       'q-tools-' + Math.random().toString(36).slice(2, 8)
    };

    // Reference to the canvas element
    let canvas = null;
    let ctx    = null;

    // ---- Canvas setup ----
    Q.setCanvas = function (canvasEl) {
        canvas = canvasEl;
        ctx    = canvas ? canvas.getContext('2d') : null;
        return Q;
    };

    // ---- Clear all canvas ----
    Q.clearAll = function () {
        if (!canvas || !ctx) return false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return true;
    };

    // ---- Publish a clear command to all subscribers ----
    Q.clearAllRemote = async function () {
        if (typeof PubNub === 'undefined') return false;
        return await PubNub.publish({
            publishKey:   CONFIG.publishKey,
            subscribeKey: CONFIG.subscribeKey,
            channel:      CONFIG.channel,
            userId:       CONFIG.userId,
            message:      { type: 'clear', ts: Date.now() }
        });
    };

    // ---- Draw a line on the local canvas ----
    Q.drawLine = function (x1, y1, x2, y2, color, width) {
        if (!ctx) return false;
        ctx.strokeStyle = color || '#000';
        ctx.lineWidth   = width || 2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        return true;
    };

    // ---- Publish a draw command to all subscribers ----
    Q.drawRemote = async function (x1, y1, x2, y2, color, width) {
        if (typeof PubNub === 'undefined') return false;
        return await PubNub.publish({
            publishKey:   CONFIG.publishKey,
            subscribeKey: CONFIG.subscribeKey,
            channel:      CONFIG.channel,
            userId:       CONFIG.userId,
            message: {
                type:  'draw',
                x1, y1, x2, y2,
                color: color || '#000',
                width: width || 2,
                ts:    Date.now()
            }
        });
    };

    // ---- Subscribe and react to incoming draw/clear messages ----
    Q.listen = async function (onMessage) {
        if (typeof PubNub === 'undefined') return null;

        const iterator = PubNub.subscribe({
            subscribeKey: CONFIG.subscribeKey,
            channel:      CONFIG.channel,
            userId:       CONFIG.userId,
            messages:     (msg) => {
                if (!msg || typeof msg !== 'object') return;

                // Auto-clear canvas when a clear command arrives
                if (msg.type === 'clear') Q.clearAll();

                if (onMessage) onMessage(msg);
            }
        });

        return iterator;
    };

    // ---- Connect to the draw-on-my-face PubNub channel ----
    Q.connect = async function (onMessage) {
        return await Q.listen(onMessage);
    };

    // Expose globally
    global.Q = Q;

})(typeof window !== 'undefined' ? window : globalThis);
