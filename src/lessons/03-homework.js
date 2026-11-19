import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createHUD } from '../lib/hud.js';

/**
 * Lesson 03 · 作业：手写一个 2×2 网格
 *
 * 目标：不看参考实现，把这个平面拼出来。
 *
 *   3×3 个顶点 = 9 个
 *   2×2 个格子 × 每个 2 个三角形 = 8 个三角形
 *   8 × 3 = 24 个索引
 *   法线朝 +Y（向上）
 *
 * 你要做两件事，都在下面用 TODO 标出来了：
 *   ① 写 indices 里的 6 个序号（最容易错的一步）
 *   ② 把索引和法线接到 geometry 上
 *
 * 页面右上角的清单会实时告诉你对不对：
 *   顶点 9 / 三角形 8 / 法线平均 y ≈ 1
 * 三项都 ✓ 就算过。
 *
 * 卡住时的排查手段：按 B 切双面 —— 如果翻面就出现，说明索引绕序反了。
 */

const hud = createHUD( {
	title: 'Lesson 03 · 作业：2×2 网格',
	tips: [
		'<kbd>B</kbd> 双面（排查绕序） · <kbd>W</kbd> 线框',
		'<kbd>拖拽</kbd> 旋转 · <kbd>滚轮</kbd> 缩放',
	],
} );

const check = document.createElement( 'div' );
check.className = 'row';
check.innerHTML = `
	顶点 <b id="hw-v">--</b><span id="hw-vt"> / 9</span> ·
	三角形 <b id="hw-t">--</b><span id="hw-tt"> / 8</span> ·
	法线 <b id="hw-n">--</b>`;
document.getElementById( 'hud' ).appendChild( check );

const statusRow = document.createElement( 'div' );
statusRow.className = 'row';
statusRow.innerHTML = '状态 <b id="hw-state">未构建</b>';
document.getElementById( 'hud' ).appendChild( statusRow );

const vEl = check.querySelector( '#hw-v' );
const tEl = check.querySelector( '#hw-t' );
const nEl = check.querySelector( '#hw-n' );
const vTarget = check.querySelector( '#hw-vt' );
const tTarget = check.querySelector( '#hw-tt' );
const stateEl = statusRow.querySelector( '#hw-state' );

// ---------------------------------------------------------------------------
// 场景
// ---------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer( { antialias: true } );
renderer.setPixelRatio( Math.min( window.devicePixelRatio, 2 ) );
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.appendChild( renderer.domElement );

const scene = new THREE.Scene();
scene.background = new THREE.Color( 0x05070c );

const camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.1, 100 );
camera.position.set( 5, 6, 7 );

const controls = new OrbitControls( camera, renderer.domElement );
controls.target.set( 0, 0, 0 );
controls.enableDamping = true;

scene.add( new THREE.HemisphereLight( 0x3d5170, 0x0a0d14, 1.0 ) );

const keyLight = new THREE.DirectionalLight( 0xffeedd, 2.4 );
keyLight.position.set( 4, 8, 5 );
scene.add( keyLight );

const fillLight = new THREE.DirectionalLight( 0x88aaff, 0.7 );
fillLight.position.set( -5, 3, -4 );
scene.add( fillLight );

// 地面网格和坐标轴，帮你判断"哪边是 +Y"
const grid = new THREE.GridHelper( 8, 8, 0x1b2330, 0x121821 );
grid.position.y = - 0.02;
scene.add( grid );

const axes = new THREE.AxesHelper( 2.5 );
scene.add( axes );

const material = new THREE.MeshStandardMaterial( {
	color: 0x5b8def,
	roughness: 0.42,
	metalness: 0.08,
	side: THREE.FrontSide,
} );

// ===========================================================================
// 🔧 作业从这里开始
// ===========================================================================

const N = 12;          // 每边 2 个格子
const SIZE = 4;       // 边长

// --- ① 顶点：已经给你了，读懂它即可 -------------------------------------
// 3×3 = 9 个顶点，索引公式 a = gy * (N + 1) + gx
const positions = [];

for ( let gy = 0; gy <= N; gy ++ ) {

	for ( let gx = 0; gx <= N; gx ++ ) {

		positions.push(
			( gx / N - 0.5 ) * SIZE,
			0,
			( gy / N - 0.5 ) * SIZE,
		);

	}

}

// --- ② 索引：你要写的地方 -----------------------------------------------
// 每个格子两个三角形，共 6 个序号。
// 约束：从 +Y 上方往下看，每个三角形必须是**逆时针**，法线才会朝上。
//
// 四个角的编号（配合上面的公式）：
//
//   俯视图（从 +Y 往下看）：x 向右，z 向下
//
//        a ──── b        gy = 0 → z 小 → 屏幕上方
//        │  ╲   │
//        │   ╲  │
//        c ──── d        gy = 1 → z 大 → 屏幕下方
//
//   怎么定方向：从 a 出发，a→c 是 +z，a→b 是 +x。
//   右手系里 z × x = +y，所以第一个三角形按 a → c → b 走。
//   第二个三角形同理，别让它和第一个反着来。
//
const indices = [];

