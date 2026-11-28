# 戦闘背景の素材

組み込みの画像生成で制作した原画を保存しています。艦艇を含む戦闘は `bay.png`、航空部隊同士は `clouds.png` を使います。地上部隊が廃墟にいるときは `ruins.png`、森・密林にいるときは `forest.png`、それ以外の地上戦・空対地戦は `valley.png` を使います。

Python と Pillow がある環境で、リポジトリ直下から次のコードを実行すると配信用の WebP を再生成できます。

```python
from pathlib import Path
from PIL import Image

for source in Path("art/battle").glob("*.png"):
    with Image.open(source) as image:
        scene = image.convert("RGB").resize((1152, 768), Image.Resampling.LANCZOS)
        scene.save(f"public/assets/battle-{source.stem}.webp", quality=82, method=6)
```

## 生成プロンプト

### valley.png

Original production background matte painting for a mobile tactical videogame. A sheltered mountain grassland in late summer, large clear LEVEL meadow on the entire lower half where both formations will stand. Natural horizontal striations of golden grasses. Distant indigo ridges and a single iconic crag catching peach alpenglow, clear sunset sky with a few streaks of cloud. Quiet broad middle ground and subtle sage grass silhouettes only at extreme lower corners. Keep visual focus centrally when cropped to portrait. Landscape 3:2 with the essential image still readable in a centered portrait crop. Cinematic, realistic three-dimensional terrain, sophisticated naturalistic light scattering, subtle film grain and painterly realism; graceful warm apricot and cool blue-green sunset palette, natural values and a soft atmospheric distance. Match smoothly shaded realistically rendered miniature 3D unit illustrations. Show only the environment; no people, vehicles, projectiles, letters, game interface, labels, logos, pixel art or borders.

### bay.png

Original production background matte painting for a mobile tactical videogame. Sheltered temperate mountain bay. Horizontally layered violet island headlands far away, high receding ridges illuminated along their edges, warm late sunlight broken by thin clouds shining on rippling deep turquoise water. Horizon at 40% from top. Entire lower 55% is open flat WATER for side-view ships, quietly textured without distracting highlights. No shore in foreground. Landscape 3:2 with the essential image still readable in a centered portrait crop. Cinematic, realistic three-dimensional terrain, sophisticated naturalistic light scattering, subtle film grain and painterly realism; graceful warm apricot and cool blue-green sunset palette, natural values and a soft atmospheric distance. Match smoothly shaded realistically rendered miniature 3D unit illustrations. Show only the environment; no people, vehicles, projectiles, letters, game interface, labels, logos, pixel art or borders.

### clouds.png

Original production background matte painting for a mobile tactical videogame. At cruising altitude looking horizontally between cloud layers. A majestic softly sculpted cumulonimbus bank to the far left, calmer open air through the middle and at right, a soft amber sky along the horizon and indigo above. Far below in lower 25% a cloud deck with a few openings onto forested valleys. Atmospheric and spacious, readable sky behind a formation of small aircraft. Landscape 3:2 with the essential image still readable in a centered portrait crop. Cinematic, realistic three-dimensional terrain, sophisticated naturalistic light scattering, subtle film grain and painterly realism; graceful warm apricot and cool blue-green sunset palette, natural values and a soft atmospheric distance. Match smoothly shaded realistically rendered miniature 3D unit illustrations. Show only the environment; no people, vehicles, projectiles, letters, game interface, labels, logos, pixel art or borders.

### forest.png

Use case: photorealistic-natural. Generate a new original strategy game battle panorama in the same realistic lighting hierarchy as the reference valley, set in a broad highland forest clearing. 3:2 landscape. Cinematic three-quarter side-on camera just slightly elevated over a flat open foreground. Clear meadow with soft yellow-green grasses and widely spaced patches of earth fills the lower 45%; this is a low contrast staging area for tiny blue and rust armored game sprites placed separately. Keep central portrait crop as readable as full landscape. Fir canopy and some birch trunks on the edges and deep background stand in mottled teal shadow; layer pines around a distant slate mountain pass. Light shafts break through cloud gently, amber dawn rim light and cool mist, dramatic depth, rich shadow detail, restrained color, no patches of dense black around lower center. Quiet environmental depth, no text, border, signage, figures, vehicles, weapons, explosions, logo, watermarks, or foreground occluders. Paint-over photographic look with finely readable material texture. The supplied image is a style and horizon reference only; this is a new game backdrop, not an overlay.

編集プロンプト

Edit this matte painting as a plate-cleanup operation. Remove every single visible person, soldier, formation, shield, polearm, spear, object, human-shaped silhouette and cast shadow left by them from the lower half. The meadow must now be entirely empty from side to side. Inpaint removed areas with continuous natural gently textured golden-green grass and a few irregular subtle patches of soil matching their immediate surroundings. Preserve the exact overall framing, natural forest edge, distant mountains, sun and sky. No figures, objects on the grass, buildings, overlays, text, or weapons. Final should be simply a landscape photograph/painting of a completely empty wilderness meadow surrounded by trees at sunrise, 3:2. This image is a reusable empty background plate, not a game screenshot.

### ruins.png

Use case: photorealistic-natural. An original 3:2 horizontal environment plate, film matte painting of a deserted rain-washed rail depot in a mountain valley after a storm. A broad open WEEDY gravel apron covers the whole lower 48 percent, very level from left to right, subtle texture and quiet value with pale wet amber reflections. Deep muted teal and blue-gray storm clouds, warm light at horizon, concrete viaduct and low brick industrial ruins far away beyond the apron as understated silhouettes. Side-on, slightly elevated viewpoint compatible with a straight broad horizontal foreground. Center remains very readable in a narrow portrait crop. Environment only and entirely empty: no people, animals, vehicles, locomotives, weapons, shots, flags, lettering, symbols, signs, or overlays. No tall objects in lower half. Calm naturalistic depth with painterly realism, matching light of a cinematic tactical game's panoramic environments. The human eye goes straight to the empty middle clearing.
