import QtQuick
import "../"
import "../../JourneyModel.js" as JourneyModel
import "../../ProgressionModel.js" as ProgressionModel

ArcadeSheet {
    id: sheet
    title: "XP LEDGER"
    property var shellApi: null
    readonly property var store: shellApi ? shellApi.stateStore : null
    readonly property var awards: JourneyModel.ledgerEntries(
        store ? store.progressionProjection : ProgressionModel.emptyProjection(),
        store && store.journal ? store.journal.events : [])
    initialFocusItem: awardsRepeater.count > 0 ? awardsRepeater.itemAt(0) : closeControl
    Column {
        width: parent.width
        spacing: Theme.space(4)
        Text {
            objectName: "journeyLifetimeXp"
            width: parent.width
            text: (sheet.store ? sheet.store.progressionProjection.totals.lifetimeXp : 0) + " lifetime XP · "
                  + (sheet.store ? sheet.store.progressionProjection.totals.seasonXp : 0) + " season XP"
            color: Theme.textPrimary
            font.family: Theme.fontFamily
            font.pixelSize: Theme.typeBody
            wrapMode: Text.WordWrap
        }
        Text {
            visible: sheet.awards.length === 0
            width: parent.width
            text: "No awards yet. Finish a focus session to begin your ledger."
            color: Theme.textMuted
            font.family: Theme.fontFamily
            font.pixelSize: Theme.typeBody
            wrapMode: Text.WordWrap
        }
        Repeater {
            id: awardsRepeater
            model: sheet.awards
            delegate: Column {
                id: entry
                required property var modelData
                required property int index
                objectName: "ledgerAward-" + index
                width: parent.width
                spacing: Theme.space(2)
                activeFocusOnTab: true
                KeyNavigation.tab: index === sheet.awards.length - 1 ? sheet.closeControl : awardsRepeater.itemAt(index + 1)
                onActiveFocusChanged: if (activeFocus) sheet.ensureVisible(entry)
                Accessible.role: Accessible.StaticText
                Accessible.name: amount.text + ". " + reason.text + ". " + metadata.text
                Rectangle {
                    width: parent.width
                    height: 2
                    color: entry.activeFocus ? Theme.coinGold : Theme.border
                }
                Text {
                    id: amount
                    width: parent.width
                    text: (entry.modelData.amount >= 0 ? "+" : "") + entry.modelData.amount + " XP"
                    color: Theme.electricLime
                    font.family: Theme.fontFamily
                    font.pixelSize: Theme.typeBody
                }
                Text {
                    id: reason
                    width: parent.width
                    text: entry.modelData.reason
                    color: Theme.textPrimary
                    font.family: Theme.fontFamily
                    font.pixelSize: Theme.typeBody
                    wrapMode: Text.WrapAnywhere
                }
                Text {
                    id: metadata
                    width: parent.width
                    text: "Rule v" + entry.modelData.ruleVersion + " · " + (entry.modelData.timestamp || "Timestamp unavailable")
                    color: Theme.textMuted
                    font.family: Theme.fontFamily
                    font.pixelSize: Theme.typeBody
                    wrapMode: Text.WrapAnywhere
                }
            }
        }
    }
    function ensureFocusedAward() {
        for (var i = 0; i < awardsRepeater.count; i++) {
            var item = awardsRepeater.itemAt(i)
            if (item && item.activeFocus) { sheet.ensureVisible(item); return }
        }
    }
    onWidthChanged: Qt.callLater(ensureFocusedAward)
    Component.onCompleted: closeControl.forceActiveFocus()
}
