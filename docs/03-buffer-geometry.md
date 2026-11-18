# 第 3 课 · 手写 BufferGeometry

- 页面：`/lessons/03-buffer-geometry.html`
- 代码：`src/lessons/03-buffer-geometry.js`
- 目标：能把"几何体"当成**数组**看，能手写三角形和网格，知道 `needsUpdate` 为什么存在

---

## 0. 一句话

**几何体 = 一串顶点属性 + 一份索引。**`BoxGeometry` 只是别人替你填好的数组。

```js
geometry.attributes.position   // Float32Array，每 3 个数一个顶点
geometry.index                 // 哪些顶点组成哪个三角形
geometry.attributes.normal     // 光照用的方向
geometry.attributes.uv         // 贴图用的坐标
```

---

## 1. 心智模型

```
几何体
├── position   [x,y,z, x,y,z, x,y,z, ...]   顶点在哪
├── normal     [nx,ny,nz, ...]              表面朝哪（光照靠它）
├── uv         [u,v, ...]                   贴图贴在哪
└── index      [0,1,2, 0,2,3, ...]          每 3 个数 = 1 个三角形

GPU 只认"数组 + 布局"，不认对象。
所以 BufferAttribute = { 数组, 每个顶点占几个数 }
```

**关键区别**：JS 里你看到的是数组，GPU 里是一块显存 buffer。
`array` 和 buffer 是**两份数据**，改完数组必须喊一声 `needsUpdate = true` 才会重新上传。

---

## 2. 逐个概念

### 2.1 三角形：最小的单位

```js
const g = new THREE.BufferGeometry();
g.setAttribute( 'position', new THREE.Float32BufferAttribute( [
  - 1.3, - 1.0, 0,
  1.3, - 1.0, 0,
  0, 1.2, 0,
], 3 ) );
```

没有索引时，**每 3 个顶点自动组成一个三角形**。

### 2.2 索引：复用顶点

```js
g.setIndex( [ 0, 1, 2, 0, 2, 3 ] );   // 4 个顶点画 2 个三角形
```

| | 顶点数 | 索引数 | 三角形 |
|---|---|---|---|
| 不用索引 | 6 | 0 | 2 |
| 用索引 | **4** | 6 | 2 |

省的不只是内存：**顶点着色器少算 2 次**。网格越密，差距越大（球面差 2 倍以上）。

### 2.3 绕序（winding）：正面朝哪

three.js 默认 **逆时针 = 正面**（从物体外面看）。用右手定则：

```
手指沿 0 → 1 → 2 弯曲，拇指指向 = 这个面的正面
```

所以索引写 `[0,1,2]` 和 `[0,2,1]` 画出来是**同一个三角形**，但一个朝你、一个背你。

- `side: FrontSide`（默认）：背面不画，省一半片元
- `side: DoubleSide`：两面都画，但光照仍在用同一个法线
- 画反了的表现：**物体从外面看不见，转进去反而看见了**

### 2.4 立方体为什么是 24 个顶点

几何上只有 8 个角，但代码里必须写 24 个：

```
一个角被 3 个面共用，3 个面的法线不同（±X、±Y、±Z）
顶点 = (位置 + 法线 + UV) 的元组
→ 位置相同、法线不同 → 没法共用同一个顶点
→ 每个面各存 4 个，共 6 × 4 = 24
```

**这就是"接缝"的来源**：颜色断、贴图断、法线断的地方，顶点必须重复。

> 反过来，球体的 UV 接缝（本初子午线那一列）也是这个原因，所以 `SphereGeometry` 的顶点数比"理论最小"多一些。

### 2.5 法线：两种算法

```js
// ① 自己写（每个面一个方向）—— 立方体要的就是这个
normals.push( ...face.n );

// ② 让 three 从三角形推 —— 平均法线，适合曲面
geometry.computeVertexNormals();
```

`computeVertexNormals()` 做的事：

```
对每个三角形算面法线 (b-a)×(c-a)
累加到它的 3 个顶点上
归一化
```

所以共享的顶点会得到"平均方向"——这就是**平滑着色**。想要棱角分明，要么按面拆顶点（24 顶点法），要么 `material.flatShading = true`。

### 2.6 动态几何：波浪

```js
const arr = geometry.attributes.position.array;

for ( let i = 0; i < arr.length; i += 3 ) {
  arr[ i + 1 ] = waveHeight( arr[ i ], arr[ i + 2 ], simTime );  // 只改 y
}

geometry.attributes.position.needsUpdate = true;   // ← 忘了这句，画面纹丝不动
geometry.computeVertexNormals();                    // 形状变了，法线也得重算
```

两个坑：

1. **忘了 `needsUpdate`**：CPU 数据变了，GPU 那份还是旧的 → 画面不动，但 `console.log` 打印出来是新值
2. **忘了重算法线**：形状在动，明暗却是旧的 → 看起来像"贴了张假图"

性能提示：频繁更新的属性可以提前声明用途——

```js
geometry.attributes.position.setUsage( THREE.DynamicDrawUsage );
```

---

