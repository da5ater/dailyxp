import QtQuick
import "../"
import "../../JourneyModel.js" as JourneyModel
import "../../ProgressionModel.js" as ProgressionModel

ArcadeScreen {
    id: root
    title: "JOURNEY"
    readonly property var store: shellApi ? shellApi.stateStore : null
    property string nowUtc: new Date().toISOString()
    Timer {
        interval: 60000
        repeat: true
        running: root.visible
        onTriggered: root.nowUtc = new Date().toISOString()
    }
    function focusLedgerControl() { ledgerButton.forceActiveFocus() }
    readonly property var journey: JourneyModel.view(
        store ? store.progressionProjection : ProgressionModel.emptyProjection(),
        store ? store.sessionProjection.sessions : [],
        store ? store.habitProjection : {},
        store && store.journal ? store.journal.events : [],
        store ? store.sessionDailyXpDate(root.nowUtc) : new Date().toISOString().slice(0, 10))

    Column {
        width: parent.width
        spacing: Theme.space(2)
        Row {
            width: parent.width
            spacing: Theme.space(2)
            StatChip {
                objectName: "journeyLevel"
                width: (parent.width - parent.spacing) / 2
                label: "LV"
                value: String(root.journey.level)
                valueColor: Theme.manaPurple
            }
            StatChip {
                objectName: "journeyMomentum"
                width: (parent.width - parent.spacing) / 2
                label: "MOMENTUM"
                value: root.journey.momentum
                valueColor: Theme.electricLime
            }
        }
        StatChip {
            objectName: "journeyRank"
            width: parent.width
            label: "RANK"
            value: root.journey.storyRank
        }
    }
    Column {
        width: parent.width
        spacing: 4
        SegmentedBar {
            objectName: "journeyXpBar"
            width: parent.width
            fraction: root.journey.progress.have / root.journey.progress.need
            blocks: Math.max(1, Math.min(24, Math.floor(width / 8)))
        }
        Text {
            objectName: "journeyXpProgress"
            width: parent.width
            text: root.journey.progress.have + " / " + root.journey.progress.need + " XP to LV " + (root.journey.level + 1)
            color: Theme.textMuted
            font.family: Theme.fontFamily
            font.pixelSize: Theme.typeBody
            wrapMode: Text.WordWrap
        }
    }
    ArcadeCard {
        width: parent.width
        ribbon: "XP LEDGER"
        ribbonColor: Theme.coinGold
        ribbonText: Theme.goldDeep
        Column {
            width: parent.width
            spacing: Theme.space(3)
            Text {
                objectName: "journeyLifetimeXp"
                width: parent.width
                text: root.journey.lifetimeXp + " lifetime XP · " + root.journey.ledger.length + " awards"
                color: Theme.textPrimary
                font.family: Theme.fontFamily
                font.pixelSize: Theme.typeBody
                wrapMode: Text.WordWrap
            }
            BevelButton {
                id: ledgerButton
                objectName: "openLedgerButton"
                width: parent.width
                label: "VIEW ALL AWARDS"
                baseColor: Theme.coinGold
                textColor: Theme.goldDeep
                onActivated: if (root.shellApi) root.shellApi.openLedgerSheet()
            }
        }
    }
    ArcadeCard {
        width: parent.width
        ribbon: "THIS WEEK"
        Column {
            width: parent.width
            spacing: Theme.space(2)
            Text {
                objectName: "journeyWeeklyInsight"
                width: parent.width
                text: Math.floor(root.journey.weeklyFocusedMinutes / 60) + "h "
                      + root.journey.weeklyFocusedMinutes % 60 + "m focused · " + root.journey.weeklyXp + " XP earned"
                color: Theme.textPrimary
                font.family: Theme.fontFamily
                font.pixelSize: Theme.typeBody
                wrapMode: Text.WordWrap
            }
            Text {
                width: parent.width
                text: "CURRENT STREAKS"
                color: Theme.textMuted
                font.family: Theme.fontFamily
                font.pixelSize: Theme.typeBody
            }
            Text {
                visible: root.journey.currentStreaks.length === 0
                text: "No habits yet."
                color: Theme.textMuted
                font.family: Theme.fontFamily
                font.pixelSize: Theme.typeBody
            }
            Repeater {
                model: root.journey.currentStreaks
                delegate: Text {
                    required property var modelData
                    width: parent.width
                    text: modelData.title + " · ×" + modelData.current
                    color: Theme.textPrimary
                    font.family: Theme.fontFamily
                    font.pixelSize: Theme.typeBody
                    wrapMode: Text.WordWrap
                }
            }
        }
    }
}
