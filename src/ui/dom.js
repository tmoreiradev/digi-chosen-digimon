// Tiny DOM helpers used by the interface code.

import { tr } from "../core/lang.js";

export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "style" && typeof v === "object") Object.assign(node.style, v);
    else if (k === "dataset") Object.assign(node.dataset, v);
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "html") node.innerHTML = v;
    else if (k === "placeholder" || k === "title") node.setAttribute(k, tr(v));
    else if (k in node) node[k] = v;
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(tr(String(c)))); // interface language
  }
  return node;
}

export const clear = (node) => {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
};

export const hexCss = (n) => `#${(n >>> 0).toString(16).padStart(6, "0")}`;

export const TYPE_CSS = {
  normal: "#c8d0dc",
  fighting: "#e0a020",
  flying: "#6ac8ff",
  poison: "#b560e0",
  ground: "#d8b070",
  rock: "#b0a060",
  bug: "#8ac020",
  ghost: "#7a68b0",
  steel: "#a0b0c0",
  fire: "#ff7a2a",
  water: "#3aa0ff",
  grass: "#5ad24a",
  electric: "#ffd030",
  psychic: "#ff7fa0",
  ice: "#80d8f0",
  dragon: "#9060e0",
  dark: "#706090",
  fairy: "#f090c0",
};

export const typeCss = (t) => TYPE_CSS[t] ?? "#cccccc";
