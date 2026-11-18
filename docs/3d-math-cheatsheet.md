# 3D 开发常用公式速查

- 用途：写 3D 代码时**查**，不是**背**
- 标注了 three.js 对应 API 与 r187 源码位置（`node_modules/three/src/...`），对照着看最快
- 所有角度默认是**弧度**；`deg = rad × 180 / π`

> 用法建议：先在上面的「常用 15 个」里找；找不到再看分节。每个公式都配了一句"什么时候用"。

---

## 0. 常用 15 个（真正常用的就这些）

| 要做什么 | 公式 | three.js |
|---|---|---|
| 两点距离 | `dist = │b - a│` | `a.distanceTo(b)` |
| 单位化 | `v̂ = v / │v│` | `v.normalize()` |
| 两向量夹角 | `cosθ = (a·b) / (│a││b│)` | `a.angleTo(b)` |
| 投影长度 | `proj = (a·b) / │b│` | `a.dot(b)` |
| 求垂直轴 | `c = a × b` | `a.cross(b)` |
| 三角形法线 | `n = normalize((b-a) × (c-a))` | `geom.computeVertexNormals()` |
| 世界坐标 | `M_world = M_parent · M_local` | `obj.getWorldPosition()` |
| 局部矩阵 | `M = T · R · S` | `matrix.compose(pos, quat, scale)` |
| 绕轴旋转 | 四元数 `q = (axis·sin(θ/2), cos(θ/2))` | `quat.setFromAxisAngle()` |
| 任意角绕 Y | `x' = x·cosθ + z·sinθ`，`z' = -x·sinθ + z·cosθ` | — |
| 帧率无关插值 | `x += (target - x) · (1 - e^(-k·dt))` | `MathUtils.damp()` |
| Lambert 漫反射 | `L = albedo/π · (N·L) · irradiance` | `MeshLambertMaterial` |
| 点光衰减 | `E = I / d²` | `decay = 2` |
| Blinn-Phong 高光 | `(N·H)^s`，`H = normalize(L + V)` | `MeshPhongMaterial` |
| 屏幕坐标 | `x_s = (x_ndc + 1)/2 · width` | `Vector3.project()` |

---

## 1. 向量

```js
// 长度、单位化
|v|      = √(x² + y² + z²)
v̂       = v / |v|                // 除零要保护：|v| < 1e-8 时跳过

// 点积（标量）：投影、夹角、背面判断
a·b      = ax·bx + ay·by + az·bz
a·b      = |a||b|cosθ   →  θ = acos(a·b / (|a||b|))
// 用途：N·L 判断受光面、N·V 判断是否朝向相机、|a·b|≈0 判断垂直

// 叉积（向量）：求垂直方向、法线、面积
a×b      = (ay·bz - az·by,  az·bx - ax·bz,  ax·by - ay·bx)
|a×b|    = |a||b|sinθ  = 平行四边形面积  →  三角形面积 = |a×b|/2
// 用途：由两条边求面法线、由 up 和 forward 求 right、判断左右手

// 投影：把 v 投到单位方向 d 上
v∥       = (v·d)·d
v⊥       = v - v∥

// 反射（镜面、水面）
r        = d - 2(d·n)·n

// 折射（玻璃、水）；η = n1/n2
cosθi    = -d·n
sin²θt   = η²(1 - cos²θi)
t        = η·d + (η·cosθi - √(1 - sin²θt))·n    // 全反射时 sin²θt > 1
```

| three.js | 说明 |
|---|---|
| `v.length()` / `lengthSq()` | 比较距离用 `lengthSq` 省一次开方 |
| `v.normalize()` | **原地修改**并返回自己 |
| `v.dot(u)` / `v.cross(u)` | `cross` 原地修改 |
| `v.project(camera)` / `unproject(camera)` | 世界 → NDC / 反向 |
| `v.applyMatrix4(m)` | 注意会做透视除法 |

> 工程细节：**只比较距离时用 `distanceToSquared`**，避免 `sqrt`。每帧几百次调用能看出差别。

---

## 2. 变换

### 2.1 局部矩阵与合成顺序

```
M_local = T · R · S
M_world = M_parent · M_local = M_root · ... · M_leaf
```

**点是这样被作用的**（从右往左）：先缩放，再旋转，最后平移。

```js
p_world = M_root × ... × M_leaf × p_local
```

手算一层的流程（本课反复用）：

```
p ← R·p        // 先转（或缩放）
p ← p + t      // 再加平移
```

