# 第 1 课 · 场景 / 相机 / 渲染循环

- 页面：`/lessons/01-hello-scene.html`
- 代码：`src/lessons/01.js`
- 目标：**能对着屏幕解释每一行**，并且能空手写出一个会自转的立方体

---

## 0. 一句话

three.js 的每一帧只做一件事：

```js
renderer.render( scene, camera );
```

它在回答三个问题：**谁在画（renderer）、画什么（scene）、从哪看（camera）**。

---

## 1. 心智模型

```
你的 JS 数据 ──▶ scene（一棵树）──▶ renderer ──▶ GPU ──▶ <canvas> 像素
                    ▲                  ▲
                  camera ──────────────┘
```

两个必须建立起来的直觉：

1. **`Scene` 不是画面，是容器。** `scene.add(obj)` 只是把物体挂到树上，不会画任何东西。
2. **只有 `render` 那一刻才会画。** 你改了 100 次 `rotation`，不调用 render，屏幕上什么都不会变。

---

## 2. renderer：三件套

```js
const renderer = new THREE.WebGLRenderer( { antialias: true } );
renderer.setPixelRatio( Math.min( window.devicePixelRatio, 2 ) );
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );
```

| 这一行 | 不写会怎样 |
|---|---|
| `antialias: true` | 物体边缘全是锯齿 |
| `setPixelRatio(≤2)` | Retina 屏上发糊；写 3 又白烧 9 倍像素 |
| `setSize(w, h)` | canvas 停在默认的 300×150 |
| `appendChild` | canvas 根本没插进页面 |

两个细节：

- `setSize` 用的是 **CSS 像素**，不要自己乘 pixelRatio，three 内部会处理
- `setPixelRatio` 要同时写进 resize 回调，否则把窗口拖到另一块屏幕（DPR 变了）就会糊

---

## 3. scene：容器 + 背景

```js
const scene = new THREE.Scene();
scene.background = new THREE.Color( 0x0b0e14 );
```

`background` 可以是纯色、纹理、立方体贴图（天空盒）。它和"雾"是两件事，第 5 课再说。

---

## 4. camera：四个参数各有后果

```js
new THREE.PerspectiveCamera( fov, aspect, near, far );
```

| 参数 | 含义 | 调大会怎样 |
|---|---|---|
| `fov` | 垂直视角（度） | 广角，透视畸变强，物体被"吸"向中心 |
| `aspect` | 画布宽 / 高 | 不等于画布比例 → 画面拉伸 |
| `near` | 近裁剪面 | 近处物体被切掉 |
| `far` | 远裁剪面 | 太大 → z-fighting，远处闪烁 |

经验值：`near / far` 的比值控制在 1000 以内。`0.0001 ~ 100000` 这种写法一定会出事。

> 相机默认朝 **-Z** 方向看。所以 `camera.position.z = 3` 时，原点的物体正好在视野里，不需要 `lookAt`。

---

## 5. mesh = 几何体 + 材质

```js
const cube = new THREE.Mesh(
	new THREE.BoxGeometry( 1, 1, 1 ),
	new THREE.MeshStandardMaterial( { color: 0x4f8cff, roughness: 0.35, metalness: 0.1 } )
);
scene.add( cube );   // ← 最容易漏的一行
```

**画面全黑，90% 是这三个原因：**

1. 忘了 `scene.add`
2. 用了 `MeshStandardMaterial` 但没打光
3. 相机背对物体，或物体在 `near/far` 之外

---

## 6. light：PBR 必须有光

```js
scene.add( new THREE.HemisphereLight( 0xbfd4ff, 0x1b2030, 1.2 ) );  // 环境底子

const dir = new THREE.DirectionalLight( 0xffffff, 2.5 );
dir.position.set( 3, 5, 2 );
scene.add( dir );                                                     // 明暗与高光
```

- `HemisphereLight`：保证背光面不是死黑
- `DirectionalLight`：**没有位置衰减**，只提供方向；`position` 决定光从哪边来
- 换成 `PointLight` 就有 1/d² 衰减（第 2 课的太阳）

---

## 7. 渲染循环与 delta

```js
const clock = new THREE.Clock();

renderer.setAnimationLoop( () => {
	const delta = clock.getDelta();      // 距上一帧的秒数
	cube.rotation.y += delta * 1.2;      // 每秒 1.2 弧度，和帧率无关
	renderer.render( scene, camera );
} );
```

