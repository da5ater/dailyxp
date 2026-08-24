pragma Singleton
import QtQuick

// V1 (#93): Arcade Chronicle token bridge — the single source of visual truth
// for the Phase R shell. Palette/type/spacing mirror the Stitch design system;
// spike S1 proved these render credibly at panel width under the software
// renderer. Production rule (spike S2): only software-safe techniques here —
// no custom ShaderEffects, so harness evidence always equals production output.
// The scanline primitive lives in Scanlines.qml (standalone type).

QtObject {
    // ── palette — design.md is the single source of truth ──────
    // projects/dailyxp/design.md ("90s Retro Video Game", alpha):
    // hot pink primary · electric lime secondary · cyber purple accent ·
    // arcade blue focus · pixel green success · chrome yellow warning.
    readonly property color hotPink:       "#FF69B4"   // primary text / actions
    readonly property color electricLime:  "#CCFF00"   // secondary surface / XP gains
    readonly property color cyberPurple:   "#9B59B6"   // accent, emphasis, levels
    readonly property color arcadeBlue:    "#00BFFF"   // links + FOCUS states (R8)
    readonly property color bubblegum:     "#FF85A2"   // decorative extended
    readonly property color neonOrange:    "#FF6B35"   // warm CTA secondary
    readonly property color pixelGreen:    "#00FF41"   // success / completion
    readonly property color chromeYellow:  "#FFD700"   // warning / attention

    // dark surfaces per design.md "No pure white backgrounds"
    readonly property color background:    "#0d0d1a"   // near-black navy CRT base
    readonly property color surfaceLowest: "#08080f"
    readonly property color surfaceLow:    "#16162a"
    readonly property color surface:       "#1c1c33"
    readonly property color surfaceHigh:   "#26264a"
    readonly property color border:        "#33335c"

    // semantic aliases kept for existing screens (mapped to new palette)
    readonly property color textPrimary:   "#f2f2f7"
    readonly property color textMuted:     "#9b9bb0"
    readonly property color coinGold:      hotPink        // primary action color
    readonly property color goldDeep:      "#4a1030"      // pressed/CTA text on pink
    readonly property color goldDim:       "#b04a86"      // hover-dim variant
    readonly property color goldBevel:     "#ff9ecb"      // lighter top bevel on pink
    readonly property color powerGreen:    pixelGreen     // success ribbon
    readonly property color greenDeep:     "#00330c"      // text on green
    readonly property color manaPurple:    cyberPurple    // level/skill accent
    readonly property color purpleDeep:    "#241040"
    readonly property color purpleSoft:    "#c9a0ff"

    // ── type — design.md: Press Start 2P everywhere (chunky pixel brand) ──
    // Bundled at fonts/PressStart2P-Regular.ttf (OFL); ShellContent's
    // FontLoader registers it before any Text resolves. CaskaydiaMono Nerd
    // Font is the audited fallback if loading fails (spike S1 finding).
    readonly property string fontFamily: {
        var fonts = Qt.fontFamilies()
        if (fonts.indexOf("Press Start 2P") !== -1) return "Press Start 2P"
        return "CaskaydiaMono Nerd Font"
    }

    // PS2P runs visually large; the deliberate scale (design.md body=16px/1.6
    // maps to these pixel values inside a 420px panel):
    readonly property int typeHero:    18   // surface titles
    readonly property int typeTitle:   10   // card titles, buttons
    readonly property int typeBody:    8    // body copy, meta
    readonly property int typeTiny:    7    // ribbons, labels-caps

    // ── spacing (4px grid) ─────────────────────────────────────
    function space(n) { return n * 4 }
}