层级之间：**从叶子往根走**，每层做一次"先转后移"。

### 2.2 绕坐标轴的旋转矩阵

```
Rx(θ)： y' =  y·cosθ - z·sinθ      z' =  y·sinθ + z·cosθ
Ry(θ)： x' =  x·cosθ + z·sinθ      z' = -x·sinθ + z·cosθ
Rz(θ)： x' =  x·cosθ - y·sinθ      y' =  x·sinθ + y·cosθ
```

记法：**是哪个轴，那个轴的坐标就不动**。

源码：`src/math/Matrix4.js` 的 `makeRotationX/Y/Z`。

### 2.3 欧拉角

```
R = Rx(θx) · Ry(θy) · Rz(θz)      // three.js 默认 order = 'XYZ'
```

- `Euler.DEFAULT_ORDER` 是 `'XYZ'`（`src/math/Euler.js`）
- **顺序不同结果不同**：`'XYZ'` 和 `'ZYX'` 是两套姿态
- 三个角共享一个矩阵，互相纠缠 → 需要分层（第 2 课的重点）

**万向锁**：中间那个轴转到 ±90° 时，另两个轴退化成同一个轴，丢失一个自由度。
表现：某个方向怎么转都转不动。解法：换 `order`，或用四元数。

### 2.4 四元数

```
轴角 → 四元数：  q = (axis·sin(θ/2),  cos(θ/2))
旋转向量：        v' = q · v · q⁻¹        （q⁻¹ = 共轭，单位四元数时）
乘法不交换：      q1 · q2 ≠ q2 · q1       （顺序 = 先转 q2 再转 q1）
插值：            slerp(q1, q2, t) = (sin((1-t)Ω)·q1 + sin(tΩ)·q2) / sinΩ
```

| three.js | 用途 |
|---|---|
| `quat.setFromAxisAngle(axis, angle)` | 轴角转四元数 |
| `quat.setFromEuler(euler)` | 欧拉角转四元数 |
| `quat.slerp(q, t)` | 平滑旋转（相机跟随、朝向转身） |
| `quat.invert()` / `conjugate()` | 求逆（单位四元数二者等价） |

**什么时候用四元数**：任意轴旋转、需要插值、需要层层相乘又不想要万向锁。相机朝向基本都要。

### 2.5 法线矩阵

```
N = transpose(inverse(mat3(M)))
```

**为什么不能直接用 M**：非均匀缩放会把法线拉斜，导致光照方向错。只有"旋转 + 均匀缩放"时 `mat3(M)` 才可以直接用。

源码：`WebGLRenderer` 里 `normalMatrix.getNormalMatrix(modelViewMatrix)`。

### 2.6 相机基向量（lookAt）

```
z = normalize(eye - target)     // 相机看向 -z
x = normalize(cross(up, z))
y = cross(z, x)
```

对应 `Matrix4.lookAt()`；`Object3D.lookAt()` 用的是同一套。

---

## 3. 相机与投影

### 3.1 FOV 与焦距

```
焦距（像素）  f = (height / 2) / tan(fov / 2)
等效换算      fov = 2·atan(height / (2f))
```

**经验值**：50mm 全幅 ≈ 39.6° FOV（竖直）；广角 24mm ≈ 73.7°。人眼观感 ≈ 45°–60°。

### 3.2 透视投影矩阵

```
f = 1 / tan(fov/2)

     ⎡ f/aspect   0     0                    0                ⎤
P =  ⎢ 0          f     0                    0                ⎥
     ⎢ 0          0   (far+near)/(near-far)  2·far·near/(near-far) ⎥
     ⎣ 0          0    -1                    0                ⎦
```

源码：`src/math/Matrix4.js` → `makePerspective()`（WebGL 约定，NDC z ∈ [-1, 1]）。

**深度精度**：`near` 越小，远处 z 精度越差（精度大致按 1/z 分布）。
`near/far` 比例别拉太大，典型 `0.1 ~ 1000`；要更稳就用对数深度缓冲。

### 3.3 NDC 与屏幕坐标

```
透视除法：  p_ndc = p_clip / p_clip.w
NDC 范围：  x, y ∈ [-1, 1]，z ∈ [-1, 1]（WebGL）

屏幕：
  x_s = (x_ndc + 1) / 2 · width
  y_s = (1 - y_ndc) / 2 · height      // 注意 y 翻转：NDC 向上，屏幕向下
  depth = (z_ndc + 1) / 2
```

