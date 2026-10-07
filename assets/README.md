Here is the folder for all assets in game, all modifier should follew schemes below:


1. directory layout
   1. raw_design
      1. artworks/settings/story/background/TODOs/..., everything for design
   2. texture
      1. pictures, with suffix .png, support rgba
   3. model
      1. 3d models, with suffix .fbx or .glb
      2. `.glb` is the runtime delivery format for Three.js; keep the editable `.blend` and authoring script under `raw_design/artworks`
      3. `*.manifest.json` records source references, coordinate conventions, asset status and pending concepts
   4. audio
      1. bgm and sfx, with suffix .wav
   5. prefab
      1. config files for encapsulated entities, with suffix .json
   6. map
      1. game maps, with suffix .json
      2. 
2. ai modify notes
   1. should give all names of ai-generated assets following with "_ai"
   2. should give all names of web-src assets following with "_web"
   3. should not modify any assets made by commiters

## Low-poly asset production

`raw_design/artworks/build_lowpoly_assets.py` converts the current fixed-view concept references into the first isometric low-poly asset pack. It opens the authored table source, creates reusable paper, player token, key and terrain blockouts, and exports:

- `raw_design/artworks/fold_field_lowpoly_assets.blend`: editable Blender source
- `model/fold_field_lowpoly.glb`: runtime scene asset for Three.js import
- `model/fold_field_lowpoly.manifest.json`: source and conversion manifest

Run it from the repository root with Blender 4.2 or newer:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 4.2\blender.exe' --background --python assets/raw_design/artworks/build_lowpoly_assets.py
```

The pack uses Y-up coordinates and keeps the tabletop top at `Y=0`, matching the existing fixed-view editor and fold collision convention. Gameplay prefab JSON and behavior scripts remain authoritative for collision, placement and state; the GLB supplies the visual asset source.
