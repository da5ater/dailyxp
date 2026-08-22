import QtQuick
import QtQuick.Layouts
import qs.Commons
import qs.Ui
import "EventModel.js" as EventModel
import "SessionModel.js" as SessionModel
import "ProgressionModel.js" as ProgressionModel
import "StoryModel.js" as StoryModel

Panel {
  id: root
  moduleName: "io.github.da5ater.dailyxp"
  ipcTarget: moduleName
  manageIpc: false

  property var anchorItem: null
  property var hostWidget: null
  property var stateStore: null
  property bool usePlannedDuration: true
  property var pendingCorrectionCommand: null
  property int correctionSessionOffset: 0
  readonly property var barIdentity: hostWidget || root
  readonly property color contentForeground: bar ? bar.foreground : Color.foreground
  readonly property string contentFontFamily: bar ? bar.fontFamily : Style.font.family
  property string nowUtc: new Date().toISOString()
  readonly property var activeSession: stateStore ? stateStore.sessionProjection.activeSession : null
  readonly property var selection: stateStore ? stateStore.sessionProjection.selection : null
  readonly property var recentSession: correctionSession()

  readonly property var progressionProjection: stateStore ? stateStore.progressionProjection : null
  function progressionPreview(entry) {
    if (!entry) return ""
    try { return ProgressionModel.previewFor(entry) } catch (e) { return entry.reason || "" }
  }
  function progressionLevelText() {
    var proj = progressionProjection
    if (!proj) return "Level 1 \u00b7 Wanderer"
    return "Level " + proj.level + " \u00b7 " + proj.storyRank
  }
  function progressionTotalsText() {
    var proj = progressionProjection
    if (!proj || !proj.totals) return "0 Lifetime \u00b7 0 Season"
    return proj.totals.lifetimeXp + " Lifetime \u00b7 " + proj.totals.seasonXp + " Season"
  }
  readonly property var storyProjection: stateStore ? stateStore.storyProjection : null
  function provinceLabel(status) {
    if (status === "achieved") return "visitable"
    if (status === "sleeping") return "sleeping"
    if (status === "ruins") return "Ruins"
    return "active"
  }
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

  function startSession(forceFree) {
    var task = forceFree === true ? null : selectedTask()
    var freePlanned = Number(freePlanField.text)
    var freePlannedMinutes = Number.isInteger(freePlanned) && freePlanned > 0 ? freePlanned : null
    stateStore.applySessionCommand({
      type: "session.start",
      session: {
        id: EventModel.uuidV4(),
        taskId: task ? task.id : null,
        primarySkill: task ? task.primarySkill : "general/focus",
        plannedMinutes: task ? (usePlannedDuration ? task.estimateMinutes : null) : freePlannedMinutes,
        startedAtUtc: new Date().toISOString()
      }
    })
  }

  function sessionTransition(type) {
    stateStore.applySessionCommand({ type: type, atUtc: new Date().toISOString() })
  }

  function finishSession(plannedDecision, acknowledgeCap) {
    stateStore.applySessionCommand({
      type: "session.finish",
      atUtc: new Date().toISOString(),
      plannedDurationDecision: plannedDecision || undefined,
      inactivityDecision: activeSession && activeSession.inactiveIntervals.length > 0 ? "exclude" : undefined,
      dailyCapAcknowledged: acknowledgeCap === true
    })
  }

  function hasConfirmationReason(reason) {
    var confirmation = stateStore ? stateStore.sessionConfirmation : null
    return confirmation && confirmation.reasons && confirmation.reasons.indexOf(reason) !== -1
  }

  function confirmationText() {
    var confirmation = stateStore ? stateStore.sessionConfirmation : null
    if (!confirmation) return ""
    var messages = []
    if (hasConfirmationReason("planned-duration"))
      messages.push("The planned duration passed. Choose whether overtime receives competitive credit.")
    if (hasConfirmationReason("daily-cap")) {
      var excluded = Number(confirmation.dailyCapExcludedMilliseconds || 0) / 60000
      messages.push("The 12-hour daily cap excludes " + excluded + " minutes from competitive credit. Focused history stays intact.")
    }
    if (hasConfirmationReason("correction")) {
      var delta = Number(confirmation.competitiveDeltaMilliseconds || 0) / 60000
      messages.push("This correction changes competitive time by " + (delta > 0 ? "+" : "") + delta + " minutes.")
    }
    return messages.length > 0 ? messages.join(" ")
      : "Focused time needs your confirmation before competitive credit changes."
  }

  function cycleActiveTask() {
    if (!activeSession || !stateStore) return
    var tasks = stateStore.planningProjection.tasks || []
    var nextTaskId = null
    if (activeSession.taskId === null && tasks.length > 0) nextTaskId = tasks[0].id
    else for (var i = 0; i < tasks.length; i += 1)
      if (tasks[i].id === activeSession.taskId && i + 1 < tasks.length) nextTaskId = tasks[i + 1].id
    stateStore.applySessionCommand({
      type: "session.change_task", taskId: nextTaskId, atUtc: new Date().toISOString()
    })
  }

  function correctionSession() {
    if (!stateStore) return null
    var sessions = stateStore.sessionProjection.sessions || []
    var finished = []
    for (var i = sessions.length - 1; i >= 0; i -= 1)
      if (sessions[i].status === "finished") finished.push(sessions[i])
    return correctionSessionOffset < finished.length ? finished[correctionSessionOffset] : null
  }

  function finishedSessionCount() {
    if (!stateStore) return 0
    var sessions = stateStore.sessionProjection.sessions || []
    var count = 0
    for (var i = 0; i < sessions.length; i += 1)
      if (sessions[i].status === "finished") count += 1
    return count
  }

  function correctionCommand(deltaMinutes, changes, exactMilliseconds) {
    if (!recentSession || recentSession.status !== "finished") return null
    var segments = JSON.parse(JSON.stringify(
      SessionModel.focusedSegments(recentSession, recentSession.finishedAtUtc)))
    if (segments.length === 0) return null
    var targetMilliseconds = exactMilliseconds === undefined
      ? recentSession.focusedMilliseconds + deltaMinutes * 60000 : exactMilliseconds
    try {
      segments = SessionModel.resizeFocusedSegments(
        segments, targetMilliseconds, new Date().toISOString())
    } catch (error) {
      return null
    }
    return {
      type: "session.correct", id: recentSession.id, atUtc: new Date().toISOString(),
      segments: segments, changes: changes
    }
  }

  function requestCorrection(deltaMinutes, changes, exactMilliseconds) {
    pendingCorrectionCommand = correctionCommand(deltaMinutes, changes, exactMilliseconds)
    if (!pendingCorrectionCommand) return
    stateStore.applySessionCommand(pendingCorrectionCommand)
    if (!stateStore.sessionConfirmation) pendingCorrectionCommand = null
  }

  function correctionTaskChange() {
    if (!recentSession || !stateStore) return
    var tasks = stateStore.planningProjection.tasks || []
    var nextTask = null
    if (recentSession.taskId === null && tasks.length > 0) nextTask = tasks[0]
    else for (var i = 0; i < tasks.length; i += 1)
      if (tasks[i].id === recentSession.taskId && i + 1 < tasks.length) nextTask = tasks[i + 1]
    requestCorrection(0, {
      taskId: nextTask ? nextTask.id : null,
      primarySkill: nextTask ? nextTask.primarySkill : "general/focus"
    })
  }

  function correctionPlannedChange(deltaMinutes) {
    if (!recentSession) return
    var current = recentSession.plannedMinutes === null ? 0 : recentSession.plannedMinutes
    var revised = Math.max(0, current + deltaMinutes)
    requestCorrection(0, { plannedMinutes: revised === 0 ? null : revised })
  }

  function requestExactCorrection(durationText, skillText, plannedText) {
    if (!recentSession) return
    var targetMinutes = Number(durationText)
    if (!isFinite(targetMinutes) || targetMinutes <= 0) return
    var skill = String(skillText || "").trim()
    var planned = String(plannedText || "").trim().toLowerCase()
    var changes = ({})
    if (skill !== "") changes.primarySkill = skill
    if (planned === "open") changes.plannedMinutes = null
    else if (planned !== "") {
      var plannedMinutes = Number(planned)
      if (!Number.isInteger(plannedMinutes) || plannedMinutes < 1) return
      changes.plannedMinutes = plannedMinutes
    }
    var targetMilliseconds = targetMinutes * 60000
    if (!Number.isInteger(targetMilliseconds)) return
    requestCorrection(0, changes, targetMilliseconds)
  }

  function continueCorrection(plannedDecision, confirmCompetitiveChange) {
    if (!pendingCorrectionCommand) return
    var command = JSON.parse(JSON.stringify(pendingCorrectionCommand))
    if (plannedDecision !== undefined) command.plannedDurationDecision = plannedDecision
    if (confirmCompetitiveChange === true) command.competitiveChangeConfirmed = true
    pendingCorrectionCommand = command
    stateStore.applySessionCommand(command)
    if (!stateStore.sessionConfirmation) pendingCorrectionCommand = null
  }

  function formatElapsed(milliseconds) {
    var totalSeconds = Math.floor(Number(milliseconds || 0) / 1000)
    var hours = Math.floor(totalSeconds / 3600)
    var minutes = Math.floor((totalSeconds % 3600) / 60)
    var seconds = totalSeconds % 60
    return String(hours).padStart(2, "0") + ":" + String(minutes).padStart(2, "0") + ":" +
      String(seconds).padStart(2, "0")
  }

  function statusText() {
    if (activeSession) return formatElapsed(sessionSummary.focusedMilliseconds)
    if (!selection) return "Selection declares intent. Time starts only when you press Start."
    var task = selectedTask()
    return "Selected: " + (task ? task.title : selection.taskId)
  }

  function startButtonText() {
    if (!selection) return "Start free Session"
    if (selection.reminderStatus === "due") return "Start selected Session"
    return "Start selected"
  }

  function plannedModeText() {
    var task = selectedTask()
    if (!task) return "Open-ended Session"
    return usePlannedDuration ? "Planned: " + task.estimateMinutes + " minutes" : "Open-ended Session"
  }

  function recentSessionText() {
    if (!recentSession) return ""
    var revision = recentSession.lastRevisionKind ? " · " + recentSession.lastRevisionKind : ""
    return "Session " + recentSession.id.slice(0, 8) + " · " +
      formatElapsed(recentSession.focusedMilliseconds) + revision
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

  // Apple: material + spatial consistency (enter/exit same path, anchored to trigger), Gaming: staging + appeal, Animate: spatial 220-420ms ease-out
  readonly property bool _reducedMotion: false // bind to Style.prefersReducedMotion when available
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
    // Apple: symmetric spring, interruptible from presentation value, materialize (blur+scale not just opacity)
    Behavior on contentWidth { enabled: !_reducedMotion; NumberAnimation { duration: 280; easing.type: Easing.OutCubic } }
    Behavior on contentHeight { enabled: !_reducedMotion; NumberAnimation { duration: 280; easing.type: Easing.OutCubic } }

    PanelKeyCatcher {
      id: keyCatcher
      anchors.fill: parent
      blocked: freePlanField.activeFocus || correctionDuration.activeFocus ||
        correctionSkill.activeFocus || correctionPlanned.activeFocus
      onCloseRequested: root.close()
      onTabRequested: function(direction) { root.switchPanel(direction) }

      // Apple material: translucent layer, content scrolls underneath, not opaque bar; Gaming: hero staging
      Rectangle {
        id: materialBg
        anchors.fill: parent
        anchors.margins: -Style.space(12)
        color: Qt.rgba(0.05, 0.07, 0.14, 0.72) // midnight navy 72% + warm gold hint for permanent progress
        radius: Style.space(16)
        border.color: Qt.rgba(1,1,1,0.08)
        // blur approximation: opacity fade + scale materialize (real backdrop-filter via layer when available)
        opacity: 1.0
        scale: 1.0
        visible: !_reducedMotion || true
        Behavior on opacity { enabled: !_reducedMotion; NumberAnimation { duration: 220; easing.type: Easing.OutCubic } }
        Behavior on scale { enabled: !_reducedMotion; NumberAnimation { duration: 320; easing.type: Easing.OutCubic } }
      }

      ColumnLayout {
        id: content
        width: parent.width
        spacing: Style.space(12)
        // Apple typography: tighten display, loosen body, respect Dynamic Type via rem
        Text {
          text: root.activeSession ? "Focused Session" : "Choose what matters now"
          color: root.contentForeground
          font.family: root.contentFontFamily
          font.pixelSize: Style.font.title
          font.bold: true
          // tracking: -0.02em for display, leading 1.05
          font.letterSpacing: -0.3
          lineHeight: 1.05
          Layout.alignment: Qt.AlignHCenter
          // Gaming: anticipation — subtle scale-in on title change
          opacity: 1.0
          scale: 1.0
          Behavior on opacity { enabled: !_reducedMotion; NumberAnimation { duration: 180; easing.type: Easing.OutCubic } }
          Behavior on scale { enabled: !_reducedMotion; NumberAnimation { duration: 320; easing.type: Easing.OutCubic } }
        }

        Text {
          text: root.statusText()
          color: root.contentForeground
          font.family: root.contentFontFamily
          font.pixelSize: Style.font.body
          Layout.alignment: Qt.AlignHCenter
        }

        Text {
          visible: root.activeSession && root.activeSession.plannedMinutes !== null
          text: visible ? (root.sessionSummary && root.sessionSummary.plannedDurationPassed
            ? "Plan passed · choose overtime credit when finishing"
            : "Plan: " + root.activeSession.plannedMinutes + " minutes") : ""
          color: root.sessionSummary && root.sessionSummary.plannedDurationPassed ? Color.urgent : root.contentForeground
          font.family: root.contentFontFamily
          font.pixelSize: Style.font.bodySmall
          Layout.alignment: Qt.AlignHCenter
        }

        Button {
          visible: root.activeSession && root.stateStore && root.stateStore.planningProjection.tasks.length > 0
          text: root.activeSession && root.activeSession.taskId ? "Change attached Task" : "Attach a Task"
          focusable: true
          bordered: false
          enabled: root.stateStore && !root.stateStore.saving
          Layout.alignment: Qt.AlignHCenter
          onClicked: root.cycleActiveTask()
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
            enabled: root.activeSession
              ? root.stateStore && !root.stateStore.saving && !root.activeSession.pendingInactivityStartedAtUtc
              : false
            onClicked: root.finishSession(undefined, false)
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
          visible: root.stateStore && root.stateStore.sessionConfirmation &&
            (root.activeSession || root.pendingCorrectionCommand)
          Layout.fillWidth: true
          spacing: Style.space(6)

          Text {
            text: root.confirmationText()
            color: Color.urgent
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.bodySmall
            wrapMode: Text.Wrap
            Layout.fillWidth: true
            horizontalAlignment: Text.AlignHCenter
          }

          RowLayout {
            visible: root.hasConfirmationReason("planned-duration")
            Layout.alignment: Qt.AlignHCenter
            Button {
              text: "Count overtime"
              focusable: true
              bordered: true
              onClicked: root.pendingCorrectionCommand
                ? root.continueCorrection("include-overtime", false)
                : root.finishSession("include-overtime", true)
            }
            Button {
              text: "Use planned time"
              focusable: true
              bordered: true
              onClicked: root.pendingCorrectionCommand
                ? root.continueCorrection("exclude-overtime", false)
                : root.finishSession("exclude-overtime", true)
            }
          }

          Button {
            visible: !root.pendingCorrectionCommand && root.hasConfirmationReason("daily-cap") &&
              !root.hasConfirmationReason("planned-duration")
            text: "Accept competitive cap"
            focusable: true
            bordered: true
            Layout.alignment: Qt.AlignHCenter
            onClicked: root.finishSession(undefined, true)
          }

          Button {
            visible: root.pendingCorrectionCommand && root.hasConfirmationReason("correction")
            text: "Apply correction"
            focusable: true
            bordered: true
            Layout.alignment: Qt.AlignHCenter
            onClicked: root.continueCorrection(undefined, true)
          }
        }

        ColumnLayout {
          visible: !root.activeSession
          Layout.fillWidth: true
          spacing: Style.space(6)

          // Gaming: follow-through & overlapping — subtle stagger, Gaming: appeal via squash on select; Animate: feedback 120ms ease-out, spatial 220ms
          Repeater {
            model: root.stateStore ? root.stateStore.planningProjection.tasks : []
            delegate: Button {
              property var task: modelData
              text: (root.selection && root.selection.taskId === task.id ? "✓ " : "") + task.title
              focusable: true
              bordered: root.selection && root.selection.taskId === task.id
              Layout.fillWidth: true
              // Animate: transform/opacity only, never scale(0), start 0.97 + opacity 0
              opacity: 1.0
              scale: 1.0
              Behavior on opacity { enabled: !root._reducedMotion; NumberAnimation { duration: 200; easing.type: Easing.OutCubic } }
              Behavior on scale { enabled: !root._reducedMotion; NumberAnimation { duration: 120; easing.type: Easing.OutCubic } }
              onClicked: {
                // Gaming: squash & stretch — instant feedback on press
                scale = 0.97
                Qt.callLater(function(){ scale = 1.0 })
                root.selectTask(task)
              }
            }
          }

          Button {
            visible: root.selection && root.selectedTask()
            text: root.plannedModeText()
            focusable: true
            bordered: root.usePlannedDuration
            Layout.alignment: Qt.AlignHCenter
            onClicked: root.usePlannedDuration = !root.usePlannedDuration
          }

          TextField {
            id: freePlanField
            width: Style.space(140)
            placeholderText: "planned min (blank = open)"
            foreground: root.contentForeground
            font.family: root.contentFontFamily
            inputMethodHints: Qt.ImhDigitsOnly
            Layout.alignment: Qt.AlignHCenter
          }

          Button {
            text: root.startButtonText()
            focusable: true
            bordered: true
            enabled: root.stateStore && root.stateStore.recordingReady && !root.stateStore.saving
            Layout.alignment: Qt.AlignHCenter
            onClicked: root.startSession(false)
          }

          Button {
            visible: root.selection
            text: "Start free Session"
            focusable: true
            bordered: false
            enabled: root.stateStore && root.stateStore.recordingReady && !root.stateStore.saving
            Layout.alignment: Qt.AlignHCenter
            onClicked: root.startSession(true)
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

        ColumnLayout {
          visible: !root.activeSession && root.recentSession && root.recentSession.status === "finished"
          Layout.fillWidth: true
          spacing: Style.space(6)

          Text {
            text: root.recentSessionText()
            color: root.contentForeground
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.bodySmall
            Layout.alignment: Qt.AlignHCenter
          }

          RowLayout {
            Layout.alignment: Qt.AlignHCenter
            TextField {
              id: correctionDuration
              width: Style.space(82)
              placeholderText: "exact min"
              foreground: root.contentForeground
              font.family: root.contentFontFamily
              inputMethodHints: Qt.ImhFormattedNumbersOnly
            }
            TextField {
              id: correctionSkill
              width: Style.space(110)
              placeholderText: "skill (optional)"
              foreground: root.contentForeground
              font.family: root.contentFontFamily
            }
            TextField {
              id: correctionPlanned
              width: Style.space(82)
              placeholderText: "plan/open"
              foreground: root.contentForeground
              font.family: root.contentFontFamily
            }
            Button {
              text: "Apply exact"
              focusable: true
              bordered: true
              enabled: root.stateStore && !root.stateStore.saving && correctionDuration.text !== ""
              onClicked: root.requestExactCorrection(
                correctionDuration.text, correctionSkill.text, correctionPlanned.text)
            }
          }

          RowLayout {
            Layout.alignment: Qt.AlignHCenter
            Button {
              text: "−5 minutes"
              focusable: true
              bordered: false
              enabled: root.stateStore && !root.stateStore.saving
              onClicked: root.requestCorrection(-5, undefined)
            }
            Button {
              text: "+5 minutes"
              focusable: true
              bordered: false
              enabled: root.stateStore && !root.stateStore.saving
              onClicked: root.requestCorrection(5, undefined)
            }
          }


          RowLayout {
            Layout.alignment: Qt.AlignHCenter
            Button {
              text: "Older"
              focusable: true
              bordered: false
              enabled: root.correctionSessionOffset + 1 < root.finishedSessionCount()
              onClicked: root.correctionSessionOffset += 1
            }
            Button {
              text: "Newer"
              focusable: true
              bordered: false
              enabled: root.correctionSessionOffset > 0
              onClicked: root.correctionSessionOffset -= 1
            }
          }

          RowLayout {
            Layout.alignment: Qt.AlignHCenter
            Button {
              text: root.recentSession && root.recentSession.taskId ? "Change Task / Skill" : "Attach Task / Skill"
              focusable: true
              bordered: false
              enabled: root.stateStore && !root.stateStore.saving
              onClicked: root.correctionTaskChange()
            }
            Button {
              text: "−5 planned"
              focusable: true
              bordered: false
              enabled: root.stateStore && !root.stateStore.saving
              onClicked: root.correctionPlannedChange(-5)
            }
            Button {
              text: "+5 planned"
              focusable: true
              bordered: false
              enabled: root.stateStore && !root.stateStore.saving
              onClicked: root.correctionPlannedChange(5)
            }
          }
        }

        // progression-ledger — PROG-001 executable surface: level/rank, Momentum, ledger with previewable calculation, Habit cap + Season farming guard, season reset
        ColumnLayout {
          Layout.fillWidth: true
          spacing: Style.space(8)

          Rectangle {
            height: 1
            color: Qt.rgba(1, 1, 1, 0.08)
            Layout.fillWidth: true
          }

          Text {
            text: "Progress"
            color: root.contentForeground
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.titleSmall || Style.font.title
            font.bold: true
            Layout.alignment: Qt.AlignHCenter
          }

          Text {
            text: root.progressionLevelText()
            color: root.contentForeground
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.body
            font.bold: true
            Layout.alignment: Qt.AlignHCenter
          }

          Text {
            text: root.progressionTotalsText()
            color: root.contentForeground
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.bodySmall
            Layout.alignment: Qt.AlignHCenter
          }

          Text {
            text: root.progressionProjection ? ("Momentum: " + root.progressionProjection.momentum) : "Momentum: Dormant"
            color: root.contentForeground
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.bodySmall
            Layout.alignment: Qt.AlignHCenter
          }

          Text {
            text: "Habit Season capped at 7/day (extras stay personal) \u00b7 Milestone Season 0 prevents farming \u00b7 Season reset preserves Lifetime"
            color: root.contentForeground
            opacity: 0.72
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.caption || Style.font.bodySmall
            wrapMode: Text.Wrap
            Layout.fillWidth: true
            horizontalAlignment: Text.AlignHCenter
          }

          RowLayout {
            Layout.alignment: Qt.AlignHCenter
            Button {
              text: "Reset Season"
              focusable: true
              bordered: true
              enabled: root.stateStore && !root.stateStore.saving && root.progressionProjection && root.progressionProjection.totals && root.progressionProjection.totals.seasonXp > 0
              onClicked: root.stateStore.applyProgressionCommand({ type: "progression.season.reset" })
            }
            Text {
              visible: root.progressionProjection && root.progressionProjection.seasonId !== undefined
              text: visible ? ("Season " + root.progressionProjection.seasonId) : ""
              color: root.contentForeground
              opacity: 0.6
              font.family: root.contentFontFamily
              font.pixelSize: Style.font.caption || Style.font.bodySmall
            }
          }

          Text {
            visible: !root.progressionProjection || !root.progressionProjection.ledger || root.progressionProjection.ledger.length === 0
            text: "No ledger entries yet. Complete a Session, habit, or milestone to earn rule-versioned XP."
            color: root.contentForeground
            opacity: 0.68
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.bodySmall
            wrapMode: Text.Wrap
            Layout.fillWidth: true
            horizontalAlignment: Text.AlignHCenter
          }

          ColumnLayout {
            visible: root.progressionProjection && root.progressionProjection.ledger && root.progressionProjection.ledger.length > 0
            Layout.fillWidth: true
            spacing: Style.space(6)

            Text {
              text: "Ledger \u2014 each award once, previewable calculation"
              color: root.contentForeground
              opacity: 0.72
              font.family: root.contentFontFamily
              font.pixelSize: Style.font.caption || Style.font.bodySmall
              Layout.alignment: Qt.AlignHCenter
            }

            Repeater {
              model: root.progressionProjection ? root.progressionProjection.ledger : []
              delegate: ColumnLayout {
                property var entry: modelData
                Layout.fillWidth: true
                spacing: Style.space(2)
                Text {
                  text: root.progressionPreview(entry)
                  color: root.contentForeground
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.bodySmall
                  wrapMode: Text.Wrap
                  Layout.fillWidth: true
                }
                Text {
                  visible: entry && entry.calculation
                  text: {
                    if (!entry || !entry.calculation) return ""
                    var c = entry.calculation
                    if (c.correction) return "calculation: correction"
                    if (c.minutes !== undefined) {
                      var parts = ["base " + c.base + " (1/min \u00b7 " + c.minutes + "m)"]
                      if (c.plannedBonus) parts.push("planned +" + c.plannedBonus)
                      if (c.dailyTargetBonus) parts.push("daily-target +" + c.dailyTargetBonus)
                      return "calculation: " + parts.join(" \u00b7 ")
                    }
                    if (c.habitId) return "calculation: habit " + c.habitId + " \u00b7 20 Lifetime"
                    if (c.significance !== undefined) return "calculation: significance " + c.significance + " \u00b7 " + c.award + " Lifetime, 0 Season (locked)"
                    if (c.fullSetBonus !== undefined) return "calculation: full set \u00b7 +" + c.fullSetBonus + " Lifetime, 0 Season"
                    if (c.seasonId !== undefined) return "calculation: Season " + c.seasonId
                    return "calculation: v" + (entry.ruleVersion || 1)
                  }
                  color: root.contentForeground
                  opacity: 0.58
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.caption || Style.font.bodySmall
                  wrapMode: Text.Wrap
                  Layout.fillWidth: true
                }
              }
            }
          }
        }


        // kingdom— STORY-001 executable surface: provinces/landmarks, antagonists neutral, comeback quest 3 steps, Hollow King
        ColumnLayout {
          Layout.fillWidth: true
          spacing: Style.space(8)

          Rectangle {
            height: 1
            color: Qt.rgba(1, 1, 1, 0.08)
            Layout.fillWidth: true
          }

          Text {
            text: "Kingdom"
            color: root.contentForeground
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.titleSmall || Style.font.title
            font.bold: true
            Layout.alignment: Qt.AlignHCenter
          }

          Text {
            visible: !root.storyProjection || !root.storyProjection.provinces || root.storyProjection.provinces.length === 0
            text: "No provinces yet. Create a Goal to found your first province."
            color: root.contentForeground
            opacity: 0.68
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.bodySmall
            wrapMode: Text.Wrap
            Layout.fillWidth: true
            horizontalAlignment: Text.AlignHCenter
          }

          ColumnLayout {
            visible: root.storyProjection && root.storyProjection.provinces && root.storyProjection.provinces.length > 0
            Layout.fillWidth: true
            spacing: Style.space(6)

            Repeater {
              model: root.storyProjection ? root.storyProjection.provinces : []
              delegate: ColumnLayout {
                property var province: modelData
                Layout.fillWidth: true
                spacing: Style.space(4)

                RowLayout {
                  Layout.fillWidth: true
                  spacing: Style.space(8)
                  Text {
                    text: province ? province.title : ""
                    color: root.contentForeground
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.body
                    font.bold: true
                    wrapMode: Text.Wrap
                    Layout.fillWidth: true
                  }
                  Text {
                    text: province ? root.provinceLabel(province.status) : ""
                    color: root.contentForeground
                    opacity: 0.62
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.caption || Style.font.bodySmall
                  }
                }

                Text {
                  visible: province && province.status === "ruins"
                  text: "Ruins — abandoned territory, nothing is lost permanently; reclaim by restoring the goal."
                  color: root.contentForeground
                  opacity: 0.6
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.caption || Style.font.bodySmall
                  wrapMode: Text.Wrap
                  Layout.fillWidth: true
                }

                Text {
                  visible: province && province.landmarks && province.landmarks.length === 0
                  text: "No landmarks yet."
                  color: root.contentForeground
                  opacity: 0.55
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.caption || Style.font.bodySmall
                  Layout.fillWidth: true
                }

                Repeater {
                  model: province && province.landmarks ? province.landmarks : []
                  delegate: RowLayout {
                    property var landmark: modelData
                    Layout.fillWidth: true
                    spacing: Style.space(6)
                    Text {
                      text: landmark ? landmark.title : ""
                      color: root.contentForeground
                      font.family: root.contentFontFamily
                      font.pixelSize: Style.font.bodySmall
                      Layout.fillWidth: true
                      wrapMode: Text.Wrap
                    }
                    Text {
                      text: landmark ? (landmark.status === "built" ? "built" : "planned") : ""
                      color: root.contentForeground
                      opacity: 0.62
                      font.family: root.contentFontFamily
                      font.pixelSize: Style.font.caption || Style.font.bodySmall
                    }
                  }
                }
              }
            }
          }

          // Antagonists — neutral cause language, never insulting
          ColumnLayout {
            visible: root.storyProjection && root.storyProjection.antagonists && root.storyProjection.antagonists.length > 0
            Layout.fillWidth: true
            spacing: Style.space(6)
            Text {
              text: "Challenges — what caused them"
              color: root.contentForeground
              opacity: 0.72
              font.family: root.contentFontFamily
              font.pixelSize: Style.font.caption || Style.font.bodySmall
              font.bold: true
              Layout.alignment: Qt.AlignHCenter
            }
            Repeater {
              model: root.storyProjection ? root.storyProjection.antagonists : []
              delegate: ColumnLayout {
                property var foe: modelData
                Layout.fillWidth: true
                spacing: Style.space(2)
                Text {
                  text: foe ? foe.label : ""
                  color: root.contentForeground
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.bodySmall
                  font.bold: true
                }
                Text {
                  text: foe ? foe.cause : ""
                  color: root.contentForeground
                  opacity: 0.68
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.bodySmall
                  wrapMode: Text.Wrap
                  Layout.fillWidth: true
                }
                Text {
                  visible: foe && foe.id === "hollow-king"
                  text: "Only unfinished provinces are affected."
                  color: root.contentForeground
                  opacity: 0.6
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.caption || Style.font.bodySmall
                  wrapMode: Text.Wrap
                  Layout.fillWidth: true
                }
              }
            }
          }
          Text {
            visible: !root.storyProjection || !root.storyProjection.antagonists || root.storyProjection.antagonists.length === 0
            text: "No active challenges — neutral antagonists appear only when the underlying behaviour occurs."
            color: root.contentForeground
            opacity: 0.55
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.caption || Style.font.bodySmall
            wrapMode: Text.Wrap
            Layout.fillWidth: true
            horizontalAlignment: Text.AlignHCenter
          }

          // Comeback Quest — appears after 7 inactive eligible days; 3 steps, reclaims province + Achievement, ignore has no punishment
          ColumnLayout {
            visible: root.storyProjection && root.storyProjection.comebackQuest
            Layout.fillWidth: true
            spacing: Style.space(6)

            Text {
              text: root.storyProjection && root.storyProjection.comebackQuest
                ? (root.storyProjection.comebackQuest.status === "completed" ? "Comeback Quest — reclaimed"
                  : root.storyProjection.comebackQuest.status === "ignored" ? "Comeback Quest — set aside"
                  : root.storyProjection.comebackQuest.status === "active" ? "Comeback Quest — in progress"
                  : "Comeback Quest — available") : "Comeback Quest"
              color: root.contentForeground
              font.family: root.contentFontFamily
              font.pixelSize: Style.font.bodySmall
              font.bold: true
              Layout.alignment: Qt.AlignHCenter
            }

            Text {
              text: root.storyProjection && root.storyProjection.comebackQuest && root.storyProjection.comebackQuest.explains
                ? root.storyProjection.comebackQuest.explains : ""
              visible: root.storyProjection && root.storyProjection.comebackQuest && root.storyProjection.comebackQuest.explains
              color: root.contentForeground
              opacity: 0.62
              font.family: root.contentFontFamily
              font.pixelSize: Style.font.caption || Style.font.bodySmall
              wrapMode: Text.Wrap
              Layout.fillWidth: true
              horizontalAlignment: Text.AlignHCenter
            }

            Repeater {
              model: root.storyProjection && root.storyProjection.comebackQuest ? root.storyProjection.comebackQuest.steps : []
              delegate: RowLayout {
                property var step: modelData
                Layout.fillWidth: true
                spacing: Style.space(8)
                Text {
                  text: step ? (step.completed ? "✓" : "○") : ""
                  color: root.contentForeground
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.bodySmall
                }
                ColumnLayout {
                  Layout.fillWidth: true
                  spacing: 2
                  Text {
                    text: step ? step.title : ""
                    color: root.contentForeground
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.bodySmall
                    wrapMode: Text.Wrap
                    Layout.fillWidth: true
                  }
                  Text {
                    text: step ? step.required : ""
                    color: root.contentForeground
                    opacity: 0.58
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.caption || Style.font.bodySmall
                    wrapMode: Text.Wrap
                    Layout.fillWidth: true
                  }
                }
              }
            }

            Text {
              text: root.storyProjection && root.storyProjection.comebackQuest && root.storyProjection.comebackQuest.reward
                ? ("Reward: " + root.storyProjection.comebackQuest.reward) : ""
              visible: root.storyProjection && root.storyProjection.comebackQuest && root.storyProjection.comebackQuest.reward
              color: root.contentForeground
              opacity: 0.64
              font.family: root.contentFontFamily
              font.pixelSize: Style.font.caption || Style.font.bodySmall
              wrapMode: Text.Wrap
              Layout.fillWidth: true
              horizontalAlignment: Text.AlignHCenter
            }

            Text {
              visible: root.storyProjection && root.storyProjection.comebackQuest && root.storyProjection.comebackQuest.status === "ignored"
              text: "Set aside — no punishment, no hidden loss. It remains available to reclaim."
              color: root.contentForeground
              opacity: 0.62
              font.family: root.contentFontFamily
              font.pixelSize: Style.font.caption || Style.font.bodySmall
              wrapMode: Text.Wrap
              Layout.fillWidth: true
              horizontalAlignment: Text.AlignHCenter
            }

            RowLayout {
              Layout.alignment: Qt.AlignHCenter
              spacing: Style.space(8)
              Button {
                visible: root.storyProjection && root.storyProjection.comebackQuest && root.storyProjection.comebackQuest.status === "available"
                text: "Accept Quest"
                focusable: true
                bordered: true
                enabled: root.stateStore && !root.stateStore.saving
                onClicked: root.stateStore.applyStoryCommand({ type: "story.comeback.accept" })
              }
              Button {
                visible: root.storyProjection && root.storyProjection.comebackQuest && root.storyProjection.comebackQuest.status === "active"
                text: "Complete Quest"
                focusable: true
                bordered: true
                enabled: root.stateStore && !root.stateStore.saving
                onClicked: root.stateStore.applyStoryCommand({ type: "story.comeback.complete" })
              }
              Button {
                visible: root.storyProjection && root.storyProjection.comebackQuest && (root.storyProjection.comebackQuest.status === "available" || root.storyProjection.comebackQuest.status === "active")
                text: "Set aside"
                focusable: true
                bordered: false
                enabled: root.stateStore && !root.stateStore.saving
                onClicked: root.stateStore.applyStoryCommand({ type: "story.comeback.ignore" })
              }
            }
          }

          Text {
            visible: !root.storyProjection || !root.storyProjection.comebackQuest
            text: "Comeback Quest appears after 7 inactive eligible days — 3 forgiving steps. Success reclaims and grants an Achievement; setting it aside has no punishment or hidden loss."
            color: root.contentForeground
            opacity: 0.55
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.caption || Style.font.bodySmall
            wrapMode: Text.Wrap
            Layout.fillWidth: true
            horizontalAlignment: Text.AlignHCenter
          }

          // Achievements (cosmetic)
          Text {
            visible: root.storyProjection && root.storyProjection.achievements && root.storyProjection.achievements.length > 0
            text: {
              var a = root.storyProjection.achievements
              if (!a || a.length === 0) return ""
              return "Achievements: " + a.map(function(x){ return x.title }).join(" · ")
            }
            color: root.contentForeground
            opacity: 0.64
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.caption || Style.font.bodySmall
            wrapMode: Text.Wrap
            Layout.fillWidth: true
            horizontalAlignment: Text.AlignHCenter
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
