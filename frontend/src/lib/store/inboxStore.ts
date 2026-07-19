import { create } from "zustand";
import { EMAILS } from "@/data/emails";
import { useMissionStore } from "@/lib/store/missionStore";
import { playSound } from "@/lib/sound/sounds";

/** Ids of the mission emails, in narrative order (used only as a fallback
 * list — actual delivery order comes from missionStore's queue). */
const MISSION_EMAIL_IDS = ["E1", "E2", "E3"];

export interface InboxState {
  /** Ids of emails delivered so far, in arrival order. */
  deliveredIds: string[];
  /** Ids of delivered emails not yet opened. */
  unreadIds: string[];
  isModalOpen: boolean;
  selectedEmailId: string | null;
  /** True once the console hint (D14) has been shown, so it only ever fires once. */
  hasShownConsoleHint: boolean;
  /** True while the console hint should be visibly glowing. */
  isConsoleHintActive: boolean;
}

export interface InboxActions {
  /** Deliver E0. Call once on app mount. */
  deliverWelcome: () => void;
  openModal: () => void;
  closeModal: () => void;
  selectEmail: (emailId: string) => void;
  dismissConsoleHint: () => void;
  /** Delivers the next mission email in missionStore's queue, if any. Called
   * on E0 close (queue start) and again whenever a mission completes
   * (ACU-60: replaces the old fixed setTimeout batch delivery). */
  deliverNextMission: () => void;
  /** Restores initial inbox state (used by restart-campaign, D15). */
  reset: () => void;
}

const initialState: InboxState = {
  deliveredIds: [],
  unreadIds: [],
  isModalOpen: false,
  selectedEmailId: null,
  hasShownConsoleHint: false,
  isConsoleHintActive: false,
};

export const useInboxStore = create<InboxState & InboxActions>((set, get) => ({
  ...initialState,

  deliverWelcome: () => {
    if (get().deliveredIds.includes("E0")) return;
    set((state) => ({
      deliveredIds: [...state.deliveredIds, "E0"],
      unreadIds: [...state.unreadIds, "E0"],
    }));
    playSound("mailArrive");
  },

  openModal: () => set({ isModalOpen: true }),

  closeModal: () => {
    const { deliveredIds, unreadIds } = get();
    set({ isModalOpen: false, selectedEmailId: null });

    // First close after E0 was read starts the mission delivery queue
    // (ACU-60): order is shuffled once, one mission delivered at a time.
    const welcomeWasRead = deliveredIds.includes("E0") && !unreadIds.includes("E0");
    const missionsAlreadyDelivered = MISSION_EMAIL_IDS.some((id) => deliveredIds.includes(id));
    if (welcomeWasRead && !missionsAlreadyDelivered) {
      const missionStore = useMissionStore.getState();
      if (!missionStore.queueStarted) {
        missionStore.startDeliveryQueue();
        get().deliverNextMission();
      }
      return;
    }

    // Guided hint (D14): after reading any mission email and closing the
    // inbox, show the console hint once.
    const readAnyMission = MISSION_EMAIL_IDS.some(
      (id) => deliveredIds.includes(id) && !unreadIds.includes(id),
    );
    if (readAnyMission && !get().hasShownConsoleHint) {
      set({ hasShownConsoleHint: true, isConsoleHintActive: true });
    }
  },

  selectEmail: (emailId) => {
    set((state) => ({
      selectedEmailId: emailId,
      unreadIds: state.unreadIds.filter((id) => id !== emailId),
    }));

    // Reading a mission email activates that mission (ACU-60): resource
    // damage/drain now starts as a consequence of the captain reading the
    // report, not silently when the email lands in the mailbox.
    const email = EMAILS.find((candidate) => candidate.id === emailId);
    if (email?.missionScenarioId) {
      useMissionStore.getState().activateMission(emailId);
    }
  },

  dismissConsoleHint: () => set({ isConsoleHintActive: false }),

  deliverNextMission: () => {
    const missionStore = useMissionStore.getState();
    const nextMissionId = missionStore.peekNextMissionId();
    if (!nextMissionId) return;
    if (get().deliveredIds.includes(nextMissionId)) return;
    missionStore.advanceQueue();
    set((state) => ({
      deliveredIds: [...state.deliveredIds, nextMissionId],
      unreadIds: [...state.unreadIds, nextMissionId],
    }));
    playSound("mailArrive");
  },

  reset: () => {
    set({ ...initialState });
  },
}));
