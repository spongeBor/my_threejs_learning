# 第 4 课 · 材质与光照（PBR）

- 页面：`/lessons/04-materials.html`
- 代码：`src/lessons/04-materials.js`
- 目标：知道光是怎么算到像素上的，能说清 `metalness` / `roughness` 各在控制什么

---

## 0. 一句话

**材质决定“光照到表面之后，多少变成漫反射、多少变成高光、朝哪个方向反”。**

同一个球、同样的光，换材质：

```
MeshBasic    不参与光照，直接输出颜色
MeshLambert  只有漫反射（N·L），没有任何高光
MeshPhong    漫反射 + 经验高光（(N·H)^shininess）
MeshStandard 物理渲染：微表面 GGX + 菲涅尔 + 能量守恒
```

---

## 1. 心智模型

```
光线 L ──▶ 表面 ──▶ 像素
             │
             ├─ 法线 N         决定"这块面朝哪"
             ├─ 视线 V         决定"从哪看"
             └─ 材质参数        决定"反射多少、怎么反"
```

计光照永远绕不开三个向量：

```
N  表面法线（第 3 课的 normal 属性）
L  指向光源的方向
V  指向相机的方向
H  半程向量 = normalize(L + V)
```

三个核心点积：

| 式子 | 含义 | 大小 |
|---|---|---|
| `N·L` | 表面和光的夹角 | 正对光源 = 1，侧对 = 0，背光 = 负 |
| `N·V` | 表面和视线的夹角 | 正对相机 = 1，掠射 = 0 |
| `N·H` | 表面和半程向量 | 高光中心 = 1 |

> 前提：所有方向向量都必须**单位化**。否则点积算出来的不是余弦。

---

## 2. 逐个材质看公式

### 2.1 MeshBasic：不参与光照

```
output = color
```

它不知道光的存在，所以：**没有明暗、没有高光、也没有阴影**。
用途：UI 图标、纯色背景、调试。

### 2.2 MeshLambert：只有漫反射

```
L_o = albedo/π · (N·L) · lightColor · intensity
```

- `1/π` 是 BRDF 归一化系数，**不是可省的常数**，省了整体偏亮
- 结果：明暗随朝向变化，但**没有任何高光点**

### 2.3 MeshPhong：加一个经验高光

```
spec = (N·H)^shininess · specularColor
```

- `shininess` 越大，高光越集中、越小
- 它是**经验模型**：不遵守能量守恒——`shininess` 调大，高光变亮变窄，但总能量变了

### 2.4 MeshStandard：PBR

```
spec = D · G · F / (4 · (N·L) · (N·V))
```

| 项 | 名字 | 管什么 |
|---|---|---|
| `D` | 法线分布（GGX） | 表面微平面的朝向分布 → **高光宽窄** |
| `G` | 几何遮蔽（Smith） | 微平面互相遮挡 → **掠射角变暗** |
| `F` | 菲涅尔 | 边缘反射增强 → **边缘发亮** |

配套的能量分配：

```
kD = (1 - F) · (1 - metalness)
L_o = (kD · albedo/π + spec) · (N·L) · irradiance
```

**能量守恒**：反射出去的总量不超过入射量，所以“加高光不会让物体整体变亮”。

---

## 3. metalness 与 roughness 到底在控制什么

| 参数 | 物理含义 | 0 | 1 |
|---|---|---|---|
| `metalness` | 是不是金属 | 塑料、木头、皮肤（有漫反射） | 铁、铝、金（没有漫反射） |
| `roughness` | 表面多粗糙 | 镜面，高光锐利 | 磨砂，高光散开成一片 |

两条容易误解的地方：

1. **金属没有漫反射**。金属的本体颜色来自“反射”，所以 `metalness = 1` 时 `albedo` 会变成 `F0`（反射率），不是漫反射颜色。
2. **`roughness` 不是“高光强度”**。它改变的是高光的**形状和分布**：能量守恒下，高光变宽必然变暗。

