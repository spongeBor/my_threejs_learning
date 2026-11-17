# 附表 · PBR 材质

- 页面：`/lessons/pbr-playground.html`
- 代码：`src/lessons/pbr-playground.js`
- 用途：理解 `MeshStandardMaterial` 的参数到底在控制什么

---

## 0. 一句话

**PBR（Physically Based Rendering）= 你描述表面，光照负责结果。**

不是"一种材质"，而是一套用物理量描述表面的约定。参数是材质自己的属性，与光照无关，所以资产可以复用。

对比旧的 Phong/Lambert：那些参数（specular、shininess）是美术直觉值，换一个环境就要重调。

---

## 1. 能量守恒

光打到表面只有两条路：

```
入射光 ──┬──▶ 反射（specular）：高光、镜像
         └──▶ 进入内部（diffuse）：散射、吸收
```

两者之和 ≤ 1。

| | 反射 | 进入内部 | 结果 |
|---|---|---|---|
| **非金属**（塑料/木头/皮肤） | 约 4% | 其余散射出来 | 有固有色 |
| **金属**（金/铜/铁） | 大部分 | 被自由电子全部吸收 | **没有漫反射**，颜色 = 反射了什么 |

**这就解释了：`metalness = 1` 且没有环境贴图时，物体是黑的。**

---

## 2. 微表面：roughness 在控制什么

真实表面在微观上是无数面朝向杂乱的小镜子。

| roughness | 微观 | 视觉效果 |
|---|---|---|
| 0 | 全部朝同一方向 | 镜面，反射清晰 |
| 0.4 | 部分散乱 | 高光变宽，边缘变软 |
| 1 | 完全随机 | 哑光，高光摊成一片 |

three.js 用的是 GGX（Trowbridge-Reitz）分布。

> roughness 调的**不是亮度**，是"反射有多模糊"。

---

## 3. 菲涅尔

视线越接近掠射角，反射越强。所以正对水面能看到底，贴着水面看像镜子。PBR 自动计算。

---

## 4. IBL：环境贴图是光源

`scene.environment` 是**间接光**：既是金属的反射对象，也是所有材质的柔光来源。

- 和 `scene.background` 是两回事：背景只给你看，环境参与光照
- 常用来源：HDRI、内置 `RoomEnvironment`
- 用 `PMREMGenerator` 预卷积成适合实时采样的格式

```js
const pmrem = new THREE.PMREMGenerator( renderer );
scene.environment = pmrem.fromScene( new RoomEnvironment(), 0.04 ).texture;
```

---

## 5. 参数映射（three.js）

```js
new THREE.MeshStandardMaterial( {
	color: 0x4f8cff,       // 非金属 = 固有色；金属 = 反射颜色（F0）
	metalness: 0,          // 0 或 1，别用中间值
	roughness: 0.35,       // 0 镜面 → 1 哑光
	envMapIntensity: 1,    // 单个材质的环境强度
} );
```

三条实践规则：

1. **metalness 只用 0 或 1**，中间值只用于锈迹/污渍/过渡
2. **金属必须有环境贴图**，方向光照不亮它
3. **配 tone mapping**（ACES），否则高光爆成白块

`MeshPhysicalMaterial` 是 Standard 的扩展：`clearcoat`（车漆）、`transmission`（玻璃）、`sheen`（布料）、`iridescence`（肥皂泡）。第 4 课用。

---

## 6. 对照台操作

页面：`/lessons/pbr-playground.html`

| 操作 | 观察 |
|---|---|
| 按 <kbd>E</kbd> 关环境 | 下排（金属）变黑只剩高光；上排（非金属）还亮 —— 因为非金属有漫反射兜底 |
| 同一排左→右 | 只有高光形状在变，颜色几乎不变 |
| 上下两排对比 | 上排的蓝是材质色；下排的蓝其实是反射的房间色 |
| `color` 改红 | 上排立刻变红；下排变化很小 |

控制台：

```js
__pbr.scene.environmentIntensity = 0.2;
__pbr.spheres[0].material.roughness = 0.9;
```

---

## 7. 自检

<details>
<summary>1. 为什么金属在纯黑背景 + 两盏灯下看起来是黑的？</summary>

金属没有漫反射，进入内部的光全部被吸收。它所有的亮度都来自**反射环境**。没有环境贴图时，只剩两盏灯打出的针尖高光，所以整体是黑的。
</details>

<details>
<summary>2. 上排（metalness=0）为什么关掉环境贴图还亮着？</summary>

非金属有漫反射：进入内部的光被散射出来，形成固有色。这部分由直接光（半球光/方向光）驱动，不依赖环境贴图。
</details>

<details>
<summary>3. roughness 调大会让物体变暗吗？</summary>

不会。它只改变反射的**清晰度**：能量被摊到更大面积，高光变糊，但总能量基本不变（GGX 的能量守恒近似）。看起来"没那么亮"是因为峰值强度下降。
</details>

---

## 8. 延伸

- `docs/pages/MeshStandardMaterial.html`
- `docs/pages/MeshPhysicalMaterial.html`
- three.js 官方示例：`webgl_materials_physical_transmission.html`、`webgl_lights_physical.html`
