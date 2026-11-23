# 第 5 课 · 纹理与颜色管理

- 页面：`/lessons/05-textures.html`
- 代码：`src/lessons/05-textures.js`
- 目标：能排查“贴图发灰 / 远处闪烁 / 斜看发糊”这三类经典问题

---

## 0. 一句话

**纹理 = 一张图 + 一组采样规则 + 每个顶点上的一个 UV 坐标。**

“贴图发灰”不是图的问题，是**颜色空间**；“远处闪烁”是 **mipmap**；“斜看发糊”是**各向异性过滤**。

---

## 1. 心智模型

```
UV 坐标（第 3 课的 attributes.uv）
      │
      ▼
   采样器 sampler
      ├─ 颜色空间：这张图的数据是什么色彩编码？
      ├─ Wrap：UV 超出 0~1 时怎么办？
      ├─ Filter：放大/缩小时像素怎么插值？
      └─ Mipmap / 各向异性：离得远、看得斜时怎么办？
      │
      ▼
   颜色值（进入光照计算）
```

---

## 2. 颜色空间：发灰的唯一元凶

### 2.1 为什么需要它

图片（PNG / JPG）的像素值几乎都是 **sRGB 编码**：不是线性亮度，而是人眼感知的压缩。

GPU 的光照计算必须在线性空间做。所以颜色贴图要**解码**：

```js
const tex = loader.load( 'albedo.png' );
tex.colorSpace = THREE.SRGBColorSpace;   // 读入时按 sRGB 解码成线性
```

忘了这一行，就是“把编码值当线性值用”——中间调被压低，画面发灰、发暗、对比度差。

### 2.2 哪些贴图要设，哪些不能设

| 贴图 | 设 sRGB？ | 原因 |
|---|---|---|
| `map`（颜色） | ✅ | 它是“给人看的颜色” |
| `emissiveMap` | ✅ | 同上 |
| `normalMap` | ❌ | 存的是法线向量分量，是数据 |
| `roughnessMap` / `metalnessMap` | ❌ | 存的是标量，是数据 |
| `aoMap` | ❌ | 同上 |

> 判断标准一句话：**这张图是“颜色”还是“数据”？**
> 颜色要解码，数据不能动。给法线图设 sRGB，会让法线方向整体偏掉，光照全错。

### 2.3 输出端的对应

```js
renderer.outputColorSpace = THREE.SRGBColorSpace;   // r152+ 默认就是
```

- 输入：sRGB → 线性（贴图解码）
- 计算：线性空间
- 输出：线性 → sRGB（`outputColorSpace`）

**两头都要对。** 中间的任何一步错，都会表现为“颜色不对”。

---

## 3. 采样规则

### 3.1 Wrap：UV 超出 0~1 时

| 模式 | 行为 | 用途 |
|---|---|---|
| `ClampToEdgeWrapping`（默认） | 边缘的最后一个像素拉长 | 贴一张不重复的图 |
| `RepeatWrapping` | 平铺重复 | 地砖、墙面、布料 |
| `MirroredRepeatWrapping` | 镜像平铺 | 避免接缝 |

```js
tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
tex.repeat.set( 4, 4 );
```

### 3.2 Filter：像素之间怎么插值

| 放大（magFilter） | 效果 |
|---|---|
| `LinearFilter`（默认） | 平滑过渡 |
| `NearestFilter` | 马赛克，保留像素感（像素风必备） |

| 缩小（minFilter） | 效果 |
|---|---|
| `LinearMipmapLinearFilter`（默认） | 用 mipmap，远处稳定 |
| `NearestFilter` | 远处剧烈闪烁 |

### 3.3 Mipmap：远处的“预缩小版本”

一张 512×512 的图，缩小到屏幕上只有 50×50 像素时，GPU 每帧只采到原图的零散几个像素 → 相邻帧采到的点不同 → **闪烁（摩尔纹）**。

mipmap 就是提前生成 256、128、64…… 一系列缩小版，远处直接取合适的层级。

```
mip 0: 512×512
mip 1: 256×256
mip 2: 128×128
...
内存代价：约 +33%
```

```js
tex.generateMipmaps = true;   // 默认开
```

> 常见坑：`generateMipmaps = false` 但 `minFilter` 还是 mipmap 系列 → 纹理不完整，画面可能全黑或异常。

### 3.4 各向异性：斜着看的时候

站在地面上往前看，远处的地砖被“压扁”了：横向要采样很多像素，纵向只要一个。标准 mipmap 只能二选一，结果是**远处糊成一片**。

`anisotropy` 允许沿一个方向多采几次：

```js
tex.anisotropy = renderer.capabilities.getMaxAnisotropy();   // 常见 8 或 16
```

代价是采样次数增加。**路面、地板、跑道**这类大平面必开。

---

## 4. 纹理的内存账

```
一张 2048×2048 的 RGBA 图：
2048 × 2048 × 4 字节 = 16 MB
加 mipmap 约 +33%    ≈ 21 MB
```