> 常用对照：塑料 ≈ `metalness 0 / roughness 0.3~0.5`；拉丝金属 ≈ `1.0 / 0.4`；镜子 ≈ `1.0 / 0.05`。

---

## 4. 光照单位与衰减

| 光源 | 衰减 | `intensity` 语义 |
|---|---|---|
| `DirectionalLight` | 无 | 辐照度（跟距离无关，像太阳） |
| `PointLight` | `1/d²` | 坎德拉（candela） |
| `SpotLight` | `1/d²` × 角度衰减 | 坎德拉 |
| `AmbientLight` / `HemisphereLight` | 无 | 常量补光 |

第 2 课的太阳写 `220`、这课的轮廓光写 `160`——不是随便写的，是因为 `decay = 2` 下亮度按平方衰减，距离翻倍亮度只有四分之一。

> r155 之后 `useLegacyLights` 被移除，所有光照都是物理单位。老教程里的 `intensity = 1` 搬到新版本会明显偏暗。

---

## 5. 环境光照（IBL）为什么必需

只有直射光时，背光面是死黑，金属球看起来像煤球。真实世界的光来自四面八方。

three 的做法：把一张环境图（HDRI / 程序化房间）预处理成辐照度图 + 预过滤反射图：

```js
const pmrem = new THREE.PMREMGenerator( renderer );
scene.environment = pmrem.fromScene( new RoomEnvironment(), 0.04 ).texture;
```

**关键细节（按 r187 源码核实）**：渲染器其实会把 `scene.environment` 也传给 Lambert / Phong：

```js
// WebGLRenderer.js
const environment = ( material.isMeshStandardMaterial || material.isMeshLambertMaterial || material.isMeshPhongMaterial ) ? scene.environment : null;
```

但**能真正采样它的只有 PBR 的 shader**：

| | 环境采样代码 | 能否吃 PMREM 纹理 |
|---|---|---|
| PBR | `envmap_physical_pars_fragment` | ✅ 有 `ENVMAP_TYPE_PMREM` 分支，还能按 roughness 选 mip |
| Lambert / Phong | `envmap_fragment` | ❌ 只处理 `ENVMAP_TYPE_CUBE`（普通立方体贴图） |

`PMREMGenerator` 产出的是预过滤 CubeUV 纹理，标记为 `ENVMAP_TYPE_PMREM`。所以给 Lambert / Phong 设 `scene.environment`，等于塞了一张它们不会用的图。

想让 Phong 有反射，得显式给一张 **CubeTexture**：

```js
phongMat.envMap = cubeTexture;                 // 6 张面的立方体贴图
phongMat.reflectivity = 0.8;                   // 反射强度
phongMat.combine = THREE.AddOperation;         // 或 MixOperation
phongMat.needsUpdate = true;
```

注意它没有“粗糙度”概念——Phong 的环境反射就是一面镜子。

页面上按 <kbd>E</kbd> 只有第 ④ 个球明显变亮，原因就在这。

---

## 6. 代码走读（`src/lessons/04-materials.js`）

1. 一盏主光 + 一盏补光 + 一盏轮廓光（三点布光的最小版）
2. `DirectionalLightHelper` / `PointLightHelper`：把光源位置画出来
3. `PMREMGenerator` + `RoomEnvironment`：离线烘一张环境图
4. 四个球共用**同一个几何体**，只有材质不同
5. `↑↓` 调粗糙度，`Shift+↑↓` 调金属度，`E` 开关环境光
6. `material.needsUpdate = true`：改 `scene.environment` 后要重编译

---

## 7. 动手实验

