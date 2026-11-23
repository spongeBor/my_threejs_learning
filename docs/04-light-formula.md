# 第 4 课补充 · 光照公式符号表与颜色管线

- 配套：`docs/04-materials.md`（主线）、`lessons/04-materials.html`
- 用途：**查**。调试光照、材质、颜色时对照着看
- 本篇三个部分：① 公式符号表 ② 环境贴图的两种类型 ③ 颜色管线三步排查

---

## 1. 光照公式：每个符号是什么

```
kD = (1 - F) · (1 - metalness)
输出 = (kD · albedo/π + spec) · (N·L) · E
```

| 符号 | 中文名 | 是什么 | 范围 |
|---|---|---|---|
| `E` | 入射辐照度 | 光源给到表面的能量 = 颜色 × 强度 × 衰减 | ≥ 0 |
| `N` | 法线 | 表面朝向（第 3 课的 `normal` 属性） | 单位向量 |
| `L` | 光方向 | 从表面指向光源 | 单位向量 |
| `V` | 视线方向 | 从表面指向相机 | 单位向量 |
| `H` | 半程向量 | `normalize(L + V)` | 单位向量 |
| `N·L` | 光照余弦 | 光有多正地打在面上 | 0 ~ 1（背面裁成 0） |
| `N·V` | 视角余弦 | 面有多正地对着相机 | 0 ~ 1 |
| `F` | 菲涅尔反射率 | 这个角度下“直接反掉”的比例 | 0 ~ 1，非金属正看 ≈ 0.04 |
| `1 - F` | 进入材质的比例 | 剩下的光才进到材料里 | 0 ~ 1 |
| `metalness` | 金属度 | 材质参数 | 0 ~ 1 |
| `(1 - metalness)` | 能散射的比例 | 金属吸收进入的光，不散射 | 0 ~ 1 |
| `kD` | 漫反射系数 | 最终有多少能量走漫反射 | 0 ~ 1 |
| `albedo` | 基础色 | `material.color` 或 map 贴图 | RGB |
| `π` | 圆周率 | Lambert 归一化常数，保证半球积分 = 1 | 3.14159 |
| `spec` | 镜面项 | `D · G · F / (4 · N·L · N·V)` | ≥ 0 |

### 1.1 一句话串起来

```
一束光 E 打过来
  ├─ 先被 F 分掉一部分（直接反射）        ← spec 用 F
  └─ 剩下的 (1-F) 进入材质
        ├─ 金属 (metalness=1)：全部吸收，没有漫反射
        └─ 非金属：散射回来，按 albedo 出颜色，除以 π 归一化
最后再乘 N·L（斜面收不到那么多光）
```

### 1.2 代数字

| 材质 | metalness | F | kD | 结果 |
|---|---|---|---|---|
| 塑料 | 0 | 0.04 | 0.96 | 96% 漫反射 + 4% 镜面 |
| 脏金属 | 0.7 | 0.6 | 0.12 | 大部分靠反射 |
| 纯金属 | 1 | 0.9 | 0 | 没有漫反射，全靠反射 |

### 1.3 三个常见误读

1. **`albedo` 不是“最终颜色”**。它是漫反射的基础色；金属时它变成 `F0`（反射率）。
2. **`π` 不能省**。省了整体偏亮，而且和环境光的积分对不上。
3. **`N·L` 和 `N·V` 必须都做 clamp**。负值意味着背光/背面，直接当 0。

---

## 2. 环境贴图：PMREM 与 Cube 是两种东西

### 2.1 渲染器会把 environment 给三种材质

```js
// node_modules/three/src/renderers/WebGLRenderer.js  (r187)
const environment = ( material.isMeshStandardMaterial
	|| material.isMeshLambertMaterial
	|| material.isMeshPhongMaterial ) ? scene.environment : null;
```

所以“`scene.environment` 只喂 PBR”这个说法**不准确**。

### 2.2 真正拦在 shader 里

| 材质 | 采样代码 | 支持的映射类型 |
|---|---|---|
| PBR（Standard / Physical） | `envmap_physical_pars_fragment` | `ENVMAP_TYPE_PMREM`（CubeUV，可按 roughness 选 mip）、`CUBE` |
| Lambert / Phong | `envmap_fragment` | **只有 `ENVMAP_TYPE_CUBE`** |

