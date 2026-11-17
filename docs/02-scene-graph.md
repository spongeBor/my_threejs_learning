# 第 2 课 · 变换与场景图

- 页面：`/lessons/02-solar-system.html`
- 代码：`src/lessons/02.js`
- 目标：理解"父级变换会传递给子级"，能自己设计层级；知道欧拉角什么时候会坑你

---

## 0. 一句话

场景图里每个物体**只存相对父级的变换**，世界矩阵是乘出来的：

```
世界矩阵(子) = 世界矩阵(父) × 局部矩阵(子)
```

所以"公转"不是某个 API，而是**父级旋转 + 子级在半径上**。

---

## 1. 心智模型

```
scene
└── orbitPivot          绕太阳转（rotation.y）        ← 父级一转，整棵子树跟着扫
    └── system          停在轨道半径（position.x）    ← 锚点，不转
        ├── tiltGroup   轴倾角（rotation.z 固定）
        │   └── mesh    自转（rotation.y）
        └── moonPivot   月球公转（rotation.y）
            └── moonMesh
```

关键结论：

| 你改的 | 影响范围 | 用在哪 |
|---|---|---|
| `orbitPivot.rotation.y` | 自己 + 全部子孙 | 公转 |
| `system.position.x` | 自己 + 全部子孙 | 轨道半径 |
| `mesh.rotation.y` | 只有自己 | 自转 |
| `moonPivot.rotation.y` | 只有月球 | 卫星公转 |

---

## 2. 为什么是五层

每一层只解决一件事，这就是"好层级"的标准：

| 层 | 职责 | 如果合并会怎样 |
|---|---|---|
| `orbitPivot` | 公转 | —— |
| `system` | 锚点：把"位置"和"姿态"解耦 | 卫星和倾角会互相纠缠 |
| `tiltGroup` | 固定倾角 | 与自转写在同一个 rotation 上，轴会晃（见第 3 节） |
| `mesh` | 自转 | —— |
| `moonPivot` | 卫星轨道 | 挂在 mesh 上会被地球自转带着甩 |

> 记住这句话：**一个变换节点只承担一个语义。** 机械臂、相机云台、角色挂点都是这个套路。

---

## 3. 欧拉角陷阱（本课重点）

错误写法：

```js
mesh.rotation.z = THREE.MathUtils.degToRad( 23.5 );  // 倾角
mesh.rotation.y = simTime * 1.2;                     // 自转
```

看起来合理，但地球会**像陀螺一样晃**：自转轴跟着自转一起绕圈。

原因：three.js 的欧拉角按固定顺序复合（默认 XYZ），本质是

```
R = Rx · Ry · Rz
```

两个角共享同一个矩阵，互相纠缠。自转轴 `(0,1,0)` 经过复合后会随 `rotation.y` 变化而改变方向。

正确写法：**分层**

```js
tiltGroup.rotation.z = THREE.MathUtils.degToRad( 23.5 );  // 外层：固定
mesh.rotation.y = simTime * 1.2;                          // 内层：在倾斜后的坐标系里转
```

数学上变成 `Rz(23.5°) · Ry(spin)` —— 倾角在外、自转在内，轴就稳定了。

**规律**：只要两个旋转有"先后顺序"的物理含义，就必须用两层节点拆开。

---

## 3.5 视觉可读性：为什么加了贴图和自转轴

> 这一节来自一次真实的返工：第一版行星是纯色球，结果**自转和倾角在画面上完全看不见**。

原因：球体是旋转对称的。绕 Y 轴转多少度，像素都一模一样。

后来补了三样东西：

| 道具 | 解决什么 | 实现 |
|---|---|---|
| 程序化经纬网贴图 | 自转、倾角有参照物 | `makePlanetTexture()`：canvas 画经纬线 + 斑点 |
| 自转轴线 | 倾角一眼可读 | `tiltGroup` 里一条 `Line`，从 -Y 到 +Y |
| 北极点标记 | 判断"哪边是北" | `tiltGroup` 里原点正上方一个小白球 |

按 <kbd>T</kbd> 可以切换轴线的显示。

**这不是美化，是调试手段。** 看不见的状态就没法验证——所以：

- 调旋转 → 加轴、加网格、加贴图
- 调相机 → 加 `CameraHelper`、加视锥线
- 调光照 → 加 `DirectionalLightHelper`
- 调骨骼 → 加 `SkeletonHelper`

three.js 的 `helpers/` 目录就是为这件事准备的。

## 4. 用绝对时间驱动

```js
let simTime = 0;

// 循环里
if ( ! paused ) simTime += delta * speed;

// 赋值
orbitPivot.rotation.y = simTime * revolution;
mesh.rotation.y = simTime * spin;
```

对比 `rotation.y += delta * speed`：

| | 绝对时间 | 增量累加 |
|---|---|---|
| 暂停 | 天然成立 | 要额外判断 |
| 变速 | 改一个变量 | 要改所有物体 |
| 长时间运行 | 不漂移 | 浮点误差累积 |
| 想跳到第 10 秒 | `simTime = 10` | 做不到 |

