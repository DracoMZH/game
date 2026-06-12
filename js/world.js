// КРИПТОПОЛИС — главная 3D-сцена: город-хаб с районами-модулями.
// Управление: перетаскивание — орбита, колесо — зум, клик — выбор района.

const World = (() => {
  let renderer, scene, camera, raycaster, pointer;
  let districts = [];      // { group, shapeMesh, ring, baseMat, idx }
  let examTower = null;
  let hovered = null;
  let onSelect = null;
  // фон: небо, звёзды, туманности, светлячки, метеоры
  let skyMat = null, starMat = null, nebulas = [], motes = null, meteor = null, meteorNextAt = 6;

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
      case "chart":
        add(new THREE.BoxGeometry(0.45, 0.7, 0.45), -1.0, 0.55);
        add(new THREE.BoxGeometry(0.45, 1.5, 0.45), -0.3, 0.95);
        add(new THREE.BoxGeometry(0.45, 1.0, 0.45), 0.4, 0.7);
        add(new THREE.BoxGeometry(0.45, 2.1, 0.45), 1.1, 1.25);
        break;
      case "hook":
        add(new THREE.TorusGeometry(0.55, 0.14, 10, 24, Math.PI * 1.4), 0, 0.8, 0, 0, 0, Math.PI);
        add(new THREE.CylinderGeometry(0.13, 0.13, 1.6), 0.55, 1.6);
        add(new THREE.ConeGeometry(0.22, 0.5, 10), -0.52, 0.62, 0, 0, 0, 2.6);
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
    scene.fog = new THREE.FogExp2(0x05080f, 0.013);
    scene.add(new THREE.AmbientLight(0x8899bb, 0.55));
    const dir = new THREE.DirectionalLight(0xffffff, 1.1);
    dir.position.set(10, 18, 6);
    scene.add(dir);
    const center = new THREE.PointLight(0x38d9a9, 60, 40);
    center.position.set(0, 6, 0);
    scene.add(center);

    const grid = new THREE.GridHelper(90, 60, 0x1f2b4a, 0x101626);
    grid.position.y = 0;
    scene.add(grid);

    makeSky();
    makeGroundGlow();
    makeStars();
    makeNebulas();
    makeMotes();
  }

  // купол неба: градиент + анимированное «полярное сияние»
  function makeSky() {
    skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform float uTime;
        varying vec3 vDir;
        void main() {
          float h = vDir.y;
          // вертикальный градиент: тёмная зенитная синь -> глубина у горизонта
          vec3 col = mix(vec3(0.035, 0.07, 0.14), vec3(0.008, 0.012, 0.035), smoothstep(0.0, 0.8, h));
          // тёплое бирюзовое свечение горизонта
          col += vec3(0.015, 0.09, 0.09) * exp(-abs(h) * 5.0);
          // сияние: две медленные волны, зелёная и фиолетовая
          float mask = smoothstep(0.12, 0.45, h) * smoothstep(0.95, 0.45, h);
          float b1 = sin(vDir.x * 6.0 + uTime * 0.18 + sin(vDir.z * 4.0 + uTime * 0.11) * 1.6);
          float b2 = sin(vDir.z * 5.0 - uTime * 0.13 + 2.1);
          col += vec3(0.10, 0.55, 0.42) * max(0.0, b1) * mask * 0.10;
          col += vec3(0.30, 0.18, 0.55) * max(0.0, b2) * mask * 0.07;
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(130, 32, 20), skyMat);
    scene.add(sky);
    scene.background = null;
  }

  // мягкое световое пятно под городом
  function makeGroundGlow() {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(128, 128, 10, 128, 128, 128);
    grad.addColorStop(0, "rgba(56, 217, 169, 0.30)");
    grad.addColorStop(0.5, "rgba(40, 120, 140, 0.10)");
    grad.addColorStop(1, "rgba(0, 0, 0, 0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(46, 46),
      new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(c),
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      })
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.05;
    scene.add(glow);
  }

  // мерцающие звёзды с разными оттенками (шейдерные точки)
  function makeStars() {
    const n = 1300;
    const pos = new Float32Array(n * 3);
    const phase = new Float32Array(n);
    const tint = new Float32Array(n);
    const size = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const r = 70 + Math.random() * 50;
      const t = Math.random() * Math.PI * 2;
      const p = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(p) * Math.cos(t);
      pos[i * 3 + 1] = Math.abs(r * Math.cos(p)) * 0.85 + 1.5;
      pos[i * 3 + 2] = r * Math.sin(p) * Math.sin(t);
      phase[i] = Math.random() * Math.PI * 2;
      tint[i] = Math.random();
      size[i] = 0.6 + Math.random() * 1.7;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
    geo.setAttribute("aTint", new THREE.BufferAttribute(tint, 1));
    geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    starMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        attribute float aPhase; attribute float aTint; attribute float aSize;
        uniform float uTime;
        varying float vAlpha; varying float vTint;
        void main() {
          vTint = aTint;
          vAlpha = 0.45 + 0.55 * sin(uTime * 1.4 + aPhase);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * 220.0 / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying float vAlpha; varying float vTint;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          float a = smoothstep(0.5, 0.05, d) * max(0.0, vAlpha);
          vec3 col = mix(vec3(0.62, 0.72, 1.0), vec3(1.0, 0.95, 0.82), vTint);
          gl_FragColor = vec4(col, a);
        }`,
    });
    scene.add(new THREE.Points(geo, starMat));
  }

  // туманности: большие мягкие пятна цвета на дальнем плане
  function makeNebulas() {
    const palette = ["56,140,220", "56,217,169", "150,90,220", "40,90,160"];
    for (let i = 0; i < 6; i++) {
      const c = document.createElement("canvas");
      c.width = c.height = 256;
      const g = c.getContext("2d");
      const rgb = palette[i % palette.length];
      const grad = g.createRadialGradient(128, 128, 10, 128, 128, 128);
      grad.addColorStop(0, `rgba(${rgb}, 0.16)`);
      grad.addColorStop(0.55, `rgba(${rgb}, 0.06)`);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, 256, 256);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(c),
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      const a = (i / 6) * Math.PI * 2 + Math.random();
      const r = 80 + Math.random() * 25;
      sp.position.set(Math.cos(a) * r, 18 + Math.random() * 30, Math.sin(a) * r);
      const s = 50 + Math.random() * 45;
      sp.scale.set(s, s, 1);
      nebulas.push(sp);
      scene.add(sp);
    }
  }

  // «цифровые светлячки» — медленно всплывающие искры над городом
  function makeMotes() {
    const n = 160;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() * 2 - 1) * 24;
      pos[i * 3 + 1] = Math.random() * 14;
      pos[i * 3 + 2] = (Math.random() * 2 - 1) * 24;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    motes = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0x59e3c0, size: 0.14, transparent: true, opacity: 0.65,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    scene.add(motes);
  }

  // падающая звезда: вытянутый светящийся штрих
  function spawnMeteor() {
    const c = document.createElement("canvas");
    c.width = 128; c.height = 8;
    const g = c.getContext("2d");
    const grad = g.createLinearGradient(0, 0, 128, 0);
    grad.addColorStop(0, "rgba(255,255,255,0)");
    grad.addColorStop(0.75, "rgba(190,220,255,0.85)");
    grad.addColorStop(1, "rgba(255,255,255,1)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 8);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 0.16),
      new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(c), transparent: true,
        depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      })
    );
    const a = Math.random() * Math.PI * 2;
    const start = new THREE.Vector3(Math.cos(a) * 70, 45 + Math.random() * 25, Math.sin(a) * 70);
    const dirV = new THREE.Vector3(Math.cos(a + 2.4), -0.45 - Math.random() * 0.3, Math.sin(a + 2.4)).normalize();
    mesh.position.copy(start);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dirV);
    scene.add(mesh);
    meteor = { mesh, dir: dirV, life: 0, max: 1.4 + Math.random() * 0.5 };
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

    // живой фон
    if (skyMat) skyMat.uniforms.uTime.value = time;
    if (starMat) starMat.uniforms.uTime.value = time;
    for (let i = 0; i < nebulas.length; i++) {
      nebulas[i].material.opacity = 0.75 + Math.sin(time * 0.12 + i * 1.7) * 0.25;
    }
    if (motes) {
      const p = motes.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        let y = p.getY(i) + 0.012 + (i % 7) * 0.0015;
        if (y > 15) y = 0;
        p.setY(i, y);
        p.setX(i, p.getX(i) + Math.sin(time * 0.6 + i) * 0.004);
      }
      p.needsUpdate = true;
    }
    if (meteor) {
      meteor.life += 0.016;
      meteor.mesh.position.addScaledVector(meteor.dir, 1.1);
      const k = meteor.life / meteor.max;
      meteor.mesh.material.opacity = k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8;
      if (k >= 1) {
        scene.remove(meteor.mesh);
        meteor.mesh.material.map.dispose();
        meteor.mesh.material.dispose();
        meteor.mesh.geometry.dispose();
        meteor = null;
        meteorNextAt = time + 7 + Math.random() * 12;
      }
    } else if (time > meteorNextAt) {
      spawnMeteor();
    }

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
