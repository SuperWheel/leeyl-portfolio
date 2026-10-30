// The plugin's own style sheets, installed exactly as its client entry (src/client/index.tsx) does.
import {
  styles,
  nativeChatStyles,
  modelPickerStyles,
  telemetryStyles,
  processStyles,
  contextInspectionStyles,
  nativeInteractionStyles,
  hoverFeedbackStyles,
  conversationInteractionStyles,
  settingsStyles,
  rolePresetStyles,
} from 'cwn-src/client/styles.ts'
import { workerManagementStyles } from 'cwn-src/client/management-styles.ts'
import { renameCopyStyles } from 'cwn-src/client/rename-copy-styles.ts'
import { reasoningRecordsStyles } from 'cwn-src/client/harness-reasoning-records.tsx'
import { workerGoalStyles } from 'cwn-src/client/harness-worker-goal.tsx'
import { installNativeJobOverlay } from 'cwn-src/client/native-job-overlay.ts'

export function installPluginStyles() {
  const style = document.createElement('style')
  style.dataset.source = 'dsh-cliworker-now'
  style.textContent =
    styles +
    nativeChatStyles +
    modelPickerStyles +
    telemetryStyles +
    nativeInteractionStyles +
    hoverFeedbackStyles +
    conversationInteractionStyles +
    settingsStyles +
    rolePresetStyles +
    workerManagementStyles +
    renameCopyStyles +
    processStyles +
    contextInspectionStyles +
    reasoningRecordsStyles +
    workerGoalStyles
  document.head.append(style)
  installNativeJobOverlay(document)
}
