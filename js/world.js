// КРИПТОПОЛИС — главная 3D-сцена: город-хаб с районами-модулями.
// Управление: перетаскивание — орбита, колесо — зум, клик — выбор района.

const World = (() => {
  let renderer, scene, camera, raycaster, pointer;
  let districts = [];      // { group, shapeMesh, ring, baseMat, idx }
  let examTower = null;
  let hovered = null;
  let onSelect = null;

  // орбитальная камера
  const orbit = { theta: 0.6, phi: 1.12, radius: 26, target: new THREE.Vector3(0, 1.5, 0), auto: true };
  const drag = { active: false, x: 0, y: 0 };

  function makeLabel(text, color) {
    const c = document.createElement("canvas");
    c.width = 512; c.height = 96;
    const g = c.getContext("2d");
    g.font = "600 40px 'Segoe UI', Arial, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.shadowColor = "rgba(0,0,0,0.9)";
    g.shadowBlur = 12;
    g.fillStyle = color;
    g.fillText(text, 256, 48);
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 4;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sprite.scale.set(7.4, 1.4, 1);
    return sprite;
  }

  // стилизованная фигура района
  function makeShape(kind, mat) {
    const g = new THREE.Group();
    const add = (geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.rotation.set(rx, ry, rz);
      g.add(m);
      return m;
    };
    switch (kind) {
      case "chain":
        add(new THREE.BoxGeometry(1, 1, 1), -1.3, 0.5);
        add(new THREE.BoxGeometry(1, 1, 1), 0, 0.9);
        add(new THREE.BoxGeometry(1, 1, 1), 1.3, 1.3);
        add(new THREE.CylinderGeometry(0.07, 0.07, 1.3), -0.65, 0.7, 0, 0, 0, Math.PI / 2.6);
        add(new THREE.CylinderGeometry(0.07, 0.07, 1.3), 0.65, 1.1, 0, 0, 0, Math.PI / 2.6);
        break;
      case "key":
        add(new THREE.TorusGeometry(0.7, 0.22, 12, 28), 0, 1.7);
        add(new THREE.CylinderGeometry(0.2, 0.2, 1.6), 0, 0.5);
        add(new THREE.BoxGeometry(0.55, 0.18, 0.18), 0.25, 0.1);
        add(new THREE.BoxGeometry(0.45, 0.18, 0.18), 0.2, 0.42);
        break;
      case "wallet":
        add(new THREE.BoxGeometry(2, 1.3, 0.5), 0, 0.85);
        add(new THREE.BoxGeometry(0.55, 0.55, 0.6), 0.75, 0.85);
        break;
      case "pick":
        add(new THREE.CylinderGeometry(0.09, 0.09, 2.4), 0, 1, 0, 0, 0, 0.5);
        add(new THREE.TorusGeometry(0.85, 0.16, 10, 22, Math.PI), 0.55, 1.95, 0, 0, 0, -0.35);
        break;
      case "pillars":
        add(new THREE.CylinderGeometry(0.3, 0.3, 1.0), -0.9, 0.5);
        add(new THREE.CylinderGeometry(0.3, 0.3, 2.0), 0, 1.0);
        add(new THREE.CylinderGeometry(0.3, 0.3, 1.5), 0.9, 0.75);
        break;
      case "diamond":
        add(new THREE.OctahedronGeometry(1.1), 0, 1.4);
        break;
      case "rings":
        add(new THREE.TorusGeometry(0.9, 0.16, 12, 30), 0, 1.3, 0, Math.PI / 2);
        add(new THREE.TorusGeometry(0.6, 0.14, 12, 26), 0, 1.3, 0, 0, Math.PI / 2);
        break;
      case "shield":
        add(new THREE.IcosahedronGeometry(1.0, 0), 0, 1.3);
        add(new THREE.TorusGeometry(1.25, 0.07, 8, 36), 0, 1.3, 0, Math.PI / 2);
        break;
      default:
        add(new THREE.BoxGeometry(1.2, 1.2, 1.2), 0, 1.2);
    }
    return g;
  }

  function makeDistrict(mod, idx, count) {
    const angle = (idx / count) * Math.PI * 2 - Math.PI / 2;
    const R = 13;
    const group = new THREE.Group();
    group.position.set(Math.cos(angle) * R, 0, Math.sin(angle) * R);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(2.6, 3.0, 0.5, 8),
      new THREE.MeshStandardMaterial({ color: 0x141c30, roughness: 0.8, metalness: 0.3 })
    );
    base.position.y = 0.25;
    group.add(base);

    const mat = new THREE.MeshStandardMaterial({
      color: mod.color, emissive: mod.color, emissiveIntensity: 0.35,
      roughness: 0.35, metalness: 0.55,
    });
    const shape = makeShape(mod.shape, mat);
    shape.position.y = 0.7;
    group.add(shape);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.85, 0.07, 8, 48),
      new THREE.MeshBasicMaterial({ color: 0x38d9a9 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.55;
    ring.visible = false;
    group.add(ring);

    const label = makeLabel(mod.short, "#d7e1f3");
    label.position.y = 4.3;
    group.add(label);

    scene.add(group);
    return { group, shape, mat, ring, idx, baseColor: mod.color, floatSeed: Math.random() * Math.PI * 2 };
  }

  function makeExamTower() {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: 0xf5c542, emissive: 0xf5c542, emissiveIntensity: 0.3,
      roughness: 0.3, metalness: 0.6,
    });
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.6, 5.2, 6), mat);
    tower.position.y = 2.6;
    group.add(tower);
    const top = new THREE.Mesh(new THREE.OctahedronGeometry(1.0), mat);
    top.position.y = 6.1;
    group.add(top);
    const label = makeLabel("Экзамен Сатоши", "#f5c542");
    label.position.y = 8.2;
    group.add(label);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.4, 0.08, 8, 48),
      new THREE.MeshBasicMaterial({ color: 0x38d9a9 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.3;
    ring.visible = false;
    group.add(ring);
    scene.add(group);
    return { group, shape: top, mat, ring, idx: "exam", baseColor: 0xf5c542, floatSeed: 0 };
  }

  function makeEnvironment() {
    scene.fog = new THREE.FogExp2(0x070b14, 0.016);
    scene.add(new THREE.AmbientLight(0x8899bb, 0.55));
    const dir = new THREE.DirectionalLight(0xffffff, 1.1);
    dir.position.set(10, 18, 6);
    scene.add(dir);
    const center = new THREE.PointLight(0x38d9a9, 60, 40);
    center.position.set(0, 6, 0);
    scene.add(center);

    const grid = new THREE.GridHelper(90, 60, 0x1f2b4a, 0x131b30);
    grid.position.y = 0;
    scene.add(grid);

    // звёзды
    const n = 900;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = 55 + Math.random() * 60;
      const t = Math.random() * Math.PI * 2;
      const p = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(p) * Math.cos(t);
      pos[i * 3 + 1] = Math.abs(r * Math.cos(p)) * 0.7 + 2;
      pos[i * 3 + 2] = r * Math.sin(p) * Math.sin(t);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x6f86c2, size: 0.22, sizeAttenuation: true }));
    scene.add(stars);
  }

  function applyOrbit() {
    const { theta, phi, radius, target } = orbit;
    camera.position.set(
      target.x + radius * Math.sin(phi) * Math.cos(theta),
      target.y + radius * Math.cos(phi),
      target.z + radius * Math.sin(phi) * Math.sin(theta)
    );
    camera.lookAt(target);
  }

  function pickAt(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const all = districts.concat([examTower]);
    for (const d of all) {
      if (raycaster.intersectObject(d.group, true).length) return d;
    }
    return null;
  }

  function bindControls(el) {
    el.addEventListener("pointerdown", (e) => {
      drag.active = true; drag.moved = false;
      drag.x = e.clientX; drag.y = e.clientY;
      orbit.auto = false;
    });
    window.addEventListener("pointermove", (e) => {
      if (drag.active) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
        drag.x = e.clientX; drag.y = e.clientY;
        orbit.theta += dx * 0.005;
        orbit.phi = Math.min(1.45, Math.max(0.45, orbit.phi + dy * 0.004));
      } else {
        const d = pickAt(e.clientX, e.clientY);
        if (d !== hovered) {
          hovered = d;
          el.style.cursor = d ? "pointer" : "grab";
        }
      }
    });
    window.addEventListener("pointerup", (e) => {
      if (drag.active && !drag.moved) {
        const d = pickAt(e.clientX, e.clientY);
        if (d && onSelect) onSelect(d.idx);
      }
      drag.active = false;
      setTimeout(() => { orbit.auto = true; }, 4000);
    });
    el.addEventListener("wheel", (e) => {
      e.preventDefault();
      orbit.radius = Math.min(44, Math.max(12, orbit.radius + e.deltaY * 0.02));
    }, { passive: false });
  }

  function animate(t) {
    requestAnimationFrame(animate);
    const time = t * 0.001;
    if (orbit.auto && !drag.active) orbit.theta += 0.0011;
    applyOrbit();

    for (const d of districts) {
      d.shape.rotation.y = time * 0.4 + d.floatSeed;
      d.shape.position.y = 0.7 + Math.sin(time * 1.2 + d.floatSeed) * 0.12;
      const target = (hovered === d) ? 0.9 : (d.locked ? 0.06 : 0.35);
      d.mat.emissiveIntensity += (target - d.mat.emissiveIntensity) * 0.12;
    }
    examTower.shape.rotation.y = time * 0.6;
    const et = (hovered === examTower) ? 0.85 : (examTower.locked ? 0.06 : 0.3);
    examTower.mat.emissiveIntensity += (et - examTower.mat.emissiveIntensity) * 0.12;

    renderer.render(scene, camera);
  }

  return {
    init(canvas, modules, selectCb) {
      onSelect = selectCb;
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(window.innerWidth, window.innerHeight);
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x070b14);
      camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 250);
      raycaster = new THREE.Raycaster();
      pointer = new THREE.Vector2();

      makeEnvironment();
      districts = modules.map((m, i) => makeDistrict(m, i, modules.length));
      examTower = makeExamTower();

      bindControls(canvas);
      window.addEventListener("resize", () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      });
      requestAnimationFrame(animate);
    },

    // states: массив 'locked' | 'open' | 'done' по модулям; examState аналогично
    setStates(states, examState) {
      states.forEach((st, i) => {
        const d = districts[i];
        d.locked = st === "locked";
        d.ring.visible = st === "done";
        d.mat.color.set(d.locked ? 0x3a4258 : d.baseColor);
        d.mat.emissive.set(d.locked ? 0x222838 : d.baseColor);
      });
      examTower.locked = examState === "locked";
      examTower.ring.visible = examState === "done";
      examTower.mat.color.set(examTower.locked ? 0x3a4258 : 0xf5c542);
      examTower.mat.emissive.set(examTower.locked ? 0x222838 : 0xf5c542);
    },
  };
})();
