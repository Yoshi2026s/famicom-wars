# 戦闘背景の素材

組み込みの画像生成で制作した原画を保存しています。地上戦と空対地戦は `valley.png`、艦艇を含む戦闘は `bay.png`、航空部隊同士は `clouds.png` を使います。

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
