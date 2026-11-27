// Paints the map terrain and facility sprites off the main thread (see public/map-art.js).
importScripts('./map-art.js?v=more-content');
self.onmessage = async ({data}) => {
  const {id, type} = data;
  try {
    if (type === 'terrain') {
      const bitmap = self.MapArt.paintTerrain(data.ids, data.T).transferToImageBitmap();
      self.postMessage({id, ok: true, bitmap}, [bitmap]);
    } else if (type === 'facilities') {
      const sprites = await Promise.all(self.MapArt.facilityList().map(async ([kind, owner]) =>
        [`${kind}-${owner}`, await self.MapArt.facilityCanvas(kind, owner).convertToBlob({type: 'image/png'})]));
      self.postMessage({id, ok: true, sprites});
    }
  } catch {
    self.postMessage({id, ok: false});
  }
};
