export default {
  id: 'multiFloor',
  init(context) {
    const floorSelect = document.getElementById('floor-select');
    if (!floorSelect) return;

    const deleteBtn = document.createElement('button');
    deleteBtn.id = 'delete-floor-btn';
    deleteBtn.textContent = 'Delete floor';
    floorSelect.parentNode.insertBefore(deleteBtn, floorSelect.nextSibling);

    deleteBtn.onclick = async () => {
      if (!context.state.currentFloorId) return alert('Select a floor first');
      if (!confirm('Delete this floor and all its rooms/samples? This cannot be undone.')) return;
      const res = await fetch(`/api/floors/${context.state.currentFloorId}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        return alert(body?.error || 'Could not delete floor');
      }
      await context.refreshFloors();
    };
  },
};