| 实验 | 预期现象 | 说明 |
|---|---|---|
| 按 <kbd>E</kbd> 开环境光 | 只有第 ④ 个球变亮 | PBR 才吃 `scene.environment` |
| 关掉主光（`__mats.key.intensity = 0`） | ①②③ 明显变暗，④ 靠环境光还亮 | IBL 是"另一套光源" |
| ④ 的 `roughness` 调到 0 | 高光变成一个锐点 | 微表面几乎全同向 |
| ④ 的 `roughness` 调到 1 | 高光铺开、整体变哑 | 能量守恒：宽了就暗 |
| ④ 的 `metalness` 调到 1 | 漫反射消失，只剩反射 | 金属没有漫反射 |
| `metalness = 1` + `roughness = 0` + 按 E | 像镜子 | 环境反射 |
| 按 <kbd>W</kbd> 线框 | 线框 | 材质与几何体互相独立 |
| 去掉公式里的 `1/π`（改源码） | 整体明显偏亮 | BRDF 归一化 |

---

## 8. 自检

<details>
<summary>1. 为什么 `MeshLambertMaterial` 没有高光？</summary>

它的 BRDF 只有漫反射项：

```
L_o = albedo/π · (N·L) · E
```

漫反射假设光进入表面后向各个方向均匀散出，所以没有方向性的亮斑。高光来自**镜面反射**，Lambert 模型里根本没有这一项。
</details>

<details>
<summary>2. `metalness` 从 0 调到 1，为什么物体反而变暗？</summary>

因为漫反射被关掉了：

```
kD = (1 - F) · (1 - metalness)
metalness = 1 → kD = 0 → 没有漫反射
```

金属的颜色全部来自反射环境。如果场景没有环境光（没按 <kbd>E</kbd>），金属球就只剩几个高光点，看起来像黑球。

**这就是“PBR 模型没环境贴图会显脏”的原因。**
</details>

<details>
<summary>3. `roughness` 调大，高光是变亮还是变暗？</summary>

**变宽、变暗。** 能量守恒：入射能量固定，微平面方向越分散，每个方向分到的越少。

这也是 PBR 和 Phong 的核心差别之一：Phong 的 `shininess` 可以既变亮又变窄，不受约束。
</details>

<details>
<summary>4. 为什么改 `scene.environment` 之后要 `material.needsUpdate = true`？</summary>

因为环境贴图的有无改变了 shader 的 **define**（`USE_ENVMAP`），shader 程序需要重新编译。

`needsUpdate` 让 three 丢掉缓存的 program，下次渲染重新构建。这和改 `flatShading`、`side` 是同一类操作。
</details>

<details>
<summary>5. 计算：N = (0,0,1)，L = normalize(1,1,1)，N·L 是多少？</summary>

```
L = (1,1,1)/√3 = (0.577, 0.577, 0.577)
N·L = 0.577
```

也就是说，斜 54.7° 打过来的光，亮度只有正对时的 **57.7%**。

光照按**余弦**衰减，不是线性。
</details>

---

## 9. 常见坑

| 现象 | 原因 | 修法 |
|---|---|---|
| 模型全黑 | 用 PBR 材质但没打光 | 加灯，或设 `scene.environment` |
| 金属像煤球 | 没有环境光 | `PMREMGenerator` + `scene.environment` |
| 画面过曝发白 | tone mapping 曝光太高 / 灯太亮 | 降 `toneMappingExposure` 或 `intensity` |
| 颜色发灰 | 贴图没设 sRGB | `texture.colorSpace = SRGBColorSpace` |
| 改材质参数没反应 | 需要重编译的参数 | `material.needsUpdate = true` |
| 老教程的 `intensity` 不对 | 光照单位变了 | 按物理单位调（点光要几百） |
| 背光面死黑 | 只有直射光 | 加 `HemisphereLight` 或环境光 |

---

## 10. 延伸

- `src/renderers/shaders/ShaderChunk/lights_physical_pars_fragment.glsl.js`：PBR 光照的实际实现
- `src/materials/MeshStandardMaterial.js`：参数到 define 的映射
- 本仓库 `docs/pbr.md`：能量守恒、微表面模型的图解版
- 下一课：纹理与颜色管理，专治“贴图发灰 / 过曝”
