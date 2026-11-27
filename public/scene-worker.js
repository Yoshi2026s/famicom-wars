// Paints the battle panorama off the main thread (see scene-art.js).
importScripts('./scene-art.js?v=speed');
self.onmessage = async () => {
  try {
    const canvas = self.SceneArt.landscape();
    self.postMessage(await canvas.convertToBlob({type: 'image/jpeg', quality: .9}));
  } catch {
    self.postMessage(null);
  }
};
