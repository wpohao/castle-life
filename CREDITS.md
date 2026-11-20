# 素材來源與授權

本遊戲只使用 **CC0（公眾領域）** 授權的素材。下載腳本：`scripts/fetch-assets.mjs`（下載日期 2026-11-20）。

## 3D 模型 — Quaternius（CC0）

作者：Quaternius（https://quaternius.com），經 poly.pizza 取得。授權：CC0 1.0。

| 遊戲內檔案 | 原始模型 | poly.pizza 頁面 |
|---|---|---|
| `public/assets/characters/adventurer_male.glb` | Adventurer（男） | https://poly.pizza/m/5EGWBMpuXq |
| `public/assets/characters/adventurer_female.glb` | Adventurer（女） | https://poly.pizza/m/ZwF0K7WBmu |
| `public/assets/characters/lady_green_dress.glb` | Animated Woman | https://poly.pizza/m/nIItLV9nxS |
| `public/assets/characters/king.glb` | King | https://poly.pizza/m/I1gTjmuK2m |
| `public/assets/horses/horse_brown.glb` | Horse | https://poly.pizza/m/qvTrSG9pZF |
| `public/assets/horses/horse_white.glb` | White Horse | https://poly.pizza/m/bEdE4rmZy9 |

## PBR 材質與 HDRI — Poly Haven（CC0）

來源：https://polyhaven.com ，授權：CC0 1.0。解析度 1K（材質）、2K（HDRI）。

| 遊戲材質 | Poly Haven ID |
|---|---|
| grass | leafy_grass |
| dirt | stony_dirt_path |
| cobble | cobblestone_floor_04 |
| plaster | grey_plaster_02 |
| stoneWall | stone_wall |
| castleStone | castle_wall_slates |
| roofTile | clay_roof_tiles_02 |
| wood | brown_planks_05 |
| darkWood | dark_wooden_planks |
| sand | dense_sand |
| 天空 HDRI（`public/assets/hdri/sky.hdr`） | kloofendal_48d_partly_cloudy_puresky |

## 程式產生

武器、建築、城牆、道具的幾何皆由程式產生（`src/world/weapons.ts`、`src/world/townBuilder.ts`），套用上列材質。
