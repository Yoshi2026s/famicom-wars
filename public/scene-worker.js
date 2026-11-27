// Paints the battle panorama and the title scene off the main thread (see scene-art.js).
importScripts('./scene-art.js?v=title-art');
self.onmessage = async ({data}) => {
  try {
    const canvas = data === 'title' ? self.SceneArt.titleScene() : self.SceneArt.landscape();
    self.postMessage(await canvas.convertToBlob({type: 'image/jpeg', quality: data === 'title' ? .88 : .9}));
  } catch {
    self.postMessage(null);
  }
};
