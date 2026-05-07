# Project Context

This project uses Scheme C for the desktop pet system.

Rive / DragonBones are only used as visual motion design references. The final macOS desktop pet app must not depend on Rive runtime or DragonBones runtime.

The final app reads a custom_pet folder:

custom_pet/
├── template.json
├── motion.json
└── parts/
    ├── body.png
    ├── head.png
    ├── tail.png
    ├── front_leg.png
    └── back_leg.png

parts/*.png define the pet appearance.

template.json defines how image parts attach to bones, including:
- image
- bone
- position
- pivot
- size
- zIndex

motion.json defines bone animation keyframes, including idle and click.

The user customizes appearance, not animation. Animation is driven by template.json + motion.json.

Do not implement GIF/MOV/PNG sequence playback for the new system.
Do not integrate Rive runtime unless explicitly requested.
Do not integrate DragonBones runtime unless explicitly requested.

Current first target:
Build a minimal custom_pet player:
1. Load template.json.
2. Load motion.json.
3. Load PNG parts.
4. Stack PNG parts by zIndex.
5. Make tail rotate around its pivot using motion.json.
6. Default motion is idle.
7. Click motion can be added after idle works.