`PMREMGenerator` 产出的是预过滤 CubeUV 纹理（`ENVMAP_TYPE_PMREM`）。
给 Lambert / Phong 设 `scene.environment`，等于塞了一张**它们没有采样代码**的图——所以画面上毫无反应。

### 2.3 给 Phong 加反射的正确姿势

```js
const cube = new THREE.CubeTextureLoader().load( [
	'px.jpg', 'nx.jpg', 'py.jpg', 'ny.jpg', 'pz.jpg', 'nz.jpg',
] );

phongMat.envMap = cube;
phongMat.reflectivity = 0.8;              // 反射强度
phongMat.combine = THREE.AddOperation;    // Add / Mix / Multiply
phongMat.needsUpdate = true;
```

**它没有“粗糙度”概念**——Phong 的环境反射就是一面镜子。这是 PBR 存在的理由之一。

### 2.4 判断口诀

```
要按粗糙度模糊反射  → 必须 PBR + PMREM
要一面死镜子        → CubeTexture + Phong
```

---

## 3. 颜色管线：三步排查

```
贴图解码  →  线性光照计算  →  色调映射  →  sRGB 输出
   ①                            ②            ①'
```

### ① `texture.colorSpace` —— 读进来的数据对不对

```js
const tex = loader.load( 'albedo.png' );
tex.colorSpace = THREE.SRGBColorSpace;      // 颜色贴图
normalMap.colorSpace = THREE.NoColorSpace;  // 数据贴图：不要解码
```

**症状：整体发灰、发暗、对比度低。**

> 颜色贴图（map / emissiveMap）要设 sRGB；
> 法线、粗糙度、金属度、AO 是**数据**，必须保持线性，设了 sRGB 会毁掉数值。

### ② `renderer.toneMapping` —— 高光怎么压缩

```js
renderer.toneMapping = THREE.ACESFilmicToneMapping;
```

**症状：亮部一片白、没有细节。**

屏幕只能显示 0~1，而 PBR 可能算出 5、10。不做色调映射，超过 1 的全被剪掉。

### ③ `renderer.toneMappingExposure` —— 整体亮度

```js
renderer.toneMappingExposure = 1.0;
```

**症状：白茫茫一片，或暗部糊死。**

### 3.1 症状 → 先查哪一项

| 症状 | 先查 | 典型原因 |
|---|---|---|
| 整体发灰、对比低 | `colorSpace` | 贴图按线性读了 |
| 亮部一片白 | `toneMapping` | 没做 HDR 压缩，或曝光过高 |
| 整体过曝 / 过暗 | `exposure` / 光强 | 物理单位下 `intensity` 用错数量级 |
| 背光面死黑 | 环境光 | 缺 IBL / HemisphereLight |
| 金属像煤球 | 环境贴图 | 没有 `scene.environment` |
| 法线贴图“没效果” | `colorSpace` | 法线图被当成 sRGB 解码了 |

### 3.2 一段可直接抄的初始化

```js
renderer.outputColorSpace = THREE.SRGBColorSpace;      // r152+ 默认就是它
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

scene.environment = pmrem.fromScene( new RoomEnvironment(), 0.04 ).texture;
scene.environmentIntensity = 1.0;
```

---

## 4. 这篇文档为什么存在

第 4 课验收时，两个失分点都不是“想不通”，而是**没见过这些名字**：

- 环境贴图为什么 Lambert 用不了 → 需要知道 `ENVMAP_TYPE_PMREM` / `ENVMAP_TYPE_CUBE`
- 画面发灰 → 需要知道 `colorSpace` 这个词

这类知识只能靠“踩坑 + 查源码”积累。所以把它们固化成一张表，下次遇到直接查，不用重新踩。

**用法**：先看症状表定位，再看对应那段；对不上就回 `docs/04-materials.md` 看原理。

---

## 5. 延伸

- `docs/04-materials.md`：主干（四种材质、PBR 模型、IBL 原理）
- `docs/pbr.md`：微表面模型的图解版
- `docs/3d-math-cheatsheet.md`：点积、投影、颜色的数学基础
- 源码：`src/renderers/shaders/ShaderChunk/envmap_physical_pars_fragment.glsl.js`
- 源码：`src/extras/PMREMGenerator.js`
