# 第 6 课 · glTF 与资源管线

- 页面：`/lessons/06-gltf.html`
- 代码：`src/lessons/06-gltf.js`
- 素材：`public/models/*.glb`（由 `pnpm assets` 生成，**不进版本库**）
- 目标：能加载模型、做进度条、改材质、正确释放

---

## 0. 一句话

**`.glb` 就是一个文件：一段 JSON + 一段二进制。** JSON 描述“场景图长什么样”，二进制装“顶点、索引、贴图”。

three.js 读完它，得到的就是一棵 `Object3D` 树——和第 2 课你手搭的那棵树没有任何区别。

---

## 1. 心智模型

```
model.glb
├── JSON chunk
│   ├── nodes      场景图（每个节点的 position/rotation/children）
│   ├── meshes     几何体引用
│   ├── accessors  顶点数据在哪、什么类型
│   ├── materials  PBR 参数
│   └── animations 关键帧
└── BIN chunk
    └── 顶点 / 索引 / 贴图字节

        ↓ GLTFLoader.parse()

THREE.Group（名字来自 nodes）
├── Mesh（geometry + material）
└── Group
    └── Mesh
```

**关键认知**：加载出来的不是“一个模型对象”，而是一棵**场景图**。你要自己在里面找东西。

---

## 2. glTF / glb 的区别

| | `.gltf` | `.glb` |
|---|---|---|
| 结构 | 纯 JSON（可能外挂 .bin 和贴图） | JSON + 二进制打包成一个文件 |
| 请求数 | 多个（模型 + bin + 每张贴图） | **1 个** |
| 适用 | 调试、人工编辑 | 生产环境 |

`.glb` 的内部布局：

```
[ 12 字节头 "glTF" + 版本 + 长度 ]
[ JSON chunk：场景描述 ]
[ BIN chunk：顶点数据 ]
```

可以用文本编辑器打开 `.gltf` 看结构，用十六进制看 `.glb` 的头。

---

## 3. 加载与进度

```js
const loader = new GLTFLoader();

loader.load(
	'/models/knot.glb',
	( gltf ) => { scene.add( gltf.scene ); },
	( xhr ) => {
		// xhr.loaded / xhr.total，注意 lengthComputable
		if ( xhr.lengthComputable ) console.log( ( xhr.loaded / xhr.total ) * 100 + '%' );
	},
	( err ) => console.error( err ),
);
```

三个必须知道的事：

1. **异步**。`loader.load()` 立刻返回，模型还没到。
2. **`xhr.total` 可能为 0**（服务端没给 `Content-Length`，或用了 gzip 流）。要判断 `lengthComputable`。
3. **多个文件用 `LoadingManager`** 汇总进度，`onProgress(url, loaded, total)` 里的 `total` 是**文件数**，不是字节数。

> 本地开发看着“瞬间完成”是正常的。真实网络里，5.8 MB 的模型在 4G 上要 1~2 秒——进度条是给这段时间用的。

---

## 4. 加载完成后要做的事

```js
gltf.scene.traverse( ( obj ) => {

	if ( ! obj.isMesh ) return;

	obj.castShadow = true;
	obj.material.envMapIntensity = 1.2;

	// 按名字找东西
	if ( obj.name === 'Cube' ) obj.material.color.set( 0xff6b6b );

} );
```

常见的四类处理：

| 需求 | 做法 |
|---|---|
| 找某个部件 | 按 `name` 找（导出时命名很重要） |
| 换材质 / 改参数 | `traverse` + `obj.material` |
| 用哪个动画 | `gltf.animations` + `AnimationMixer` |
| 摆位置 | 改 `gltf.scene` 的 position / 用 `Box3` 自动居中与缩放 |

自动适配相机（本课用的方法）：

```js
const box = new THREE.Box3().setFromObject( gltf.scene );
const size = box.getSize( new THREE.Vector3() );
const center = box.getCenter( new THREE.Vector3() );
const radius = Math.max( size.x, size.y, size.z ) / 2;
const distance = radius / Math.tan( ( camera.fov * Math.PI / 180 ) / 2 ) * 1.6;
```

---

## 5. 压缩：Draco 与 KTX2

### 5.1 Draco：压几何

```
原始：顶点坐标 3 × float32 = 12 字节/顶点
Draco：量化 + 熵编码，通常压到 1/5 ~ 1/10
```

```js
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const draco = new DRACOLoader();
draco.setDecoderPath( '/draco/' );     // 需要把 decoder 放进 public/
loader.setDRACOLoader( draco );
```

代价：

- 需要额外的解码器文件（几百 KB）
- 解码在 CPU 上做，加载后有一小段卡顿
- 顶点精度有损（可配置）

### 5.2 KTX2：压纹理

```
PNG 2048²  →  文件 2 MB，显存 16 MB
KTX2 2048² →  文件 0.5 MB，显存 4 MB（GPU 直接采样）
```

```js
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';

const ktx2 = new KTX2Loader()
	.setTranscoderPath( '/basis/' )
	.detectSupport( renderer );

loader.setKTX2Loader( ktx2 );
```

**关键区别**：PNG 压缩的是“传输大小”，KTX2 压缩的是“显存占用”。手机端真正需要的是后者。

### 5.3 什么时候值得上

