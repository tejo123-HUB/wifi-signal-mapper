// Size of the draggable resize handle drawn at each room's bottom-right
// corner; floorplanBuilder.js uses the same constant for hit-testing so the
// clickable area always matches what's drawn.
export const RESIZE_HANDLE_SIZE = 12;

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
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.strokeRect(room.x, room.y, room.width, room.height);
            ctx.fillStyle = 'rgba(30, 100, 220, 0.85)';
            ctx.fillRect(
              room.x + room.width - RESIZE_HANDLE_SIZE,
              room.y + room.height - RESIZE_HANDLE_SIZE,
              RESIZE_HANDLE_SIZE,
              RESIZE_HANDLE_SIZE
            );
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