## 3. 代码走读（`src/lessons/03-buffer-geometry.js`）

1. `triangleGeometry()`：3 顶点，`computeVertexNormals` 兜底
2. `quadGeometry()`：4 顶点 + 索引，演示复用
3. `cubeGeometry()`：24 顶点，手写每个面的法线与 UV
4. `waveGeometry()`：`(48+1)²` 个顶点，坐标由公式算出
5. `setMode()`：换几何体时 `dispose()` 旧的，否则显存泄漏
6. 循环：波浪模式下逐帧改 `position.array` 并 `needsUpdate`

按键：<kbd>1</kbd>–<kbd>4</kbd> 切换，<kbd>B</kbd> 单面/双面/背面三态，<kbd>W</kbd> 线框，<kbd>N</kbd> 法线，<kbd>空格</kbd> 暂停。

---

## 4. 动手实验

| 实验 | 预期现象 | 说明 |
|---|---|---|
| 三角形模式按 <kbd>B</kbd> 切双面 | 从背面也能看见 | `side` 决定要不要画背面 |
| 立方体模式连按两次 <kbd>B</kbd>（背面） | 直接看到盒子"内壁" | 正面被剔除，只剩顺时针面 → 绕序的真正含义 |
| 方形模式把索引改成 `[0,2,1,0,3,2]` | 整个面消失 | 绕序反了，正面变背面 |
| 立方体模式按 <kbd>N</kbd> | 每个面法线朝外 | 24 顶点的意义 |
| 三角形/方形按 <kbd>N</kbd> | 只看到几个小绿点 | 法线正对相机，几乎看不出长度；拖到侧面才明显 |
| 立方体模式删掉 `normals.push` | 光照错乱 / 全黑 | 缺属性时 three 不会替你补 |
| 波浪模式注释 `needsUpdate` | 静止 | CPU 改了，GPU 不知道 |
| 波浪模式注释 `computeVertexNormals` | 形状动、明暗不动 | 法线是缓存的 |
| `setDrawRange(0, 3)` | 只剩一个三角形 | 索引是"从哪画到哪" |

---

## 5. 自检

<details>
<summary>1. 两个三角形共用一个顶点，可能出什么问题？</summary>

看你需要它的**法线**和 **UV** 是不是也一样。

- 同一个平面上的两个三角形：法线相同，可以共用
- 立方体的一个角：三个面法线不同，不能共用 → 必须拆成 3 个顶点

**顶点能不能共用，取决于"属性是否完全一致"，而不是"位置是否相同"。**
</details>

<details>
<summary>2. `needsUpdate = true` 到底做了什么？</summary>

它把 `version` 加一。渲染时 three 发现版本变了，就把整个 `array` 重新上传到 GPU 的 buffer。

所以它**不是"重算"**，是"重传"。数据本身你在 JS 里已经改好了。

也解释了另一个现象：忘了它，`console.log` 打印的是新值，画面却是旧的——因为 GPU 那份没更新。
</details>

<details>
<summary>3. 为什么波浪每帧都要 `computeVertexNormals()`？</summary>

法线是**缓存**，不会随顶点自动变。形状动了而法线不动，光照算的就是旧表面的朝向，明暗会显得"贴上去的"。

代价：`computeVertexNormals` 要遍历所有三角形，顶点多时是 CPU 热点。真实项目里常用**顶点着色器**算法线（GPU 上算），或者直接接受近似。
</details>

<details>
<summary>4. `dispose()` 不调用会怎样？</summary>

几何体占的显存不会自动回收（JS 的 GC 管不到 GPU）。反复创建/销毁页面不释放，显存会一路上涨直到崩。

规则：**手动创建、手动销毁**——`geometry.dispose()`、`texture.dispose()`、`material.dispose()`。
</details>

---

## 6. 常见坑

| 现象 | 原因 | 修法 |
|---|---|---|
| 改了顶点，画面不动 | 忘了 `needsUpdate` | `attributes.position.needsUpdate = true` |
| 物体从外面看不见 | 绕序反了 / 单面材质 | 交换索引顺序，或 `side: DoubleSide` |
| 光照一片死黑 | 没 `normal` 属性 | `computeVertexNormals()` 或手写 |
| 立方体棱角被抹平 | 用了 8 顶点 + 共享法线 | 24 顶点 + 每面法线，或 `flatShading` |
| 切模式几次后卡顿 | 没 `dispose()` 旧几何体 | 换几何体前先 dispose |
| 波浪像"贴纸"在动 | 没重算法线 | 每帧 `computeVertexNormals()` |
| `count` 对不上 | 属性 itemSize 写错（3 写成 2） | 位置永远是 3 |

---

## 7. 延伸

- `src/core/BufferGeometry.js`：`setAttribute` / `setIndex` / `computeVertexNormals` 的实现
- `src/core/BufferAttribute.js`：`needsUpdate`、`setUsage`、`updateRanges`
- 官方示例：`webgl_geometry_*`、`webgl_buffergeometry_*`
- 下一课：材质与光照（PBR），把第 1 课的 `MeshStandardMaterial` 参数真正讲透
