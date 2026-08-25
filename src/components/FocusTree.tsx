import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { Translate } from "../i18n";

type FocusTreeProps = {
  tomatoCount: number;
  growthProgress: number;
  remainingFocusMinutes: number;
  isGrowing: boolean;
  dateText: string;
  t: Translate;
};

type TomatoGroup = THREE.Group & { userData: { bornAt?: number } };

const MAX_VISIBLE_TOMATOES = 50;

function tomatoPosition(index: number) {
  const angle = index * 2.399963;
  const normalized = ((index * 37) % 97) / 96;
  const radius = 0.88 + 0.4 * Math.sin(normalized * Math.PI);
  return new THREE.Vector3(
    Math.cos(angle) * radius,
    0.72 + normalized * 1.72,
    1.02 + Math.sin(angle) * 0.18,
  );
}

function easeOutBack(value: number) {
  const overshoot = 1.70158;
  const shifted = value - 1;
  return 1 + (overshoot + 1) * shifted ** 3 + overshoot * shifted ** 2;
}

export default function FocusTree({
  tomatoCount,
  growthProgress,
  remainingFocusMinutes,
  isGrowing,
  dateText,
  t,
}: FocusTreeProps) {
  const sceneHostRef = useRef<HTMLDivElement>(null);
  const latestCountRef = useRef(tomatoCount);
  const syncTomatoesRef = useRef<((count: number) => void) | null>(null);
  const liveGrowthRef = useRef({
    count: tomatoCount,
    progress: growthProgress,
    active: isGrowing,
  });
  latestCountRef.current = tomatoCount;
  liveGrowthRef.current = {
    count: tomatoCount,
    progress: growthProgress,
    active: isGrowing,
  };

  const displayedProgress = isGrowing ? growthProgress * 100 : 0;
  const displayedMinutesToNext = Math.max(
    0,
    Math.ceil(remainingFocusMinutes),
  );

  useEffect(() => {
    const host = sceneHostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 30);
    camera.position.set(0, 0.55, 7.2);
    camera.lookAt(0, 0.35, 0);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.className = "focus-tree-canvas";
    renderer.domElement.setAttribute("aria-hidden", "true");
    host.appendChild(renderer.domElement);

    const tree = new THREE.Group();
    tree.position.y = -0.14;
    scene.add(tree);

    const trunkMaterial = new THREE.MeshStandardMaterial({
      color: 0x765038,
      roughness: 0.88,
      metalness: 0,
      flatShading: true,
    });
    const trunkLightMaterial = new THREE.MeshStandardMaterial({
      color: 0x916343,
      roughness: 0.9,
      metalness: 0,
      flatShading: true,
    });

    const addBranch = (
      from: THREE.Vector3,
      to: THREE.Vector3,
      bottomRadius: number,
      topRadius: number,
      material = trunkMaterial,
    ) => {
      const direction = new THREE.Vector3().subVectors(to, from);
      const branch = new THREE.Mesh(
        new THREE.CylinderGeometry(
          topRadius,
          bottomRadius,
          direction.length(),
          7,
        ),
        material,
      );
      branch.position.copy(from).add(to).multiplyScalar(0.5);
      branch.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        direction.normalize(),
      );
      branch.castShadow = true;
      branch.receiveShadow = true;
      tree.add(branch);
      return branch;
    };

    addBranch(
      new THREE.Vector3(0, -1.52, 0),
      new THREE.Vector3(-0.03, -0.37, 0),
      0.39,
      0.29,
      trunkLightMaterial,
    );
    addBranch(
      new THREE.Vector3(-0.03, -0.42, 0),
      new THREE.Vector3(-0.15, 0.55, 0.01),
      0.3,
      0.2,
    );
    addBranch(
      new THREE.Vector3(-0.15, 0.48, 0),
      new THREE.Vector3(0.03, 1.34, -0.03),
      0.2,
      0.1,
      trunkLightMaterial,
    );

    [
      [new THREE.Vector3(-0.08, 0.05, 0), new THREE.Vector3(-1.06, 1.04, 0.02), 0.16, 0.055],
      [new THREE.Vector3(-0.1, 0.3, 0), new THREE.Vector3(0.95, 1.18, -0.02), 0.15, 0.052],
      [new THREE.Vector3(-0.08, 0.7, -0.02), new THREE.Vector3(-0.55, 1.72, -0.06), 0.12, 0.042],
      [new THREE.Vector3(-0.02, 0.8, -0.03), new THREE.Vector3(0.52, 1.82, -0.08), 0.11, 0.04],
    ].forEach(([from, to, bottomRadius, topRadius], index) =>
      addBranch(
        from as THREE.Vector3,
        to as THREE.Vector3,
        bottomRadius as number,
        topRadius as number,
        index % 2 === 0 ? trunkLightMaterial : trunkMaterial,
      ),
    );

    [
      [new THREE.Vector3(0, -1.43, 0), new THREE.Vector3(-0.84, -1.55, 0.28)],
      [new THREE.Vector3(0.04, -1.45, 0), new THREE.Vector3(0.78, -1.55, 0.34)],
      [new THREE.Vector3(0, -1.45, -0.03), new THREE.Vector3(-0.48, -1.55, -0.56)],
    ].forEach(([from, to]) =>
      addBranch(from, to, 0.13, 0.025, trunkMaterial),
    );

    const leafMaterial = new THREE.MeshStandardMaterial({
      color: 0x82b83f,
      roughness: 0.82,
      metalness: 0,
      flatShading: true,
    });
    const leafMaterialDark = new THREE.MeshStandardMaterial({
      color: 0x4f8735,
      roughness: 0.86,
      flatShading: true,
    });
    const leafMaterialFresh = new THREE.MeshStandardMaterial({
      color: 0x9aca49,
      roughness: 0.8,
      flatShading: true,
    });
    const crownGeometry = new THREE.IcosahedronGeometry(0.82, 1);
    [
      { p: [-0.08, 1.36, -0.12] as const, s: [1.15, 1.04, 1] as const, tone: 0 },
      { p: [-0.94, 1.16, -0.04] as const, s: [0.82, 0.78, 0.82] as const, tone: 1 },
      { p: [0.9, 1.25, -0.05] as const, s: [0.87, 0.82, 0.84] as const, tone: 0 },
      { p: [-1.23, 1.7, -0.16] as const, s: [0.61, 0.67, 0.64] as const, tone: 0 },
      { p: [1.2, 1.75, -0.18] as const, s: [0.62, 0.69, 0.66] as const, tone: 1 },
      { p: [-0.56, 2.02, -0.17] as const, s: [0.76, 0.76, 0.73] as const, tone: 2 },
      { p: [0.5, 2.08, -0.19] as const, s: [0.73, 0.72, 0.71] as const, tone: 0 },
      { p: [-0.03, 2.4, -0.23] as const, s: [0.53, 0.52, 0.5] as const, tone: 2 },
      { p: [0.28, 0.85, -0.04] as const, s: [0.72, 0.6, 0.7] as const, tone: 1 },
    ].forEach(({ p, s, tone }, index) => {
      const crown = new THREE.Mesh(
        crownGeometry,
        tone === 1
          ? leafMaterialDark
          : tone === 2
            ? leafMaterialFresh
            : leafMaterial,
      );
      crown.position.set(p[0], p[1], p[2]);
      crown.scale.set(s[0], s[1], s[2]);
      crown.rotation.set(
        p[0] * 0.14,
        index * 0.48 + p[1] * 0.08,
        p[0] * -0.11,
      );
      crown.castShadow = true;
      crown.receiveShadow = true;
      tree.add(crown);
    });

    const tomatoRadius = 0.19;
    const tomatoGeometry = new THREE.SphereGeometry(tomatoRadius, 18, 12);
    const tomatoPositions = tomatoGeometry.getAttribute("position");
    for (let index = 0; index < tomatoPositions.count; index += 1) {
      const x = tomatoPositions.getX(index);
      const y = tomatoPositions.getY(index);
      const z = tomatoPositions.getZ(index);
      const angle = Math.atan2(z, x);
      const heightRatio = Math.min(1, Math.abs(y) / tomatoRadius);
      const lobeStrength = Math.pow(1 - heightRatio, 0.58);
      const radialScale = 1 + Math.cos(angle * 6) * 0.075 * lobeStrength;
      const topDimple = y > 0 ? 0.022 * (y / tomatoRadius) ** 6 : 0;
      tomatoPositions.setXYZ(
        index,
        x * radialScale,
        y * 0.84 - topDimple,
        z * radialScale,
      );
    }
    tomatoPositions.needsUpdate = true;
    tomatoGeometry.computeVertexNormals();
    const tomatoMaterial = new THREE.MeshStandardMaterial({
      color: 0xf15a3f,
      roughness: 0.58,
      metalness: 0.02,
      flatShading: true,
    });
    const calyxPoints: Array<[number, number]> = [];
    for (let point = 0; point < 10; point += 1) {
      const angle = Math.PI / 2 + (point / 10) * Math.PI * 2;
      const radius = point % 2 === 0 ? 0.14 : 0.038;
      calyxPoints.push([
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
      ]);
    }
    const calyxVertices: number[] = [];
    calyxPoints.forEach(([x, z], point) => {
      const [nextX, nextZ] = calyxPoints[(point + 1) % calyxPoints.length];
      calyxVertices.push(0, 0, 0, x, 0, z, nextX, 0, nextZ);
    });
    const calyxGeometry = new THREE.BufferGeometry();
    calyxGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(calyxVertices, 3),
    );
    calyxGeometry.computeVertexNormals();
    const calyxMaterial = new THREE.MeshStandardMaterial({
      color: 0x39762e,
      roughness: 0.76,
      flatShading: true,
      side: THREE.DoubleSide,
    });
    const stemGeometry = new THREE.CylinderGeometry(0.017, 0.024, 0.13, 6);
    const stemMaterial = new THREE.MeshStandardMaterial({
      color: 0x477f31,
      roughness: 0.78,
      flatShading: true,
    });
    const tomatoes = new THREE.Group();
    tomatoes.name = "daily-tomatoes";
    tree.add(tomatoes);

    const buildTomato = (
      index: number,
      fruitMaterial: THREE.MeshStandardMaterial,
    ) => {
      const tomato = new THREE.Group() as TomatoGroup;
      const fruit = new THREE.Mesh(tomatoGeometry, fruitMaterial);
      fruit.castShadow = true;
      fruit.receiveShadow = true;
      const calyx = new THREE.Mesh(calyxGeometry, calyxMaterial);
      calyx.position.y = 0.137;
      calyx.rotation.y = index * 0.47;
      const stem = new THREE.Mesh(stemGeometry, stemMaterial);
      stem.position.set(index % 2 === 0 ? 0.008 : -0.008, 0.205, 0);
      stem.rotation.z = index % 2 === 0 ? -0.11 : 0.11;
      stem.castShadow = true;
      tomato.add(fruit, calyx, stem);
      tomato.position.copy(tomatoPosition(index));
      tomato.rotation.y = index * 0.43;
      tomato.rotation.x = -0.04 + (index % 3) * 0.035;
      return tomato;
    };

    const createTomato = (index: number) => {
      const tomato = buildTomato(index, tomatoMaterial);
      tomato.scale.setScalar(0.001);
      tomato.userData.bornAt = performance.now() + index * 55;
      tomatoes.add(tomato);
    };

    const growingTomatoMaterial = tomatoMaterial.clone();
    const growingTomato = buildTomato(0, growingTomatoMaterial);
    const unripeColor = new THREE.Color(0x92c84b);
    const turningColor = new THREE.Color(0xf09a3f);
    const ripeColor = new THREE.Color(0xf15a3f);
    let growingTomatoIndex = -1;
    let growingTomatoBaseY = 0;
    growingTomato.visible = false;
    tree.add(growingTomato);

    const syncTomatoes = (count: number) => {
      const visibleCount = Math.min(count, MAX_VISIBLE_TOMATOES);
      while (tomatoes.children.length < visibleCount) {
        createTomato(tomatoes.children.length);
      }
      while (tomatoes.children.length > visibleCount) {
        tomatoes.remove(tomatoes.children[tomatoes.children.length - 1]);
      }
    };
    syncTomatoesRef.current = syncTomatoes;
    syncTomatoes(latestCountRef.current);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(2.2, 48),
      new THREE.MeshStandardMaterial({
        color: 0x5d7745,
        transparent: true,
        opacity: 0.16,
        roughness: 1,
      }),
    );
    ground.position.y = -1.57;
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    scene.add(new THREE.HemisphereLight(0xe9ffd1, 0x253122, 2.25));
    const keyLight = new THREE.DirectionalLight(0xfff7df, 3.2);
    keyLight.position.set(-3, 5, 4);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(512, 512);
    scene.add(keyLight);
    const rimLight = new THREE.PointLight(0xcdfc73, 2.4, 9);
    rimLight.position.set(3, 2, 3);
    scene.add(rimLight);

    const pointer = new THREE.Vector2();
    const onPointerMove = (event: PointerEvent) => {
      const bounds = host.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
      pointer.y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
    };
    const onPointerLeave = () => pointer.set(0, 0);
    host.addEventListener("pointermove", onPointerMove);
    host.addEventListener("pointerleave", onPointerLeave);

    let targetTreeScale = 1;
    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      const narrowDistance = camera.aspect < 0.9 ? 0.9 / camera.aspect : 1;
      camera.position.z = 7.2 * Math.min(narrowDistance, 1.65);
      camera.lookAt(0, 0.35, 0);
      camera.updateProjectionMatrix();
      targetTreeScale = THREE.MathUtils.clamp(width / 420, 0.65, 0.92);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();

    const startedAt = performance.now();
    let animationFrame = 0;
    const animate = (time: number) => {
      const elapsed = (time - startedAt) / 1000;
      const responsiveScale = THREE.MathUtils.lerp(
        tree.scale.x,
        targetTreeScale,
        0.075,
      );
      tree.scale.setScalar(responsiveScale);
      tree.rotation.y += (pointer.x * 0.24 - tree.rotation.y) * 0.035;
      tree.rotation.x += (-pointer.y * 0.045 - tree.rotation.x) * 0.035;
      tree.position.y =
        responsiveScale * 1.52 -
        1.66 +
        Math.sin(elapsed * 1.15) * 0.025;
      tree.rotation.z = Math.sin(elapsed * 0.72) * 0.012;

      tomatoes.children.forEach((child, index) => {
        const tomato = child as TomatoGroup;
        const bornAt = tomato.userData.bornAt ?? 0;
        const growth = THREE.MathUtils.clamp((time - bornAt) / 520, 0, 1);
        tomato.scale.setScalar(Math.max(0.001, easeOutBack(growth)));
        tomato.rotation.z = Math.sin(elapsed * 1.15 + index * 0.9) * 0.018;
      });

      const liveGrowth = liveGrowthRef.current;
      growingTomato.visible = liveGrowth.active;
      if (liveGrowth.active) {
        const liveProgress = THREE.MathUtils.clamp(liveGrowth.progress, 0, 1);
        if (growingTomatoIndex !== liveGrowth.count) {
          growingTomatoIndex = liveGrowth.count;
          growingTomato.position.copy(tomatoPosition(growingTomatoIndex));
          growingTomatoBaseY = growingTomato.position.y;
          growingTomato.rotation.y = growingTomatoIndex * 0.43;
          growingTomato.rotation.x =
            -0.04 + (growingTomatoIndex % 3) * 0.035;
        }
        const growthScale = THREE.MathUtils.lerp(
          0.18,
          1,
          1 - (1 - liveProgress) ** 3,
        );
        const growthPulse = 1 + Math.sin(elapsed * 2.1) * 0.012;
        growingTomato.scale.setScalar(growthScale * growthPulse);
        growingTomato.position.y =
          growingTomatoBaseY + Math.sin(elapsed * 1.6) * 0.012;
        growingTomato.rotation.z = Math.sin(elapsed * 1.3) * 0.022;
        if (liveProgress < 0.62) {
          growingTomatoMaterial.color.lerpColors(
            unripeColor,
            turningColor,
            liveProgress / 0.62,
          );
        } else {
          growingTomatoMaterial.color.lerpColors(
            turningColor,
            ripeColor,
            (liveProgress - 0.62) / 0.38,
          );
        }
      }

      renderer.render(scene, camera);
      animationFrame = requestAnimationFrame(animate);
    };
    animationFrame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerleave", onPointerLeave);
      syncTomatoesRef.current = null;
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        geometries.add(object.geometry);
        const objectMaterials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        objectMaterials.forEach((material) => materials.add(material));
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, []);

  useEffect(() => {
    syncTomatoesRef.current?.(tomatoCount);
  }, [tomatoCount]);

  return (
    <section className="tree-view">
      <div className="tree-card">
        <div className="tree-scene" ref={sceneHostRef} />
        <div className="tree-heading">
          <div>
            <span>{t("treeEyebrow")}</span>
            <strong>{t("treeTitle")}</strong>
          </div>
          <small>{dateText}</small>
        </div>
        <div className="tree-harvest">
          <strong>{tomatoCount}</strong>
          <span>{t("tomatoesHarvested")}</span>
        </div>
        <div className="tree-progress-panel">
          <div>
            <span>{t("nextTomato")}</span>
            <strong>
              {isGrowing
                ? t("minutesToNextTomato", {
                    minutes: displayedMinutesToNext,
                  })
                : tomatoCount === 0
                  ? t("treeFirstFruit")
                  : t("treeStartNextFruit")}
            </strong>
          </div>
          <div className="tree-progress-track" aria-hidden="true">
            <span style={{ width: `${displayedProgress}%` }} />
          </div>
          <small>{t("treeRule")}</small>
        </div>
      </div>
    </section>
  );
}