| 场景 | 建议 |
|---|---|
| 单个小模型（< 1 MB） | 不用，glb 够了 |
| 20 MB 建筑模型 | Draco 必上 |
| 100 张贴图的场景 | KTX2 必上 |
| 首屏要求 1 秒内 | 两者 + 分块加载 + 低模占位 |

---

## 6. 释放：模型是资源大户

```js
function disposeObject( root ) {

	root.traverse( ( obj ) => {

		if ( ! obj.isMesh ) return;

		obj.geometry.dispose();

		const mats = Array.isArray( obj.material ) ? obj.material : [ obj.material ];
		for ( const m of mats ) {

			for ( const key of [ 'map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap' ] ) {
				m[ key ]?.dispose();
			}

			m.dispose();

		}

	} );

}
```

三条必须记住：

1. `scene.remove(obj)` **不释放任何显存**
2. 要释放的是 `geometry` / `material` / `texture`，不是 `Object3D`
3. 贴图常常被多个材质共用——**别重复 dispose**，也别只释放了材质忘了贴图

---

## 7. 常见坑

| 现象 | 原因 | 修法 |
|---|---|---|
| 模型巨大或极小 | 单位不一致（m / cm / mm） | 加载后按 `Box3` 归一化缩放 |
| 模型躺倒 | 导出时 Z-up，three 是 Y-up | 旋转 -90° 或导出时改设置 |
| 贴图全黑 | 路径错 / 材质未设 `envMap` | 看 Network 与 Console |
| 颜色发灰 | 贴图 `colorSpace` 没设 | GLTFLoader 会自动设，自己加载的要手动 |
| 换模型后内存涨 | 没 dispose | 见第 6 节 |
| 加载卡顿一下 | 解析 + 上传都在主线程 | 提前加载 / 压缩 / 分帧 |
| 找不到零件 | 导出时没命名 | 导出前给对象命名 |

> **GLTFLoader 的一个好处**：它会按 glTF 规范自动设置贴图的 `colorSpace`（baseColor/emissive 为 sRGB，normal/ORM 为线性）。这就是第 5 课那张判断表在标准格式里的落地。

---

## 8. 代码走读（`src/lessons/06-gltf.js`）

1. `LoadingManager` + `#load-bar`：进度条 DOM 与事件绑定
2. `GLTFLoader( manager )`，`load()` 三个回调
3. `clearCurrent()`：遍历 dispose 几何体/材质/贴图
4. `countStats()`：统计网格数、三角形数、纹理数
5. `fitCamera()`：`Box3` 自动适配机位与裁剪面
6. 按键：`1/2/3` 换模型、`R` 重载、`W` 线框、`B` 包围盒、`X` 释放

---

## 9. 动手实验

| 实验 | 预期现象 | 说明 |
|---|---|---|
| 按 <kbd>2</kbd> 加载 5.8 MB 扭结 | 进度条走到 100%，三角数 216,000 | 字节级进度 |
| 按 <kbd>B</kbd> | 绿色包围盒 | 自动适配用的就是它 |
| 按 <kbd>X</kbd> 再按 <kbd>2</kbd> | `info.memory` 数字回落再上升 | dispose 生效 |
| 控制台 `__gltf.current.traverse(o=>console.log(o.name))` | 打印节点名 | 场景图真实结构 |
| 按 <kbd>3</kbd> 后找 `Moon` 的父级 | 是 `Planet` | 层级被完整保留 |
| 不按 <kbd>X</kbd> 连续切换 10 次 | `renderer.info.memory` 一路上涨 | 泄漏 |

---

## 10. 自检

<details>
<summary>1. `.glb` 和 `.gltf` 的本质区别是什么？</summary>

`gltf` 是纯 JSON，几何与贴图可能外链；`glb` 把 JSON 与二进制打进一个文件。

对外的影响主要是**请求数**：`glb` 一次请求就能拿全，`gltf` 可能要几十个（每张贴图一个）。
</details>

<details>
<summary>2. 进度条的百分比是从哪来的？</summary>

XHR / fetch 的下载字节流：`xhr.loaded / xhr.total`。

它不是“解析进度”，也不包含 CPU 解码（Draco）的时间。所以大模型常见“进度 100% 了还在卡”——那是解码与上传。
</details>

<details>
<summary>3. 为什么 remove 之后内存不降？</summary>

`scene.remove()` 只改场景图，GPU 里的 buffer 与纹理仍在。

必须显式 `geometry.dispose()` / `material.dispose()` / `texture.dispose()`，three 才会调用 WebGL 的 `deleteBuffer` / `deleteTexture`。
</details>

<details>
<summary>4. Draco 和 KTX2 分别解决什么问题？</summary>

- Draco：压缩**几何**数据（顶点、索引），减少传输体积
- KTX2：压缩**纹理**，同时减少传输体积与显存占用（GPU 可直接采样块压缩格式）

前者省下载，后者省显存。手机端两个都要。
</details>

---

## 11. 延伸

- `src/loaders/GLTFLoader.js`：解析主流程
- `examples/jsm/loaders/DRACOLoader.js`、`KTX2Loader.js`
- glTF 规范：<https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html>
- `scripts/make-assets.mjs`：本课素材是这么生成的
- 下一课：动画系统（`AnimationMixer`、状态机）