| three.js | 用途 |
|---|---|
| `v.project(camera)` | 世界 → NDC |
| `v.unproject(camera)` | NDC → 世界 |
| `raycaster.setFromCamera(ndc, camera)` | 屏幕点击 → 射线 |

### 3.4 射线（Raycaster 的数学本质）

```
射线：      P(t) = o + t·d，t ≥ 0，d 必须单位化
反投影：    o = 相机位置
            d = unproject(ndc 点) - o，再归一化
```

### 3.5 视锥剔除

6 个平面用视图投影矩阵直接提取（Gribb–Hartmann）：

```
plane[i] = 矩阵第 4 列 ± 第 i 列，再归一化
球在视锥内  ⟺  对全部 6 个平面：dot(n, c) + d > -r
```

three.js：`Frustum.setFromProjectionMatrix()` + `intersectsSphere()`。

---

## 4. 光照与 PBR

### 4.1 漫反射

```
Lambert：        L_o = albedo/π · (N·L) · E
Half-Lambert：   (N·L)·0.5 + 0.5        // 让背光面不死黑，非物理
```

`1/π` 是 BRDF 归一化系数，**不是可省的常数**——省了材质会偏亮。

### 4.2 高光

```
Phong：        spec = (R·V)^s
Blinn-Phong：  H = normalize(L + V)，spec = (N·H)^s
```

`Blinn-Phong` 比 `Phong` 便宜且高光形状更自然，three.js 的 `MeshPhongMaterial` 用它。

### 4.3 菲涅尔（Fresnel）

```
Schlick：F(θ) = F0 + (1 - F0)(1 - cosθ)^5
        其中 cosθ = V·H（镜面）或 N·V（IBL）
F0 = ((n - 1)/(n + 1))²          // 垂直入射反射率
```

**用途**：边缘变亮、玻璃/水面、金属。`F0 ≈ 0.04` 是大多数绝缘体（塑料、水、玻璃）。
金属的 `F0` 用自身颜色（albedo）。

粗糙度版本（three.js 用）：

```
F = F0 + (max(vec3(1 - roughness), F0) - F0) · (1 - V·H)^5
```

### 4.4 Cook-Torrance 镜面项

```
spec = D · G · F / (4 · (N·L) · (N·V))
```

| 项 | 公式 | 管什么 |
|---|---|---|
| D（法线分布，GGX / Trowbridge-Reitz） | `α² / (π · ((N·H)²(α² - 1) + 1)²)` | 高光形状：粗糙 → 变宽 |
| G（几何遮蔽，Smith-Schlick） | `G1(x) = x / (x(1-k) + k)`，`k = (α+1)²/8` | 掠射角的遮挡 |
| F（菲涅尔） | 见 4.3 | 边缘反射 |

其中 `α = roughness²`（three.js 的约定）。

### 4.5 能量守恒

```
kD = (1 - F) · (1 - metalness)
L_o = (kD · albedo/π + spec) · (N·L) · E
```

- 金属：`albedo` 全部转为 `F0`，没有漫反射
- 非金属：`F0 = 0.04`，`albedo` 走漫反射
- **roughness 和 metalness 不是审美参数**，而是"这是不是金属、表面多粗糙"的物理描述

### 4.6 点光 / 聚光衰减

```
物理衰减：        E = I / d²
three.js 实现：   falloff = 1 / max(d^decay, 0.01)
                 有 distance 时再乘 (1 - (d/distance)⁴)² 作为窗口
```

源码：`src/renderers/shaders/ShaderChunk/lights_pars_begin.glsl.js` → `getDistanceAttenuation`。

> r155+ 之后 `useLegacyLights` 移除，`PointLight.intensity` 是**坎德拉**，所以第 2 课写 220 才够亮。

### 4.7 IBL（环境光照）

```
L_o ≈ (albedo/π) · irradiance(N)                      // 漫反射：预计算辐照度图
    + prefilteredEnv(R, roughness) · (F0·A + B)       // 镜面：split-sum 近似
```

`A、B` 来自 BRDF LUT 或解析近似（Karis）：

```glsl
vec2 EnvBRDFApprox( float NoV, float roughness ) {
  const vec4 c0 = vec4( -1, -0.0275, -0.572, 0.022 );
  const vec4 c1 = vec4( 1, 0.0425, 1.04, -0.04 );
  vec4 r = roughness * c0 + c1;
  float a004 = min( r.x * r.x, exp2( -9.28 * NoV ) ) * r.x + r.y;
  return vec2( -1.04, 1.04 ) * a004 + r.zw;
}
```

