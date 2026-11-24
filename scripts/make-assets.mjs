/**
 * 生成第 6 课用的示例模型（.glb）
 *
 *   node scripts/make-assets.mjs
 *
 * 用 three 自带的 GLTFExporter 导出，保证格式与 reader 同源。
 * GLTFExporter 依赖浏览器的 FileReader，这里做个最小垫片。
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// --- 最小 FileReader 垫片 ---------------------------------------------------
globalThis.FileReader = class {

	readAsArrayBuffer( blob ) {

		blob.arrayBuffer().then( ( buf ) => {

			this.result = buf;
			this.onloadend && this.onloadend();

		} );

	}

	readAsDataURL( blob ) {

		blob.arrayBuffer().then( ( buf ) => {

			this.result = `data:${ blob.type };base64,${ Buffer.from( buf ).toString( 'base64' ) }`;
			this.onloadend && this.onloadend();

		} );

	}

};

const THREE = await import( 'three' );
const { GLTFExporter } = await import( 'three/addons/exporters/GLTFExporter.js' );

const here = dirname( fileURLToPath( import.meta.url ) );
const outDir = resolve( here, '..', 'public', 'models' );
mkdirSync( outDir, { recursive: true } );

function exportGLB( scene, file ) {

	return new Promise( ( resolvePromise, reject ) => {

		new GLTFExporter().parse(
			scene,
			( glb ) => {

				const path = resolve( outDir, file );
				writeFileSync( path, Buffer.from( glb ) );
				console.log( `${ file.padEnd( 12 ) } ${ ( glb.byteLength / 1024 / 1024 ).toFixed( 2 ) } MB` );
				resolvePromise();

			},
			reject,
			{ binary: true },
		);

	} );

}

// --- 小模型：一个立方体 -----------------------------------------------------
{
	const scene = new THREE.Scene();
	scene.name = 'cube';

	const mesh = new THREE.Mesh(
		new THREE.BoxGeometry( 1.2, 1.2, 1.2 ),
		new THREE.MeshStandardMaterial( { color: 0x6ea8ff, roughness: 0.35, metalness: 0.15 } ),
	);
	mesh.name = 'Cube';
	scene.add( mesh );

	await exportGLB( scene, 'cube.glb' );
}

// --- 大模型：高精度扭结 -----------------------------------------------------
// 顶点数刻意做大，用来观察进度条与显存占用
{
	const scene = new THREE.Scene();
	scene.name = 'knot';

	const mesh = new THREE.Mesh(
		new THREE.TorusKnotGeometry( 1, 0.32, 900, 120 ),
		new THREE.MeshStandardMaterial( { color: 0x7fb2ff, roughness: 0.3, metalness: 0.55 } ),
	);
	mesh.name = 'TorusKnot';
	scene.add( mesh );

	await exportGLB( scene, 'knot.glb' );
}

// --- 层级模型：父子关系，验证场景图导入 -------------------------------------
{
	const scene = new THREE.Scene();
	scene.name = 'hierarchy';

	const root = new THREE.Group();
	root.name = 'Root';

	const planet = new THREE.Mesh(
		new THREE.SphereGeometry( 0.5, 32, 16 ),
		new THREE.MeshStandardMaterial( { color: 0x5b8def, roughness: 0.5 } ),
	);
	planet.name = 'Planet';
	planet.position.set( 1.2, 0, 0 );
	root.add( planet );

	const moon = new THREE.Mesh(
		new THREE.SphereGeometry( 0.18, 24, 12 ),
		new THREE.MeshStandardMaterial( { color: 0xcfcfcf, roughness: 0.8 } ),
	);
	moon.name = 'Moon';
	moon.position.set( 0.45, 0, 0 );
	planet.add( moon );

	scene.add( root );

	await exportGLB( scene, 'hierarchy.glb' );
}

console.log( '完成，输出目录：public/models' );