for ( let gy = 0; gy < N; gy ++ ) {

	for ( let gx = 0; gx < N; gx ++ ) {

		const a = gy * ( N + 1 ) + gx;
		const b = a + 1;
		const c = a + N + 1;
		const d = c + 1;

		indices.push(
			// TODO：填 6 个序号，两个三角形
			// 提示：绕序不对的话，按 B 切双面就能看出来
      a, c,b,b,c,d
		);

	}

}

// --- ③ 组装几何体：把 index 和 normal 接上 -------------------------------
const geometry = new THREE.BufferGeometry();
geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( positions, 3 ) );

// TODO：把索引挂上去
geometry.setIndex( indices );

// TODO：算法律线（让光照正确）
geometry.computeVertexNormals();

const mesh = new THREE.Mesh( geometry, material );
scene.add( mesh );

// --- ④ 进阶（可选）：让它像水面一样起伏 ---------------------------------
// 把下面整段取消注释即可。两件事必须注意：
//   改完数组 → needsUpdate = true
//   形状变了 → computeVertexNormals()
//

function animateVertices( t ) {

	const attr = geometry.attributes.position;
	const arr = attr.array;

	for ( let i = 0; i < arr.length; i += 3 ) {

		arr[ i + 1 ] = Math.sin( arr[ i ] * 1.6 + t * 2 ) * 0.35
			+ Math.cos( arr[ i + 2 ] * 1.3 - t * 1.5 ) * 0.25;

	}

	attr.needsUpdate = true;
	geometry.computeVertexNormals();

}


// ===========================================================================
// 作业结束。下面是自动批改和交互，不需要你动。
// ===========================================================================

function refreshCheck() {

	const g = mesh.geometry;
	const verts = g.attributes.position.count;
	const tris = g.index ? g.index.count / 3 : 0;

	// 期望值跟着 N 走：改 N 之后依然能批改
	const expectVerts = ( N + 1 ) * ( N + 1 );
	const expectTris = 2 * N * N;

	vEl.textContent = String( verts );
	tEl.textContent = String( tris );
	vTarget.textContent = ` / ${ expectVerts }`;
	tTarget.textContent = ` / ${ expectTris }`;

	const normal = g.attributes.normal;
	let avgY = null;

	if ( normal ) {

		let sum = 0;
		for ( let i = 1; i < normal.array.length; i += 3 ) sum += normal.array[ i ];
		avgY = sum / ( normal.count || 1 );

	}

	nEl.textContent = avgY === null ? '没有' : avgY.toFixed( 2 );

	const okVerts = verts === expectVerts;
	const okTris = tris === expectTris;
	const okNorm = avgY !== null && avgY > 0.9;

	vEl.style.color = okVerts ? '#7ee787' : '#ff8b8b';
	tEl.style.color = okTris ? '#7ee787' : '#ff8b8b';
	nEl.style.color = okNorm ? '#7ee787' : '#ff8b8b';

	if ( okVerts && okTris && okNorm ) {

		stateEl.textContent = `✅ 三项全过（N=${ N }：${ expectVerts } 顶点 / ${ expectTris } 三角形）`;
		stateEl.style.color = '#7ee787';

	} else if ( ! g.index ) {

		stateEl.textContent = '索引还没挂上（TODO ③）';
		stateEl.style.color = '#ffc36b';

	} else if ( ! normal ) {

		stateEl.textContent = '还没有法线（TODO ③ 的 computeVertexNormals）';
		stateEl.style.color = '#ffc36b';

	} else if ( ! okTris ) {

		stateEl.textContent = `三角形数不对：现在 ${ tris }，应该是 ${ expectTris }`;
		stateEl.style.color = '#ff8b8b';

	} else {

		stateEl.textContent = '法线朝下 → 索引绕序反了（按 B 验证）';
		stateEl.style.color = '#ff8b8b';

	}

}

refreshCheck();

window.addEventListener( 'keydown', ( e ) => {

	if ( e.key === 'b' || e.key === 'B' ) {

		material.side = material.side === THREE.FrontSide ? THREE.DoubleSide : THREE.FrontSide;
		material.needsUpdate = true;

	} else if ( e.key === 'w' || e.key === 'W' ) {

		material.wireframe = ! material.wireframe;

	}

} );

const clock = new THREE.Clock();
let elapsed = 0;

renderer.setAnimationLoop( () => {

	const delta = clock.getDelta();
	elapsed += delta;

	// 只有你取消了 ④ 的注释，这个函数才存在
	if ( typeof animateVertices === 'function' ) animateVertices( elapsed );

	controls.update();
	renderer.render( scene, camera );
	hud.tick( delta );

} );

window.addEventListener( 'resize', () => {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setPixelRatio( Math.min( window.devicePixelRatio, 2 ) );
	renderer.setSize( window.innerWidth, window.innerHeight );

} );

// 控制台自检：
//   __hw.geometry.index.count        // 期望 24
//   __hw.geometry.attributes.normal.array   // 期望 y 全是 1
window.__hw = { scene, camera, mesh, geometry, positions, indices };