three.js：`PMREMGenerator` 生成预过滤环境图，`scene.environment` 使用。

---

## 5. 颜色

```
sRGB → Linear：  c ≤ 0.04045 ? c/12.92 : ((c + 0.055)/1.055)^2.4
Linear → sRGB：  c ≤ 0.0031308 ? c·12.92 : 1.055·c^(1/2.4) - 0.055
近似（2.2）：    linear ≈ srgb^2.2
```

**规则**：所有光照计算在**线性空间**做；贴图设 `colorSpace = SRGBColorSpace` 让 three 自动解码；输出时再编码。

```
色调映射（ACES 近似，Narkowicz）：
  x(2.51x + 0.03) / (x(2.43x + 0.59) + 0.14)
```

three.js 的 `ACESFilmicToneMapping` 用的是 RRT/ODT 拟合（带矩阵），源码在
`src/renderers/shaders/ShaderChunk/tonemapping_pars_fragment.glsl.js`。

```
曝光：color *= exposure                // renderer.toneMappingExposure
```

---

## 6. 几何计算

```js
// 三角形法线（未归一化，长度 = 2×面积）
n = (b - a) × (c - a)
n̂ = normalize(n)

// 平面方程：dot(n, p) + d = 0
d = -dot(n, p0)

// 重心坐标（点在三角形内 ⟺ u,v,w 全 ≥ 0）
p = u·a + v·b + w·c,   u + v + w = 1

// 点在线段上的最近点（clamp 是唯一的关键）
t = clamp(dot(p - a, b - a) / dot(b - a, b - a), 0, 1)
closest = a + t·(b - a)

// AABB 相交
overlap ⟺ 所有轴：a.min[i] ≤ b.max[i] && b.min[i] ≤ a.max[i]
```

### 6.1 射线求交

```js
// 射线-球（d 已归一化）：oc = o - c
b = dot(oc, d),  c0 = dot(oc,oc) - r²
disc = b² - c0
若 disc < 0 无交点；t = -b - √disc（取较小正值）

// 射线-平面
t = dot(p0 - o, n) / dot(d, n)

// 射线-三角形（Möller–Trumbore）
e1 = b - a,  e2 = c - a
p  = d × e2,  det = e1·p
若 |det| < 1e-8 平行
u = (o - a)·p / det，若 u ∉ [0,1] 不在
q = (o - a) × e1
v = (d·q) / det，若 v < 0 或 u + v > 1 不在
t = (e2·q) / det
```

| three.js | 用途 |
|---|---|
| `Raycaster.intersectObjects()` | 已封装 |
| `Box3.intersectsBox()` / `Sphere.intersectsSphere()` | 包围体粗筛 |
| `Box3.setFromObject()` | 生成包围盒 |

---

## 7. 插值与动画

```js
// 线性插值
lerp(a, b, t) = a + (b - a)·t

// 帧率无关的阻尼（比 lerp(a,b,0.1) 正确）
x += (target - x) · (1 - Math.exp(-k·dt))

// 平滑阶跃
smoothstep(t) = t²(3 - 2t)
smootherstep(t) = t³(t(6t - 15) + 10)

// 三次贝塞尔
B(t) = (1-t)³P0 + 3(1-t)²t·P1 + 3(1-t)t²·P2 + t³P3

// Catmull-Rom（过控制点，做相机路径最好用）
P(t) = 0.5 · [ 2P1
             + (-P0 + P2)·t
             + (2P0 - 5P1 + 4P2 - P3)·t²
             + (-P0 + 3P1 - 3P2 + P3)·t³ ]

// 插值朝向
quat.slerp(target, 1 - Math.exp(-k·dt))
```

| three.js | 用途 |
|---|---|
| `MathUtils.lerp / damp / smoothstep / clamp` | 数值 |
| `CubicBezierCurve3` / `CatmullRomCurve3` | 路径 |
| `curve.getPointAt(t)` | 按**弧长**取点（`getPoint` 是按参数，会变速） |

> 相机沿曲线飞：用 `getPointAt` 而不是 `getPoint`，否则快慢不均。

---

## 8. 朝向与相机辅助

