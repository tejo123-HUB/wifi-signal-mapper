export default {
  id: 'canvasEngine',
  init(context) {
    context.canvasEngine = {
      drawRooms() {
        const { ctx, canvas, state } = context;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (const room of state.rooms) {
          if (!room.image) {
            room.image = new Image();
            room.image.onload = () => context.redraw();
            room.image.onerror = () =>
              console.error(`Failed to load room photo: ${room.image_path}`);
            room.image.src = room.image_path;
            continue;
          }
          if (room.image.complete) {
            ctx.drawImage(room.image, room.x, room.y, room.width, room.height);
          }
        }
      },
    };

    context.redraw = () => {
      context.canvasEngine.drawRooms();
      if (context.heatmap) context.heatmap.draw();
    };
  },
};
