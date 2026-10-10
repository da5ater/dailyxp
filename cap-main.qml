import QtQuick
import "EventModel.js" as EventModel
import "PlanningJournal.js" as PlanningJournal
import "PlanningModel.js" as PlanningModel
import "StateModel.js" as StateModel

// Evidence harness driver (V1 #93, extended V2 #94).
//
// Quickshell's core module has no standalone plugin .so, so the production
// StateStore can't run under `/usr/lib/qt6/bin/qml`. This harness instead
// builds a STORE-ALIKE from the same pure-JS modules StateStore uses —
// decide → appendIntents → withEventJournal → exportJournal — and proves
// replay by feeding the exported journal back through loadJournal →
// project. The QML rendering path is identical to production; only the
// FileView plumbing is simulated.
Rectangle {
    id: rootWindow
    width: 420; height: 640
    color: "#0a112f"

    property string which: (function(){ var a=Qt.application.arguments; var i=a.indexOf("--surface"); return i>=0? a[i+1] : "play" })()
    property bool sheet: (function(){ var a=Qt.application.arguments;
        var i=a.indexOf("--sheet"); return i>=0 && a[i+1]==="commitment" })()
    property var shell: null

    // ── store-alike: same pipeline as StateStore.applyPlanningCommand ──
    QtObject {
        id: storeAlike
        property string timezone: "Africa/Cairo"
        property int dayBoundaryMinutes: 240

        function contextFor(now) {
            var local = EventModel.localSystemContext(now, storeAlike.timezone)
            return {
                occurredAtUtc: now.toISOString(),
                localDateTime: local.localDateTime,
                timezone: local.timezone,
                utcOffsetMinutes: local.utcOffsetMinutes,
                systemTimezoneVerified: true,
                dayBoundaryMinutes: storeAlike.dayBoundaryMinutes
            }
        }

        property var journal: null
        property var planningProjection: PlanningModel.emptyProjection()

        function applyPlanningCommand(command) {
            try {
                var result = PlanningModel.decide(planningProjection, command)
                if (result.events.length === 0) return true
                var ctx = contextFor(new Date())
                journal = PlanningJournal.appendIntents(journal, result.events, ctx, EventModel)
                planningProjection = PlanningModel.project(journal.events)
                return true
            } catch (error) {
                console.log("harness-error: " + error)
                return false
            }
        }
    }

    Component.onCompleted: {
        shell = shellComp.createObject(rootWindow)
        seedTimer.start()
    }

    Component {
        id: shellComp
        ShellContent { anchors.fill: parent }
    }

    // Seed a real commitment through the REAL command path, then prove
    // replay: export → reload → reproject. What PlayScreen renders comes
    // from the reloaded journal, not from in-memory form state.
    Timer { id: seedTimer; interval: 100; onTriggered: {
        if (!rootWindow.sheet) {
            storeAlike.journal = EventModel.createJournal(EventModel.uuidV4())
            var ok = storeAlike.applyPlanningCommand({
                type: "task.create",
                task: { id: EventModel.uuidV4(), title: "Ruby study",
                    estimateMinutes: 120, urgency: "normal", deadline: null,
                    primarySkill: "general/focus", goalId: null, milestoneId: null }
            })
            console.log("MARK seed-ok:", ok)
            // ── replay proof: kill-shell/reopen inside the harness ──
            var raw = EventModel.exportJournal(storeAlike.journal)
            var loaded = EventModel.loadJournal(raw)
            console.log("MARK replay-ok:", loaded.ok &&
                        PlanningModel.project(loaded.journal.events).tasks.length === 1)
            storeAlike.planningProjection =
                PlanningModel.project(loaded.journal.events)   // render from RELOADED state
        } else {
            // empty fresh-install state for the empty-state + sheet capture
            storeAlike.journal = EventModel.createJournal(EventModel.uuidV4())
            storeAlike.planningProjection = PlanningModel.emptyProjection()
        }
        rootWindow.shell.stateStore = storeAlike
        switchTimer.start()
    }}

    Timer { id: switchTimer; interval: 300; onTriggered: {
        // navigate via the shell's own API to prove nav works
        var names = ["Journey","World","Setup"]
        var target = rootWindow.which === "play" ? "Play" : names[["journey","world","setup"].indexOf(rootWindow.which)]
        if (target !== "Play") rootWindow.shell.openSurface(target)
        if (rootWindow.sheet) rootWindow.shell.openCommitmentSheet()   // P5 over PLAY
        grabTimer.start()
    }}
    Timer { id: grabTimer; interval: 400; onTriggered:
        rootWindow.shell.grabToImage(function(r) {
            if (r.saveToFile("/tmp/shell-capture-" + rootWindow.which + (rootWindow.sheet ? "-sheet" : "") + ".png")) console.log("MARK saved-" + rootWindow.which)
            else console.log("MARK save-false")
            Qt.quit()
        })
    }
}
