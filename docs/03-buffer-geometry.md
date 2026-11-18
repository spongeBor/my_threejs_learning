# 第 3 课 · BufferGeometry

- 页面：`/lessons/03-buffer-geometry.html`
- 代码：`src/lessons/03.js`
- 目标：能自己造一张顶点网格；知道 `needsUpdate` 和法线为什么必须管

---

## 0. 一句话

**GPU 不认识"平面""球体"，它只认识两样东西：**

1. 一串扁平的顶点属性（`position` / `normal` / `uv` / `color`）
2. 一张索引表，说明哪三个顶点连成一个三角形

`BoxGeometry`、`SphereGeometry` 不过是"帮你把这些数组算好的函数"。

---

## 1. 顶点是扁平数组

```js
const positions = new Float32Array( 9409 * 3 );
// [x0,y0,z0, x1,y1,z1, x2,y2,z2, ...]
```

- 每 **3 个 float** 是一个顶点
- `BufferAttribute( positions, 3 )` 里的 `3` 就是"每个顶点几个分量"（叫 itemSize）
- `uv` 是每顶点 2 个分量；`color` 是 3 个

**为什么要扁平数组？** 因为 GPU 要的是连续内存块，一次上传、一次读取，不能是 `[{x,y,z}, ...]` 这种对象数组。

---

## 2. index：复用顶点

网格是 97 × 97 个顶点，但三角形是 96 × 96 × 2 = 18432 个。

如果不用索引，每个三角形都要写 3 个顶点，就要 `18432 × 3 = 55296` 个顶点数据，**5.8 倍冗余**。用索引之后，位置数据只需要 9409 份。

```js
indices[ i ++ ] = a; indices[ i ++ ] = c; indices[ i ++ ] = b;
indices[ i ++ ] = b; indices[ i ++ ] = c; indices[ i ++ ] = d;
```

一个格子的四个角 `a b c d`，拆成两个三角形：`(a,c,b)` 和 `(b,c,d)`。

---

## 3. 绕序：哪一面是正面

三角形顶点顺序决定了法线朝向。three.js 的约定：**从正面看是逆时针（CCW）**。

所以 `(a, c, b)` 而不是 `(a, b, c)` —— 顺序反了，法线就朝下，正面会变成背面，光照全黑。

改错的后果：`side: THREE.FrontSide` 时看不到面；改成 `THREE.DoubleSide` 能看到，但光照仍然是错的。

---

## 4. 每帧更新：`needsUpdate`

```js
geometry.attributes.position.needsUpdate = true;
```

这不是"通知 three.js"，是**通知 WebGL"这块显存里的 buffer 需要重新上传"**。

去掉它：CPU 上的数组确实在变（你 `console.log` 能看到），但 GPU 用的还是旧数据 → 波浪冻住。

> 记住：**改数据 ≠ GPU 知道数据变了。** 这是 WebGL 最常见的"为什么没反应"。

---

## 5. 法线：光照的方向依据

法线是"这个顶点朝哪个方向"。光照计算用它算 `dot(法线, 光线方向)`。

波浪每帧改了 y 坐标，但法线还停留在初始的 `(0,1,0)`：

- 表面起伏了
- 光照还以为它是平的
- 结果：颜色不随起伏变化，看起来像一张被揉皱的纸

```js
geometry.computeVertexNormals();   // 每帧重算
```

代价：它是 O(顶点数) 的 CPU 计算，SEG 调到 200 时就会明显掉帧。

---

## 6. UV

```js
uvs[ q ++ ] = ix / SEG;   // 0 → 1
uvs[ q ++ ] = iz / SEG;
```

UV 是"贴图坐标"，0~1 对应纹理的宽高。没有 UV，贴图就没法贴上去（第 5 课会用到）。

---

## 7. 代码走读（`src/lessons/03.js`）

| 段 | 内容 |
|---|---|
| 1 | 铺网格：`positions` + `uvs`，y 先置 0 |
| 2 | 索引：两个三角形一个格子，注意绕序 |
| 3 | 组装：`setAttribute` + `setIndex` |
| 4 | 顶点色：按高度插值，每帧更新 |
| 5 | 波浪函数：两个正弦叠加 |
| 6 | 循环：改 y → `needsUpdate` → `computeVertexNormals` |

---

## 8. 实验表

| 实验 | 现象 | 原因 |
|---|---|---|
| 注释 `position.needsUpdate` | 波浪冻住 | GPU 还在用旧 buffer |
| 注释 `computeVertexNormals()` | 表面像平的，光照不跟着起伏 | 法线没更新 |
| 把 `(a,c,b)` 改成 `(a,b,c)` | 地形变黑/看不见 | 绕序反了，正面朝下 |
| `side: DoubleSide` | 又看得见了 | 背面也渲染，但光照仍不对 |
| `SEG` 96 → 200 | 帧率下降 | 顶点数平方增长 + 每帧重算法线 |
| 按 <kbd>W</kbd> | 线框，能看到三角形 | `material.wireframe` |

---

## 9. 自检

<details>
<summary>1. 9409 个顶点、18432 个三角形，索引数组应该多长？</summary>

`18432 × 3 = 55296`。每个三角形要 3 个索引。

对照：如果不用索引，顶点数据要 55296 份，是现在的 5.8 倍。
</details>

<details>
<summary>2. 去掉 `needsUpdate`，波浪为什么停住？</summary>

`positions` 这个 Float32Array 是 CPU 内存里的普通数组。WebGL 在 GPU 上有一份拷贝，`needsUpdate = true` 才会触发重新上传。

不设它，你改的是 CPU 那份，GPU 那份纹丝不动 —— 所以画面不变，但 `console.log` 里的值是变的。

</details>

<details>
<summary>3. 去掉 `computeVertexNormals()`，光照为什么不对？</summary>

法线还是初始的 `(0,1,0)`，也就是"整个表面都是平的、朝天"。

光照只看法线，不看你顶点实际在哪，所以高光和明暗不会随着波峰波谷变化，地形看起来像一张平面的蓝色纸。
</details>

<details>
<summary>4. 为什么 SEG 从 96 提到 200，帧率掉得比想象中快？</summary>

顶点数是 `(SEG+1)²`，SEG 翻倍 → 顶点数 ×4。同时每帧还要遍历所有顶点改 y、改颜色、重算法线。

这就是"CPU 每帧动全部顶点"的代价 —— 第 10 课会用 GPU 顶点着色器把这件事搬到显卡上。
</details>

---

## 10. 常见坑

| 现象 | 原因 |
|---|---|
| 什么都不显示 | 没设 `index`，或三角形绕序反了 |
| 波浪不动 | `needsUpdate` 没设 |
| 光照死板 | 没重算法线 |
| 出现黑块/破面 | 索引越界，或顶点数和索引对不上 |
| 帧率暴跌 | 顶点数太大 + 每帧 CPU 遍历 |

---

## 11. 延伸

- `docs/pages/BufferGeometry.html`
- `docs/pages/BufferAttribute.html`
- 官方示例：`webgl_geometry_dynamic.html`（用 GPU 做波浪，对比本课的 CPU 版本）
- 下一课：材质与光照（PBR）