10 张这样的贴图 = 200 MB 显存。手机很容易被撑爆。

三条实践：

1. 贴图尺寸按**实际显示大小**定，不要无脑 4K
2. 用完 `texture.dispose()`
3. 多张图用**图集（atlas）**或 KTX2 压缩（第 6 课）

查询当前占用：

```js
renderer.info.memory.textures
```

---

## 5. 代码走读（`src/lessons/05-textures.js`）

1. `makeCheckerCanvas()`：程序化画棋盘 + 渐变 + 1px 细线 + 彩点
2. 同一份 canvas 生成两张 `CanvasTexture`
3. 左：`colorSpace = SRGBColorSpace`（正确示范）
4. 右：按键改参数，实时对比
5. `applyTextureState()`：所有参数集中在一处应用
6. 改完 `texture.needsUpdate = true` 才会重新上传

按键：<kbd>C</kbd> 颜色空间 · <kbd>R</kbd> 重复 · <kbd>F</kbd> 过滤 · <kbd>A</kbd> 各向异性 · <kbd>M</kbd> mipmap。

---

## 6. 动手实验

| 实验 | 预期现象 | 说明 |
|---|---|---|
| 按 <kbd>C</kbd> 切线性 | 右边整体发灰、变暗 | sRGB 值被当线性值读 |
| 按 <kbd>R</kbd> 切 4×4 | 纹理平铺 4 次 | Wrap + repeat |
| 按 <kbd>F</kbd> 切 Nearest | 放大时出现马赛克 | 不插值 |
| 把相机贴近平面再按 <kbd>M</kbd> 关 mipmap | 远处细线剧烈闪烁 | 采样点跳变 |
| 按 <kbd>A</kbd> 开各向异性，把视角压到很斜 | 远处细线重新变清晰 | 沿一个方向多采样 |
| 查 `__tex.renderer.info.memory.textures` | 2 | 两张纹理 |
| 控制台删掉一张 `dispose()` 再看 | 1 | 显存要手动还 |

---

## 7. 自检

<details>
<summary>1. 为什么颜色贴图要设 sRGB，法线贴图不能设？</summary>

因为二者语义不同：

- 颜色贴图存的是**人眼感知的颜色**，是 sRGB 编码的。光照计算需要线性值，所以读进来要解码。
- 法线贴图存的是**向量分量**（X/Y/Z 映射到 RGB），是纯数值。再解码一次，方向就全错了。

判断标准：**颜色要解码，数据不能动。**
</details>

<details>
<summary>2. 远处纹理闪烁，调哪个参数？</summary>

先确认 mipmap 是否开着（`generateMipmaps = true`，且 `minFilter` 是 mipmap 系列）。

如果已经开着还闪，再考虑：
- 纹理尺寸是否过大（相对显示尺寸）
- 是否需要在 UV 上做随机化（TAA / 抖动）

闪烁的本质是：缩小采样时，一帧取到 A 点、下一帧取到 B 点。
</details>

<details>
<summary>3. 地面远处糊成一片，纹理本身是清晰的，为什么？</summary>

这是**各向异性过滤**没开。

斜视时，一个像素覆盖的纹素区域是**长条形**（横向很长、纵向很短）。标准 mipmap 只能选一个近似正方形层级，于是按长的方向取 → 糊。

`anisotropy` 允许沿长轴多采几次再平均。
</details>

<details>
<summary>4. 一张 1024×1024 的 RGBA 贴图占多少显存？开 mipmap 后呢？</summary>

```
1024 × 1024 × 4 = 4 MB
+ mipmap ≈ 4 × 1.33 ≈ 5.3 MB
```
</details>

---

## 8. 常见坑

| 现象 | 原因 | 修法 |
|---|---|---|
| 贴图发灰、对比低 | 没设 `colorSpace` | `tex.colorSpace = SRGBColorSpace` |
| 法线贴图“没效果” | 被当成 sRGB 解码了 | `normalMap.colorSpace = NoColorSpace` |
| 纹理重复但只显示一块 | 没设 `wrapS/wrapT` | `RepeatWrapping` |
| 远处剧烈闪烁 | 关了 mipmap | 开 `generateMipmaps` |
| 斜看地面糊 | 各向异性 = 1 | 设成设备上限 |
| 纹理不显示 | 图还没加载完 / 路径错 | `loader.load` 是异步的，用 `onLoad` |
| 内存一路涨 | 没 `dispose()` | 换图前先释放 |
| 画面全黑且纹理异常 | `generateMipmaps = false` 但 minFilter 仍是 mipmap | 两者要配套 |

---

## 9. 延伸

- `src/textures/Texture.js`：`colorSpace` / `wrapS` / `filter` 的默认值
- `src/textures/CanvasTexture.js`：本课用的类型
- `src/renderers/webgl/WebGLTextures.js`：上传、mipmap 生成、各向异性的实际处理
- 下一课：glTF 与资源管线（贴图压缩 KTX2、模型加载、进度条）
