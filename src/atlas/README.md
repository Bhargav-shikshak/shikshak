# Atlas style-core (vendored snapshot)

This folder preserves the pure Atlas v2 styling compiler and preset definitions from
[Atlas](https://github.com/bhargavkalita47/Atlas), pinned to commit `6039e3ce393ee74fd04f11e1649b4a9e2c948d8c`.

Shikshak uses these source files (MIT licensed, see `LICENSE`) to faithfully apply
a portable Atlas Lab theme recipe, including the default preset's road detail,
advanced typography, semantic styling, visibility and map layers.

This is a source snapshot because Atlas is currently a private workspace package,
not a public npm dependency that Shikshak CI can install. Do not hand-edit the
compiler; update from the pinned Atlas source when changing its preset schema.
`styleRuntime.ts` only adapts the `@atlas/style-core` import to the local path.

App-owned markers and geocoding must remain outside the basemap style.
