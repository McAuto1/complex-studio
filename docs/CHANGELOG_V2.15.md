# Change Log

## V2.15 – Vertical Plane Height Extent Fix

- Fixed the visual top boundary for magnitude (`|f(z)|`) mode to correctly include the full reference height extent plus visual padding. The `yCeil` is now set to `Math.ceil(tickMaxY) + 0.5` when `heightMode === 'mag'`.
- Introduced `gridYTicks` alias to ensure grid lines on the left YZ and right XY reference planes use the exact same ticks as the height labels.
- Removed the previous forced `yCeil` workaround that manually pushed a final tile.
- No changes to physical Im(z) axis, Im(z) labels, floor grid, or other V2 behavior.
