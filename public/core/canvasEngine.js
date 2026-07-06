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
            room.image.onerror = () => {
              room.imageFailed = true;
              console.error(`Failed to load room photo: ${room.image_path}`);
            };
            room.image.src = room.image_path;
            continue;
          }
          // .complete is true for a failed load too, not just a successful
          // one — skip drawing rooms whose image errored out.
          if (room.image.complete && !room.imageFailed) {
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