三个要点：

1. **`render` 必须在循环里**。删掉它，画面永远停在最后一帧
2. **用 `delta` 而不是固定值**。写死 `0.016`，在 120Hz 屏上速度直接翻倍
3. `setAnimationLoop` 比手写 `requestAnimationFrame` 更省心：浏览器帮你对齐刷新率，WebXR 下也能用

### 状态 ≠ 像素

把 `render` 挪到循环外，你会看到"画面冻住但数据还在变"——因为**改变状态**和**把状态画出来**是两件事。第 10 课做"按需渲染"就靠这个区分。

---

## 8. resize：两行都不能少

```js
window.addEventListener( 'resize', () => {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();     // ← 忘了它，aspect 改了也不生效
	renderer.setPixelRatio( Math.min( window.devicePixelRatio, 2 ) );
	renderer.setSize( window.innerWidth, window.innerHeight );
} );
```

`updateProjectionMatrix()` 才是把参数重算成投影矩阵的那一步。

> 任何改动相机参数（fov / aspect / near / far / zoom）之后，都要调它。

---

## 9. 拆掉实验表

学习效率最高的一步：**故意弄坏，再修好**。

| 实验 | 现象 | 结论 |
|---|---|---|
| 注释 `setPixelRatio` | Retina 上发糊 | 一个 CSS 像素 ≠ 一个物理像素 |
| 注释 `setSize` | canvas 变成 300×150 | 渲染器不知道窗口多大 |
| 注释 `outputColorSpace` | **没变化** | 它恰好等于默认值，但你要知道有这个开关 |
| 材质换 Standard 不加光 | 全黑 | PBR 依赖光照 |
| `delta` 换成 `0.02` | 屏幕越快转得越快 | 转速必须与帧率解耦 |
| `render` 挪出循环 | 画面冻住 | 数据在变 ≠ 屏幕在刷新 |
| 拉窗口但注释 `updateProjectionMatrix` | 画面被拉伸 | 投影矩阵需要重算 |

---

## 10. 常见报错

| 现象 | 原因 | 修法 |
|---|---|---|
| `Failed to resolve module specifier "three"` | 没有 importmap / 路径错 | 用 vite 或补 importmap |
| 白屏 + CORS 报错 | `file://` 直接打开 | 必须走 http server |
| 全黑但 FPS 在跑 | 没光 / 相机位置错 / 忘了 add | 逐个排查 |
| 画面拉伸 | 没更新 `aspect` 或没调 `updateProjectionMatrix` | 见第 8 节 |
| 转得飞快 | 用了固定增量 | 改回 `delta` |

---

## 11. 自检

<details>
<summary>1. 把 `render` 放到循环外只调用一次，页面会显示什么？</summary>

画面停在调用 render 那一瞬间的样子（通常是初始角度），之后所有 `rotation` 变化都不会反映到屏幕上。

因为它只画了一帧。**渲染循环不是用来"让物体动"的，是用来"把状态翻译成像素"的。**
</details>

<details>
<summary>2. `delta` 换成固定 0.016，在 120Hz 屏上会怎样？</summary>

转速翻倍。120Hz 每秒画 120 帧，每帧都加 `0.016 × 速度`，一秒下来就是两倍的量。

顺便：写死 `0.02` 在 60Hz 上就已经比正确写法快 1.2 倍了。
</details>

<details>
<summary>3. 只改 `camera.aspect` 不调 `updateProjectionMatrix()`，画面会怎样？</summary>

被拉伸。`aspect` 只是存下来的数字，真正参与渲染的是**投影矩阵**，必须调用 `updateProjectionMatrix()` 才会重算。
</details>

<details>
<summary>4. `pivot.add(cube)` 之后 `cube.position.x = 2` 是相对谁？</summary>

相对 `pivot`。物体的 `position` 永远是**局部坐标**，世界坐标 = 父级世界矩阵 × 自己的局部矩阵。这正是第 2 课的内容。
</details>

---

## 12. 延伸

- 官方教程：`manual/pages/creating-a-scene.html`（three.js 仓库内）
- 渲染器 API：`docs/pages/WebGLRenderer.html`
- 下一步：第 2 课「变换与场景图」