```js
// 球面坐标（φ 从 +Y 起算，θ 绕 Y）
x = r·sinφ·cosθ
y = r·cosφ
z = r·sinφ·sinθ

// 由 yaw / pitch 求方向（three 约定 forward = -Z）
forward = ( -sin(yaw)·cos(pitch), sin(pitch), -cos(yaw)·cos(pitch) )

// 相机环绕某点的位置（OrbitControls 的手写版）
pos = target + spherical(radius, phi, theta)
camera.position.copy(pos)
camera.lookAt(target)

// 屏幕像素比
dpr = Math.min(devicePixelRatio, 2)     // 超过 2 只费性能，看不出差别
```

---

## 9. 性能相关的量

| 现象 | 公式/原因 | 对策 |
|---|---|---|
| 远处 z-fighting | 深度精度 ∝ 1/z | 拉大 near，或 `logarithmicDepthBuffer` |
| 手机发烫 | 像素数 = 宽×高×dpr² | `setPixelRatio(min(dpr, 2))` |
| 大场景掉帧 | 剔除后三角形数 | `frustumCulled`、LOD、`InstancedMesh` |
| 透明排序错 | 按相机距离排序 | 手动 `renderOrder` |
| 法线偏移 | 低多边形 + 高光 | `flatShading` 或提高分段 |

---

## 10. 公式 → three.js API 速查

| 公式 | API | 源码 |
|---|---|---|
| 欧拉角 | `Euler`，默认 `'XYZ'` | `src/math/Euler.js` |
| 旋转矩阵 | `Matrix4.makeRotationX/Y/Z` | `src/math/Matrix4.js` |
| 透视投影 | `Matrix4.makePerspective` | 同上 |
| 局部矩阵 | `Matrix4.compose` | 同上 |
| 环绕矩阵 | `Matrix4.lookAt` / `Object3D.lookAt` | 同上 |
| 四元数 | `Quaternion.setFromAxisAngle / slerp` | `src/math/Quaternion.js` |
| 法线矩阵 | `Matrix3.getNormalMatrix` | `src/math/Matrix3.js` |
| 视锥 | `Frustum.setFromProjectionMatrix` | `src/math/Frustum.js` |
| 射线 | `Raycaster.setFromCamera` | `src/core/Raycaster.js` |
| 点光衰减 | `getDistanceAttenuation` | `src/renderers/shaders/ShaderChunk/lights_pars_begin.glsl.js` |
| 色调映射 | `ACESFilmicToneMapping` | `src/renderers/shaders/ShaderChunk/tonemapping_pars_fragment.glsl.js` |
| 色彩空间 | `Color.setRGB(r,g,b, LinearSRGBColorSpace)` | `src/math/Color.js` |
| 曲线 | `CatmullRomCurve3.getPointAt` | `src/extras/curves/` |
| 环境光 | `PMREMGenerator` | `src/extras/PMREMGenerator.js` |

---

## 11. 十个最常见的错

| 症状 | 原因 | 修法 |
|---|---|---|
| 转了但方向反了 | 正角度方向记错 / 右手系 | 用 `x' = z, z' = -x` 核对一个特例 |
| 自转轴晃 | 倾角和自转写在同一个 rotation 上 | 拆成两层节点 |
| 光照偏亮 | 漫反射省了 `1/π` | 检查 BRDF 归一化 |
| 非均匀缩放后光照错 | 法线没用逆转置矩阵 | `normalMatrix.getNormalMatrix` |
| 材质灰暗发脏 | 贴图没设 sRGB / 在线性空间做了显示转换 | `texture.colorSpace = SRGBColorSpace` |
| 物体"打滑" | `getPoint` 而非 `getPointAt` | 按弧长取点 |
| 相机抖动 | 每帧 `lerp(0.1)` 依赖帧率 | 改成 `1 - exp(-k·dt)` |
| 看起来在抖/闪 | z-fighting | 拉开 near/far，或错开表面 |
| 点击拾取偏了 | 忘了 y 翻转 / 没除 dpr | `(x/w)*2-1`、`-(y/h)*2+1` |
| 越转越快 | 用了 `+=` 累加但又有 `delta` 缩放错误 | 改用绝对时间 `simTime * speed` |

---

## 12. 延伸

- 变换与矩阵的图解：`manual/pages/matrix-transformations.html`
- PBR 细节：`docs/pbr.md`（本仓库）
- 数学库源码：`src/math/`（Vector3、Matrix4、Quaternion、Ray）
- 可视化验证：每课按 <kbd>A</kbd> 看坐标轴，用 `AxesHelper` / `GridHelper` / `CameraHelper` 把看不见的量画出来
