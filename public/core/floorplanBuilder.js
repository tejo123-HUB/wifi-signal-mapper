export default {
  id: 'floorplanBuilder',
  init(context) {
    const { api, state } = context;
    const floorNameInput = document.getElementById('floor-name');
    const createFloorBtn = document.getElementById('create-floor-btn');
    const floorSelect = document.getElementById('floor-select');
    const roomPhotoInput = document.getElementById('room-photo-input');
    const addRoomBtn = document.getElementById('add-room-btn');

    async function selectFloor(floorId) {
      state.currentFloorId = Number(floorId);
      state.lastClick = null;
      state.rooms = await api.getRooms(state.currentFloorId);
      state.samples = await api.getSamples(state.currentFloorId);
      context.redraw();
      if (context.loadHeatmap) context.loadHeatmap();
    }

    async function refreshFloors(selectId) {
      const floors = await api.getFloors();
      floorSelect.innerHTML = '';
      for (const floor of floors) {
        const opt = document.createElement('option');
        opt.value = floor.id;
        opt.textContent = floor.name;
        floorSelect.appendChild(opt);
      }
      if (floors.length === 0) return;
      const targetId = selectId ?? floors[floors.length - 1].id;
      floorSelect.value = targetId;
      await selectFloor(floorSelect.value);
    }

    createFloorBtn.onclick = async () => {
      const name = floorNameInput.value.trim();
      if (!name) return alert('Enter a floor name');
      const floor = await api.createFloor(name);
      floorNameInput.value = '';
      await refreshFloors(floor.id);
    };

    floorSelect.onchange = () => selectFloor(floorSelect.value);

    addRoomBtn.onclick = async () => {
      const file = roomPhotoInput.files[0];
      if (!state.currentFloorId) return alert('Create or select a floor first');
      if (!file) return alert('Choose a room photo first');
      const room = await api.uploadRoom(state.currentFloorId, file);
      state.rooms.push(room);
      roomPhotoInput.value = '';
      context.redraw();
    };

    let dragging = null;
    context.canvas.addEventListener('mousedown', (e) => {
      const pos = context.getCanvasPos(e);
      for (let i = state.rooms.length - 1; i >= 0; i--) {
        const r = state.rooms[i];
        if (pos.x >= r.x && pos.x <= r.x + r.width && pos.y >= r.y && pos.y <= r.y + r.height) {
          dragging = { room: r, offsetX: pos.x - r.x, offsetY: pos.y - r.y };
          break;
        }
      }
    });

    context.canvas.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const pos = context.getCanvasPos(e);
      dragging.room.x = pos.x - dragging.offsetX;
      dragging.room.y = pos.y - dragging.offsetY;
      context.redraw();
    });

    window.addEventListener('mouseup', async () => {
      if (!dragging) return;
      const { room } = dragging;
      dragging = null;
      await api.updateRoom(room.id, {
        x: room.x,
        y: room.y,
        width: room.width,
        height: room.height,
      });
    });

    refreshFloors();
  },
};
