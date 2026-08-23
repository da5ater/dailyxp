pragma Singleton
import QtQuick

// V1 (#93): Arcade Chronicle token bridge — the single source of visual truth
// for the Phase R shell. Palette/type/spacing mirror the Stitch design system;
// spike S1 proved these render credibly at panel width under the software
// renderer. Production rule (spike S2): only software-safe techniques here —
// no custom ShaderEffects, so harness evidence always equals production output.
// The scanline primitive lives in Scanlines.qml (standalone type).

QtObject {
    // ── palette ────────────────────────────────────────────────
    readonly property color background:    "#0a112f"   // deep space navy
    readonly property color surfaceLowest: "#050b2a"
    readonly property color surfaceLow:    "#131938"
    readonly property color surface:       "#171d3c"
    readonly property color surfaceHigh:   "#222847"
    readonly property color border:        "#2a3160"
    readonly property color textPrimary:   "#dee1ff"   // parchment cream family
    readonly property color textMuted:     "#9b8f7a"
    readonly property color coinGold:      "#ffc93c"   // primary action / XP
    readonly property color goldDeep:      "#3f2e00"
    readonly property color goldDim:       "#5a4300"
    readonly property color goldBevel:     "#ffdf9a"
    readonly property color powerGreen:    "#4ce081"   // success / daily ribbon
    readonly property color greenDeep:     "#003e1c"
    readonly property color manaPurple:    "#9b5de5"   // levels / skills
    readonly property color purpleDeep:    "#2a0053"
    readonly property color purpleSoft:    "#dab9ff"

    // ── type ───────────────────────────────────────────────────
    // Space Grotesk is bundled by the shell host when available; CaskaydiaMono
    // Nerd Font is the audited Omarchy fallback (spike S1 finding).
    readonly property string fontFamily: {
        var fonts = Qt.fontFamilies()
        if (fonts.indexOf("Space Grotesk") !== -1) return "Space Grotesk"
        return "CaskaydiaMono Nerd Font"
    }

    // ── spacing (4px grid) ─────────────────────────────────────
    function space(n) { return n * 4 }
}