### 初始相位（phase）

```js
// ❌ 初始化时赋一次，第一帧就被覆盖
orbitPivot.rotation.y = index * 1.7;
loop: orbitPivot.rotation.y = simTime * speed;      // simTime = 0 → 回到 0°

// ✅ 相位参与公式
bodies.push( { ..., phase: index * 1.7 } );
loop: orbitPivot.rotation.y = b.phase + simTime * speed;
```

规律：**绝对时间驱动时，所有"常量"都必须写进同一个公式**，否则每帧都会被冲掉。

> 注意：这个错误在画面上几乎看不出来——`simTime` 从第一帧就开始涨，1 秒内行星就散开了。
> 所以判断"某行代码有没有生效"，不能靠肉眼，要用控制台打印或冻结状态。

---

## 5. 代码走读（`src/lessons/02.js`）

1. 星空：`BufferGeometry` + `Points`（第 3 课详讲）
2. 太阳：`MeshBasicMaterial`（不受光）+ `PointLight`（1/d² 衰减）
3. `PLANETS` 数据表：radius / orbit / revolution / spin / tilt
4. `forEach` 里搭层级：pivot → system → tiltGroup → mesh
5. 卫星：挂在 `system` 下
6. 轨道线：`LineLoop` + 圆形顶点
7. 键盘：空格暂停、↑↓ 调速、A 坐标轴、O 轨道线
8. 循环：`simTime` 驱动所有旋转

---

## 6. 动手实验

| 实验 | 预期现象 | 说明 |
|---|---|---|
| 地球 `tilt` 改 0 / 90 | 轴变正 / 躺着滚 | 倾角只影响自转轴 |
| 把倾角写进 `mesh.rotation.z` | 自转轴晃动 | 欧拉角复合 |
| 月球改挂到 `mesh` 下 | 月球被地球自转甩着转 | 继承父级旋转 |
| `system.position.x = 8` | 地球 + 月球一起外移 | 子级继承平移 |
| 火星加卫星 | 见练习 ④ | 检验是否理解挂载层级 |

### 练习 ④ 参考结构

```js
if ( planet.name === '火星' ) {
	const marsMoonPivot = new THREE.Group();
	system.add( marsMoonPivot );          // 挂 system，不挂 mesh

	const marsMoon = new THREE.Mesh(
		new THREE.SphereGeometry( 0.1, 24, 12 ),
		new THREE.MeshStandardMaterial( { color: 0xcfcfcf, roughness: 0.9 } )
	);
	marsMoon.position.x = 0.9;
	marsMoonPivot.add( marsMoon );
}
```

然后在循环里让它转：`marsMoonPivot.rotation.y = simTime * 3;`

---

## 7. 自检

<details>
<summary>1. 月球挂在 `mesh` 而不是 `system` 上，会怎样？</summary>

月球的轨道会被地球的自转带着转 —— 因为 `mesh` 的 `rotation.y` 会传给子级。看起来就是月球绕着地球"甩"，一天一圈，完全不符合物理。

原则：**卫星的轨道属于"行星系统"，不属于"行星本体"。**
</details>

<details>
<summary>2. 为什么倾角必须单独一层？</summary>

因为欧拉角是复合的。同一个物体上同时有 `rotation.z`（倾角）和 `rotation.y`（自转），两个旋转会互相影响，自转轴会绕圈。

分层之后变成 `父级(倾角) × 子级(自转)`，倾角固定在外层，自转只在内层坐标系里发生。
</details>

<details>
<summary>3. `orbitPivot` 转 90°，地球世界坐标从 (4.8, 0, 0) 变成什么？</summary>

`(0, 0, -4.8)`。

绕 Y 轴转 90° 的矩阵把 `(x, 0, 0)` 映射到 `(0, 0, -x)`（右手系，逆时针从上方看）。可以用 `getWorldPosition` 验证。
</details>

<details>
<summary>4. `getWorldPosition` 之前需要手动 `updateMatrixWorld` 吗？</summary>

通常不需要：`getWorldPosition` 内部会调 `updateWorldMatrix(true, false)`，先刷新祖先链。

但如果你的物体在**另一条分支**里刚刚被修改、还没渲染过，就要 `scene.updateMatrixWorld(true)`。
</details>

---

## 8. 常见坑

| 现象 | 原因 |
|---|---|
| 加载瞬间行星挤在同一条射线上 | `phase` 全是 0；只持续不到 1 秒，随后因速度不同散开（用控制台冻结才能看清） |
| 卫星穿过行星 | 轨道半径 < 行星半径 + 卫星半径 |
| 行星全黑 | 背光面（正常），或忘了 `PointLight` |
| 暂停后调速无效 | 暂停时 `simTime` 不累加，恢复后才会变 |
| 转了 90° 坐标不对 | 记混了绕 Y 轴旋转的方向（右手系） |

---

## 9. 延伸

- `Object3D` 文档：`docs/pages/Object3D.html`
- 矩阵与四元数：`manual/pages/matrix-transformations.html`
- 下一课：手写 `BufferGeometry`，离开"现成几何体"
