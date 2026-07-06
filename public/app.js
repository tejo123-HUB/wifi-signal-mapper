import canvasEngine from './core/canvasEngine.js';
import floorplanBuilder from './core/floorplanBuilder.js';
import tagging from './core/tagging.js';
import heatmap from './core/heatmap.js';
import { enabledModules } from './features.config.js';

async function postJSON(url, body, method = 'POST') {
  return (
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  ).json();
}

const api = {
  async getFloors() {
    return (await fetch('/api/floors')).json();
  },
  async createFloor(name) {
    return postJSON('/api/floors', { name });
  },
  async getRooms(floorId) {
    return (await fetch(`/api/floors/${floorId}/rooms`)).json();
  },
  async uploadRoom(floorId, file) {
    const formData = new FormData();
    formData.append('photo', file);
    return (
      await fetch(`/api/floors/${floorId}/rooms`, { method: 'POST', body: formData })
    ).json();
  },
  async updateRoom(roomId, { x, y, width, height }) {
    return postJSON(`/api/rooms/${roomId}`, { x, y, width, height }, 'PUT');
  },
  async getSamples(floorId) {
    return (await fetch(`/api/floors/${floorId}/samples`)).json();
  },
  async takeSample(floorId, x, y) {
    return postJSON('/api/samples', { floor_id: floorId, x, y });
  },
  async getHeatmap(floorId, power, width, height) {
    return (
      await fetch(`/api/floors/${floorId}/heatmap?power=${power}&width=${width}&height=${height}`)
    ).json();
  },
};

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const context = {
  canvas,
  ctx,
  api,
  state: {
    currentFloorId: null,
    rooms: [],
    samples: [],
    lastClick: null,
  },
  getCanvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * canvas.width) / rect.width,
      y: ((e.clientY - rect.top) * canvas.height) / rect.height,
    };
  },
};

// Order matters: canvasEngine must init first since it defines context.redraw,
// which floorplanBuilder/tagging/heatmap all call.
const coreModules = [canvasEngine, floorplanBuilder, tagging, heatmap];

async function boot() {
  for (const mod of coreModules) mod.init(context);
  for (const name of enabledModules) {
    const { default: mod } = await import(`./modules/${name}.js`);
    mod.init(context);
  }
}

boot();
