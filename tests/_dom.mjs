// A deliberately tiny DOM stand-in: just what src/ui/dom.js and the screens use.
// Nodes keep children, className, style, value, listeners and text; click() fires handlers.

// Any property is a function returning itself; numeric use yields 0. Enough for Canvas 2D calls.
const NOOP_CTX = new Proxy(function noop() {}, {
  get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : NOOP_CTX),
  apply: () => NOOP_CTX,
  set: () => true,
});

class FakeNode {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.parentNode = null;
    this.attrs = {};
    this.style = {
      setProperty(k, v) {
        this[k] = v;
      },
    };
    this.dataset = {};
    this.listeners = {};
    this.className = "";
    this.value = "";
    this.disabled = false;
    this.type = "";
    this.placeholder = "";
    this.title = "";
    this.onclick = null;
  }
  append(...kids) {
    for (const k of kids) {
      const node = k instanceof FakeNode ? k : new FakeText(String(k));
      node.parentNode = this;
      this.children.push(node);
    }
  }
  appendChild(k) {
    this.append(k);
    return k;
  }
  get firstChild() {
    return this.children[0] ?? null;
  }
  removeChild(k) {
    const i = this.children.indexOf(k);
    if (i >= 0) this.children.splice(i, 1);
    k.parentNode = null;
    return k;
  }
  remove() {
    this.parentNode?.removeChild(this);
  }
  addEventListener(type, fn) {
    (this.listeners[type] ??= []).push(fn);
  }
  removeEventListener(type, fn) {
    const l = this.listeners[type];
    if (l) this.listeners[type] = l.filter((f) => f !== fn);
  }
  dispatch(type, extra = {}) {
    const ev = { type, target: this, preventDefault() {}, ...extra };
    if (type === "click" && typeof this.onclick === "function") this.onclick(ev);
    for (const fn of this.listeners[type] ?? []) fn(ev);
  }
  click() {
    if (this.disabled) return;
    this.dispatch("click");
  }
  setAttribute(k, v) {
    this.attrs[k] = String(v);
  }
  getAttribute(k) {
    return this.attrs[k] ?? null;
  }
  focus() {}
  /** A 2D context that accepts any call and any property (canvas drawing is not under test). */
  getContext() {
    return NOOP_CTX;
  }
  get textContent() {
    return this.children.map((c) => c.textContent).join("");
  }
  set textContent(v) {
    this.children = v === "" ? [] : [new FakeText(String(v))];
  }
  set innerHTML(v) {
    this.children = v ? [new FakeText(String(v))] : [];
  }
  get classList() {
    const self = this;
    const list = () => self.className.split(/\s+/).filter(Boolean);
    return {
      add: (...cs) => {
        self.className = [...new Set([...list(), ...cs])].join(" ");
      },
      remove: (...cs) => {
        self.className = list().filter((c) => !cs.includes(c)).join(" ");
      },
      contains: (c) => list().includes(c),
      toggle: (c, force) => {
        const has = list().includes(c);
        const want = force ?? !has;
        self.className = want ? [...new Set([...list(), c])].join(" ") : list().filter((x) => x !== c).join(" ");
        return want;
      },
    };
  }
  /** Depth-first descendants. */
  all() {
    const out = [];
    const walk = (n) => {
      for (const c of n.children) {
        out.push(c);
        walk(c);
      }
    };
    walk(this);
    return out;
  }
  querySelector(sel) {
    return this.querySelectorAll(sel)[0] ?? null;
  }
  querySelectorAll(sel) {
    const [tag, ...classes] = sel.split(".");
    return this.all().filter((n) => (tag === "" || n.tagName === tag) && classes.every((c) => n.classList.contains(c)));
  }
}

class FakeText extends FakeNode {
  constructor(text) {
    super("#text");
    this.data = text;
  }
  get textContent() {
    return this.data;
  }
}

export function installFakeDom() {
  const byId = {};
  const store = new Map();
  globalThis.Node = FakeNode;
  globalThis.document = {
    documentElement: { lang: "pt-BR" },
    createElement: (tag) => new FakeNode(tag),
    createTextNode: (text) => new FakeText(text),
    getElementById: (id) => byId[id] ?? null,
    body: new FakeNode("body"),
  };
  globalThis.window = globalThis;
  globalThis.addEventListener ??= () => {};
  globalThis.removeEventListener ??= () => {};
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    get length() {
      return store.size;
    },
    key: (i) => [...store.keys()][i] ?? null,
  };
  const register = (id) => {
    const node = new FakeNode("div");
    node.id = id;
    byId[id] = node;
    return node;
  };
  return { document: globalThis.document, localStorage: globalThis.localStorage, register, store };
}

/** Buttons whose text matches. */
export function findButtons(root, re) {
  return root.all().filter((n) => n.tagName === "button" && re.test(n.textContent));
}
