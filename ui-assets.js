/* Optimized copies of the user's supplied portraits, troop icons, and cover.
 * Source hashes and dimensions: qa/five-troop-assets.json. Originals are preserved.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TKAssets = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return {
  "ordinary": {
    "civil": {
      "small": "assets/interface/ordinary-civil-192x192-ce261f0691de.webp",
      "large": "assets/interface/ordinary-civil-384x384-e4b3b394722a.webp"
    },
    "military": {
      "small": "assets/interface/ordinary-military-192x192-f4132b8249f1.webp",
      "large": "assets/interface/ordinary-military-384x384-0e2b34f79afb.webp"
    }
  },
  "troops": {
    "crossbow": {
      "small": "assets/interface/troop-crossbow-64x64-da7d2518cf51.webp",
      "large": "assets/interface/troop-crossbow-128x128-72edd7fd80fa.webp"
    },
    "spear": {
      "small": "assets/interface/troop-spear-64x64-a9d80386ee78.webp",
      "large": "assets/interface/troop-spear-128x128-82ecc65485de.webp"
    },
    "cavalry": {
      "small": "assets/interface/troop-cavalry-64x64-31b2557ea13a.webp",
      "large": "assets/interface/troop-cavalry-128x128-d4186aba7032.webp"
    },
    "shield": {
      "small": "assets/interface/troop-shield-64x64-4815b7929d7b.webp",
      "large": "assets/interface/troop-shield-128x128-bec841611d2e.webp"
    },
    "scout": {
      "small": "assets/interface/troop-scout-64x64-e95c171f8a58.webp",
      "large": "assets/interface/troop-scout-128x128-2950baffd54b.webp"
    }
  },
  "cover": {
    "small": "assets/interface/cover-qunxiong-480x853-28f0a67d5ab4.webp",
    "large": "assets/interface/cover-qunxiong-941x1672-e49a40eef634.webp"
  }
};
});
