# 术语表（第 1–5 课）

- 用途：**查**。遇到不认识的名词先在这里找，找不到再去 `docs/` 对应课次
- 每条一句话：是什么 + 干什么用
- 「课」列是对应课堂笔记，方便回去看上下文

> 学 3D 最大的坎不是推理，是**词汇**。概念想得通，但名字没见过，就会卡在第 4、5 题那种“说不出为什么”的地方。

---

## 0. 先记住这 10 个

| 术语 | 一句话 |
|---|---|
| `scene` / `camera` / `renderer` | 画什么 / 从哪看 / 谁来画 |
| `delta` | 上一帧到这一帧过了多少秒 |
| `matrixWorld` | 世界矩阵 = 父级世界矩阵 × 本地矩阵 |
| `BufferGeometry` | 顶点数组 + 索引，几何体的真实形态 |
| `index` | 顶点编号的列表，每 3 个 = 1 个三角形 |
| `normal` | 表面朝向，光照全靠它 |
| `colorSpace` | 这张贴图的字节该怎么解释 |
| `metalness` / `roughness` | 是不是金属 / 表面多粗糙 |
| `mipmap` | 远处用的缩小版，防闪烁 |
| `draw call` | 一次绘制调用，每个 Mesh 一次 |

---

## 1. 基础（第 1 课）

| 术语 | 一句话 | 课 |
|---|---|---|
| `WebGLRenderer` | 持有 WebGL 上下文，真正画东西的对象 | 01 |
| `Scene` | 容器，只维护一棵树，本身不显示 | 01 |
| `PerspectiveCamera` | 透视相机，参数 `fov / aspect / near / far` | 01 |
| `fov` | **垂直**视角（度），越大越广角 | 01 |
| `aspect` | 画布宽高比，必须跟着窗口更新 | 01 |
| `near` / `far` | 近/远裁剪面，比值太大 → 深度精度崩 | 01 |
| `setAnimationLoop` | 渲染循环，比手写 `requestAnimationFrame` 省心 | 01 |
| `Clock.getDelta()` | 距上一帧的秒数，约 0.0167（60fps） | 01 |
| `setPixelRatio` | 一个 CSS 像素对应几个物理像素，常写 `min(dpr, 2)` | 01 |
| `devicePixelRatio` | 设备像素比，Retina 屏常见 2 或 3 | 01 |
| `antialias` | 抗锯齿开关 | 01 |
| `toneMapping` | 把 HDR 亮度压到 0~1 的曲线 | 01 / 04 |
| `outputColorSpace` | 输出时转成 sRGB（r152+ 默认） | 01 / 05 |
| `OrbitControls` | 拖拽旋转/缩放的相机控制器 | 01 |

---

## 2. 变换与场景图（第 2 课）

| 术语 | 一句话 | 课 |
|---|---|---|
| `Object3D` | 所有 3D 对象的基类，能挂子级 | 02 |
| `Group` | 空对象，只提供位置/旋转，用来做层级 | 02 |
| `position / rotation / scale` | 局部变换三件套 | 02 |
| 本地矩阵 `M_local` | `T · R · S`，先缩放、再旋转、最后平移 | 02 |
| 世界矩阵 `matrixWorld` | `父级世界矩阵 × 本地矩阵` | 02 |
| `getWorldPosition` | 取世界坐标，内部会刷新祖先链 | 02 |
| `updateMatrixWorld` | 手动刷新整棵树的矩阵 | 02 |
| `Euler` | 欧拉角，(x, y, z) 三个角 + 一个 order | 02 |
| `order = 'XYZ'` | 表示矩阵链 `Rx·Ry·Rz`，**从右往左作用** | 02 |
| 欧拉角耦合 | 同一物体的两个角互相影响，轴会晃 | 02 |
| `Quaternion` | 四元数，任意轴旋转 + 可插值 + 无万向锁 | 02 |
| 万向锁 | 中间轴转到 ±90°，丢一个自由度 | 02 |
| `lookAt` | 让物体/相机朝向某点 | 02 / 04 |
| `simTime` | 绝对模拟时间，驱动周期性运动 | 02 |
| `phase` | 初始相位，必须写进公式，否则被每帧覆盖 | 02 |
| 参照系 | 一个角度/位移是“相对谁”的，决定挂载层级 | 02 |

