import QtQuick
import QtQuick.Layouts
import qs.Commons
import qs.Ui
import "EventModel.js" as EventModel
import "SessionModel.js" as SessionModel

Panel {
  id: root
  moduleName: "io.github.da5ater.dailyxp"
  ipcTarget: moduleName
  manageIpc: false

  property var anchorItem: null
  property var hostWidget: null
  property var stateStore: null
  readonly property var barIdentity: hostWidget || root
  readonly property color contentForeground: bar ? bar.foreground : Color.foreground
  readonly property string contentFontFamily: bar ? bar.fontFamily : Style.font.family
  property string nowUtc: new Date().toISOString()
  readonly property var activeSession: stateStore ? stateStore.sessionProjection.activeSession : null
  readonly property var selection: stateStore ? stateStore.sessionProjection.selection : null
  readonly property var sessionSummary: activeSession
    ? SessionModel.summaryAt(stateStore.sessionProjection, nowUtc) : null

  function selectedTask() {
    if (!selection || !stateStore) return null
    var tasks = stateStore.planningProjection.tasks || []
    for (var i = 0; i < tasks.length; i += 1) if (tasks[i].id === selection.taskId) return tasks[i]
    return null
  }

  function selectTask(task) {
    stateStore.applySessionCommand({
      type: "selection.change", taskId: task.id, selectedAtUtc: new Date().toISOString()
    })
  }

  function startSession() {
    var task = selectedTask()
    stateStore.applySessionCommand({
      type: "session.start",
      session: {
        id: EventModel.uuidV4(),
        taskId: task ? task.id : null,
        primarySkill: task ? task.primarySkill : "general/focus",
        plannedMinutes: task ? task.estimateMinutes : null,
        startedAtUtc: new Date().toISOString()
      }
    })
  }

  function sessionTransition(type) {
    stateStore.applySessionCommand({ type: type, atUtc: new Date().toISOString() })
  }

  function finishSession(plannedDecision) {
    stateStore.applySessionCommand({
      type: "session.finish",
      atUtc: new Date().toISOString(),
      plannedDurationDecision: plannedDecision || undefined,
      inactivityDecision: activeSession && activeSession.inactiveIntervals.length > 0 ? "exclude" : undefined,
      dailyCapAcknowledged: plannedDecision !== undefined
    })
  }

  function formatElapsed(milliseconds) {
    var totalSeconds = Math.floor(Number(milliseconds || 0) / 1000)
    var hours = Math.floor(totalSeconds / 3600)
    var minutes = Math.floor((totalSeconds % 3600) / 60)
    var seconds = totalSeconds % 60
    return String(hours).padStart(2, "0") + ":" + String(minutes).padStart(2, "0") + ":" +
      String(seconds).padStart(2, "0")
  }

  function open() {
    root.controller.show()
    Qt.callLater(function() {
      if (root.opened && root.bar && "centerHoverRevealSuppressed" in root.bar)
        root.bar.centerHoverRevealSuppressed = true
    })
  }

  function close() {
    if (root.bar && "centerHoverRevealSuppressed" in root.bar)
      root.bar.centerHoverRevealSuppressed = false
    root.controller.hide()
  }

  function toggle() {
    if (root.opened) root.close()
    else root.open()
  }

  function switchPanel(direction) {
    if (root.bar && typeof root.bar.switchPanelFrom === "function")
      return root.bar.switchPanelFrom(root.barIdentity, direction)
    return false
  }

  KeyboardPanel {
    id: panel
    anchorItem: root.anchorItem
    owner: root.barIdentity
    bar: root.bar
    open: root.opened
    centerOnBar: true
    focusTarget: keyCatcher
    contentWidth: panel.fittedContentWidth(Style.space(420))
    contentHeight: panel.fittedContentHeight(content.implicitHeight)

    PanelKeyCatcher {
      id: keyCatcher
      anchors.fill: parent
      onCloseRequested: root.close()
      onTabRequested: function(direction) { root.switchPanel(direction) }

      ColumnLayout {
        id: content
        width: parent.width
        spacing: Style.space(12)

        Text {
          text: root.activeSession ? "Focused Session" : "Choose what matters now"
          color: root.contentForeground
          font.family: root.contentFontFamily
          font.pixelSize: Style.font.title
          font.bold: true
          Layout.alignment: Qt.AlignHCenter
        }

        Text {
          text: root.activeSession
            ? root.formatElapsed(root.sessionSummary.focusedMilliseconds)
            : (root.selection ? "Selected: " + (root.selectedTask() ? root.selectedTask().title : root.selection.taskId)
              : "Selection declares intent. Time starts only when you press Start.")
          color: root.contentForeground
          font.family: root.contentFontFamily
          font.pixelSize: Style.font.body
          Layout.alignment: Qt.AlignHCenter
        }

        Text {
          visible: root.activeSession && root.activeSession.plannedMinutes !== null
          text: visible ? "Plan: " + root.activeSession.plannedMinutes + " minutes" : ""
          color: root.sessionSummary && root.sessionSummary.plannedDurationPassed ? Color.urgent : root.contentForeground
          font.family: root.contentFontFamily
          font.pixelSize: Style.font.bodySmall
          Layout.alignment: Qt.AlignHCenter
        }

        RowLayout {
          visible: root.activeSession
          Layout.alignment: Qt.AlignHCenter
          spacing: Style.space(8)

          Button {
            text: root.activeSession && root.activeSession.status === "running" ? "Pause" : "Resume"
            focusable: true
            bordered: true
            enabled: root.stateStore && !root.stateStore.saving
            onClicked: root.sessionTransition(root.activeSession.status === "running" ? "session.pause" : "session.resume")
          }

          Button {
            text: "Finish"
            focusable: true
            bordered: true
            enabled: root.stateStore && !root.stateStore.saving &&
              !root.activeSession.pendingInactivityStartedAtUtc
            onClicked: root.finishSession(undefined)
          }

          Button {
            text: "Discard"
            focusable: true
            bordered: false
            enabled: root.stateStore && !root.stateStore.saving
            onClicked: root.sessionTransition("session.discard")
          }
        }

        ColumnLayout {
          visible: root.activeSession && root.activeSession.pendingInactivityEndedAtUtc
          Layout.fillWidth: true
          spacing: Style.space(6)

          Text {
            text: "You were away. Count that interval as focused time?"
            color: root.contentForeground
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.bodySmall
            wrapMode: Text.Wrap
            Layout.fillWidth: true
            horizontalAlignment: Text.AlignHCenter
          }

          RowLayout {
            Layout.alignment: Qt.AlignHCenter
            Button {
              text: "Count it"
              focusable: true
              bordered: true
              onClicked: root.stateStore.applySessionCommand({
                type: "session.inactivity.resolve", atUtc: new Date().toISOString(), decision: "include"
              })
            }
            Button {
              text: "Exclude it"
              focusable: true
              bordered: true
              onClicked: root.stateStore.applySessionCommand({
                type: "session.inactivity.resolve", atUtc: new Date().toISOString(), decision: "exclude"
              })
            }
          }
        }

        ColumnLayout {
          visible: root.stateStore && root.stateStore.sessionConfirmation && root.activeSession
          Layout.fillWidth: true
          spacing: Style.space(6)

          Text {
            text: "Focused time needs your confirmation before competitive credit changes."
            color: Color.urgent
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.bodySmall
            wrapMode: Text.Wrap
            Layout.fillWidth: true
            horizontalAlignment: Text.AlignHCenter
          }

          RowLayout {
            Layout.alignment: Qt.AlignHCenter
            Button {
              text: "Count overtime"
              focusable: true
              bordered: true
              onClicked: root.finishSession("include-overtime")
            }
            Button {
              text: "Use planned time"
              focusable: true
              bordered: true
              onClicked: root.finishSession("exclude-overtime")
            }
          }
        }

        ColumnLayout {
          visible: !root.activeSession
          Layout.fillWidth: true
          spacing: Style.space(6)

          Repeater {
            model: root.stateStore ? root.stateStore.planningProjection.tasks : []
            delegate: Button {
              property var task: modelData
              text: (root.selection && root.selection.taskId === task.id ? "✓ " : "") + task.title
              focusable: true
              bordered: root.selection && root.selection.taskId === task.id
              Layout.fillWidth: true
              onClicked: root.selectTask(task)
            }
          }

          Button {
            text: root.selection && root.selection.reminderStatus === "due" ? "Start selected Session" :
              (root.selection ? "Start selected" : "Start free Session")
            focusable: true
            bordered: true
            enabled: root.stateStore && root.stateStore.recordingReady && !root.stateStore.saving
            Layout.alignment: Qt.AlignHCenter
            onClicked: root.startSession()
          }

          Button {
            visible: root.selection && root.selection.reminderStatus === "due"
            text: "Dismiss reminder"
            focusable: true
            bordered: false
            Layout.alignment: Qt.AlignHCenter
            onClicked: root.stateStore.applySessionCommand({
              type: "selection.reminder.dismiss", atUtc: new Date().toISOString()
            })
          }
        }

        Text {
          visible: root.stateStore && root.stateStore.errorMessage !== ""
          text: visible ? root.stateStore.errorMessage : ""
          color: Color.urgent
          font.family: root.contentFontFamily
          font.pixelSize: Style.font.bodySmall
          wrapMode: Text.Wrap
          Layout.fillWidth: true
          horizontalAlignment: Text.AlignHCenter
        }
      }
    }
  }

  Timer {
    interval: 1000
    repeat: true
    running: root.opened && root.activeSession && root.activeSession.status === "running"
    triggeredOnStart: true
    onTriggered: root.nowUtc = new Date().toISOString()
  }
}
