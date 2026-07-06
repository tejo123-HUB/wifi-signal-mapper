export default {
  id: 'floorplanBuilder',
  init(context) {
    const { api, state } = context;
    const floorNameInput = document.getElementById('floor-name');
    const createFloorBtn = document.getElementById('create-floor-btn');
    const floorSelect = document.getElementById('floor-select');
    const roomPhotoInput = document.getElementById('room-photo-input');
    const addRoomBtn = document.getElementById('add-room-btn');

    let selectToken = 0;
    async function selectFloor(floorId) {
      state.currentFloorId = Number(floorId);
      state.lastClick = null;
      const token = ++selectToken;
      const [rooms, samples] = await Promise.all([
        api.getRooms(state.currentFloorId),
        api.getSamples(state.currentFloorId),
      ]);
      // Ignore this response if a newer floor selection has already started
      // while we were waiting (e.g. the user switched floors twice quickly).
      if (token !== selectToken) return;
      state.rooms = rooms;
      state.samples = samples;
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
      if (floors.length === 0) {
        state.currentFloorId = null;
        state.rooms = [];
        state.samples = [];
        state.lastClick = null;
        context.redraw();
        return;
      }
      const targetId = selectId ?? floors[floors.length - 1].id;
      floorSelect.value = targetId;
      await selectFloor(floorSelect.value);
    }

    createFloorBtn.onclick = async () => {
      const name = floorNameInput.value.trim();
      if (!name) return alert('Enter a floor name');
      try {
        const floor = await api.createFloor(name);
        floorNameInput.value = '';
        await refreshFloors(floor.id);
      } catch (e) {
        alert(`Could not create floor: ${e.message}`);
      }
    };

    floorSelect.onchange = () => selectFloor(floorSelect.value);

    addRoomBtn.onclick = async () => {
      const file = roomPhotoInput.files[0];
      if (!state.currentFloorId) return alert('Create or select a floor first');
      if (!file) return alert('Choose a room photo first');
      try {
        const room = await api.uploadRoom(state.currentFloorId, file);
        state.rooms.push(room);
        roomPhotoInput.value = '';
        context.redraw();
      } catch (e) {
        alert(`Could not upload room photo: ${e.message}`);
      }
    };

    let dragging = null;
    context.canvas.addEventListener('mousedown', (e) => {
      const pos = context.getCanvasPos(e);
      for (let i = state.rooms.length - 1; i >= 0; i--) {
        const r = state.rooms[i];
        if (pos.x >= r.x && pos.x <= r.x + r.width && pos.y >= r.y && pos.y <= r.y + r.height) {
          dragging = { room: r, offsetX: pos.x - r.x, offsetY: pos.y - r.y, moved: false };
          break;
        }
      }
    });

    context.canvas.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      dragging.moved = true;
      const pos = context.getCanvasPos(e);
      dragging.room.x = pos.x - dragging.offsetX;
      dragging.room.y = pos.y - dragging.offsetY;
      context.redraw();
    });

    window.addEventListener('mouseup', async () => {
      if (!dragging) return;
      const { room, moved } = dragging;
      dragging = null;
      if (!moved) return;
      // Ending a drag on the canvas also fires a native 'click' at the drop
      // point; tell tagging.js to ignore that one click so it doesn't record
      // the drop location as a WiFi-reading tag point.
      context.suppressNextClick = true;
      try {
        await api.updateRoom(room.id, {
          x: room.x,
          y: room.y,
          width: room.width,
          height: room.height,
        });
      } catch (e) {
        console.error('Failed to save room position:', e.message);
      }
    });

    context.refreshFloors = refreshFloors;

    refreshFloors().catch((e) => console.error('Failed to load floors:', e.message));
  },
};