---

## 3. 几何体（第 3 课）

| 术语 | 一句话 | 课 |
|---|---|---|
| `BufferGeometry` | 顶点属性 + 索引的容器 | 03 |
| `BufferAttribute` | 一条属性数组 + 每顶点几个数（itemSize） | 03 |
| `position` | 顶点坐标，数组长度 / 3 = 顶点数 | 03 |
| `normal` | 顶点法线，光照的输入 | 03 |
| `uv` | 贴图坐标，0~1 | 03 |
| `index` | 顶点编号列表，长度 / 3 = 三角形数 | 03 |
| 非索引几何体 | 每 3 个顶点自动组一个三角形 | 03 |
| 绕序（winding） | 逆时针 = 正面，写反了就“从外面看不见” | 03 |
| `side` | `FrontSide / BackSide / DoubleSide` | 03 |
| 孤儿顶点 | 非索引模式下多出来、画不到的顶点 | 03 |
| `computeVertexNormals` | 由三角形推顶点法线（会平均 → 平滑） | 03 |
| `flatShading` | 法线在片元着色器现算，硬边但不吃 normal 属性 | 03 |
| `needsUpdate` | 告诉 GPU “这份数组过期了，重新上传” | 03 |
| `setDrawRange` | 只画索引数组的一段 | 03 |
| `dispose()` | 释放 GPU 资源，GC 管不到 | 03 |
| 三角形扇（fan） | 一个中心点 + 一圈边缘点的索引结构 | 03 |
| `renderer.info.memory` | 当前几何体/纹理数量 | 03 |

---

## 4. 材质与光照（第 4 课）

| 术语 | 一句话 | 课 |
|---|---|---|
| `MeshBasicMaterial` | 不参与光照，直接输出颜色 | 04 |
| `MeshLambertMaterial` | 只有漫反射 `N·L` | 04 |
| `MeshPhongMaterial` | 漫反射 + 经验高光 `(N·H)^shininess` | 04 |
| `MeshStandardMaterial` | PBR：GGX 微表面 + 菲涅尔 + 能量守恒 | 04 |
| `albedo` | 基础色（材质 color / 颜色贴图） | 04 |
| `metalness` | 0 = 非金属（有漫反射），1 = 金属（没有漫反射） | 04 |
| `roughness` | 0 = 镜面，1 = 磨砂；只改高光分布，不改变总量 | 04 |
| `F0` | 垂直入射反射率，非金属约 0.04，金属≈自身颜色 | 04 |
| 菲涅尔 | 视角越掠射，反射越强 | 04 |
| `N·L` | 光照余弦，背光为负 → clamp 到 0 | 04 |
| `N·V` | 视角余弦，决定边缘亮度 | 04 |
| `H`（半程向量） | `normalize(L + V)`，高光中心 | 04 |
| GGX / `D` | 微平面法线分布，决定高光宽窄 | 04 |
| Smith / `G` | 微平面互相遮挡，掠射角变暗 | 04 |
| 能量守恒 | `kD + spec ≤ 1`，高光变宽必然变暗 | 04 |
| `kD` | 漫反射系数 `(1-F)(1-metalness)` | 04 |
| `1/π` | Lambert 的归一化常数，不能省 | 04 |
| `DirectionalLight` | 平行光，无衰减，`position` 只决定方向 | 04 |
| `PointLight` | 点光，`1/d²` 衰减 | 04 |
| `decay` | 衰减指数，物理值 = 2 | 04 |
| 物理光照单位 | r155 后 `intensity` 是坎德拉级别，点光要几百 | 04 |
| IBL | 用环境图当光源 | 04 |
| `PMREMGenerator` | 把环境图预过滤成辐照度 + 镜面反射图 | 04 |
| `scene.environment` | 环境贴图；只有 PBR shader 能采 PMREM 版本 | 04 |
| `ENVMAP_TYPE_PMREM` | 预过滤环境图的采样宏（PBR 专属） | 04 |
| `ENVMAP_TYPE_CUBE` | 普通立方体贴图，Lambert/Phong 只认这个 | 04 |
| `envMap / reflectivity / combine` | 非 PBR 材质的环境反射三件套 | 04 |

