(function () {
  "use strict";
  // Reuse keyed nodes so an incremental update does not remount images or controls.
  const key = node => {
    if (node.nodeType !== 1) return "";
    for (const name of ["id", "data-dom-key", "data-channel-id", "data-cl-group", "data-shelf-member", "data-channel", "data-cl-pick-group", "data-favorite-channel"]) {
      if (node.hasAttribute(name)) return `${node.tagName}:${name}:${node.getAttribute(name)}`;
    }
    for (const name of ["data-shelf-action", "data-cl-action", "data-favorite-action", "data-shelf-input"]) {
      if (node.hasAttribute(name)) return `${node.tagName}:${name}:${node.getAttribute(name)}:${node.getAttribute("data-id") || ""}`;
    }
    if (node.tagName === "A") return `A:${node.getAttribute("href")}`;
    return "";
  };
  const compatible = (a,b) => a.nodeType === b.nodeType && (a.nodeType !== 1 || a.tagName === b.tagName) && key(a) === key(b);
  function update(node, desired) {
    if (node.nodeType !== 1) { if (node.nodeValue !== desired.nodeValue) node.nodeValue = desired.nodeValue; return; }
    for (const attr of [...node.attributes]) {
      if (attr.name === "open" && ["DETAILS", "DIALOG"].includes(node.tagName)) continue;
      if (!desired.hasAttribute(attr.name)) node.removeAttribute(attr.name);
    }
    for (const attr of desired.attributes) if (node.getAttribute(attr.name) !== attr.value) node.setAttribute(attr.name, attr.value);
    children(node, desired);
    if (node.tagName === "INPUT" && !["checkbox", "radio"].includes(node.type) && node.value !== desired.value) node.value = desired.value;
    if (node.tagName === "INPUT" && ["checkbox","radio"].includes(node.type) && node.checked !== desired.checked) node.checked = desired.checked;
    if (node.tagName === "OPTION" && node.selected !== desired.selected) node.selected = desired.selected;
  }
  function children(parent, desired) {
    const keyed = new Map([...parent.childNodes].map(node => [key(node), node]).filter(([id]) => id));
    let cursor = parent.firstChild;
    for (const target of [...desired.childNodes]) {
      const id = key(target);
      let node = id ? keyed.get(id) : (cursor && compatible(cursor, target) ? cursor : null);
      if (node && !compatible(node,target)) node = null;
      if (!node) node = target.cloneNode(true);
      if (node !== cursor) parent.insertBefore(node, cursor);
      update(node,target);
      cursor = node.nextSibling;
      if (id) keyed.delete(id);
    }
    while (cursor) { const next = cursor.nextSibling; cursor.remove(); cursor = next; }
  }
  function patch(root, markup) {
    const template = document.createElement("template"); template.innerHTML = markup;
    children(root, template.content);
  }
  globalThis.ChanlumeDom = { patch };
})();