---

## 5. 纹理与颜色（第 5 课）

| 术语 | 一句话 | 课 |
|---|---|---|
| `Texture` | 一张图 + 一组采样规则 | 05 |
| `CanvasTexture` | 从 canvas 生成的纹理（程序化贴图） | 05 |
| `colorSpace` | 这张图的字节怎么解释：颜色（sRGB）还是数据（线性） | 05 |
| sRGB | 给暗部更多档位的非线性编码 | 05 |
| 线性空间 | 光照计算必须在的空间 | 05 |
| 发灰 | 漏设 sRGB → 暗部被抬亮 → 对比度塌陷 | 05 |
| `wrapS / wrapT` | UV 超出 0~1 时怎么办 | 05 |
| `RepeatWrapping` | 平铺 | 05 |
| `ClampToEdgeWrapping` | 取边缘像素拉长（默认） | 05 |
| `MirroredRepeatWrapping` | 镜像平铺 | 05 |
| `repeat` | UV 缩放倍数，**必须配 wrap 才生效** | 05 |
| `magFilter` | 放大时的插值，`NearestFilter` = 马赛克 | 05 |
| `minFilter` | 缩小时的插值，通常选 mipmap 系列 | 05 |
| `generateMipmaps` | 生成缩小版数组，防远处闪烁 | 05 |
| mipmap | 1/2、1/4… 的预缩小图，显存 +33% | 05 |
| 各向异性 `anisotropy` | 斜视时沿长轴多采样，治“远处糊” | 05 |
| 混叠 / 摩尔纹 | 采样频率低于纹理频率产生的假花纹 | 05 |
| POT / NPOT | 2 的幂 / 非 2 的幂尺寸，影响 wrap 与 mipmap 支持 | 05 |
| 图集 atlas | 多张小图拼一张大图，减少绑定与 draw call | 05 |
| `KTX2` / Basis | GPU 专用压缩纹理，显存降到 1/4~1/8 | 05 / 06 |
| `ASTC` / `ETC2` / `BC7` | 各平台的块压缩纹理格式 | 05 / 06 |
| `glTF` / `glb` | 模型容器格式，可内含 KTX2 纹理 | 05 / 06 |

---

## 6. 三张卡：算得出来的东西

### 卡 1：显存

```
贴图字节 = 宽 × 高 × 4        （RGBA，每通道 1 字节）
含 mipmap ≈ × 1.33
```

| 尺寸 | 显存 |
|---|---|
| 512² | 1 MB |
| 1024² | 4 MB |
| 2048² | 16 MB |
| 4096² | 64 MB |

### 卡 2：数量

```
顶点数   = position 数组长度 / 3
三角形数 = 有索引 ? index 长度 / 3 : 顶点数 / 3
索引长度 = 三角形数 × 3
```

### 卡 3：颜色 vs 数据

```
这张图的 128，是"人眼中的中灰"，还是"0.5 这个数"？

中灰 → 颜色贴图 → SRGBColorSpace
数值 → 数据贴图（normal / roughness / metalness / ao）→ NoColorSpace
```

---

## 7. 怎么用这张表

1. 遇到不认识的名词，先来这里查一句
2. 查完还想去上下文，按「课」列跳转：`01-scene-camera-loop.md` … `05-textures.md`
3. **每周挑 10 个自测**：遮住“一句话”那一列，看能不能说出来
4. 新学的名词往上加——这张表应该越写越长

---

## 8. 延伸

- `docs/3d-math-cheatsheet.md`：公式查表（点积、矩阵、投影、光照）
- `docs/04-light-formula.md`：光照符号逐个解释 + 颜色管线排查
- `node_modules/three/src/`：名字的最终出处
