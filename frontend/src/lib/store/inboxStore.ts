import { create } from "zustand";
import { EMAILS } from "@/data/emails";

/** Ids of the mission emails delivered together after E0 is read (D11). */
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
  /**
   * True as soon as the mission-batch delivery timer has been scheduled
   * (set synchronously, before the timer fires). Prevents `closeModal` from
   * scheduling the same batch again if the inbox is closed/reopened/closed
   * again inside the delay window.
   */
  missionsScheduled: boolean;
}

export interface InboxActions {
  /** Deliver E0. Call once on app mount. */
  deliverWelcome: () => void;
  openModal: () => void;
  closeModal: () => void;
  selectEmail: (emailId: string) => void;
  dismissConsoleHint: () => void;
}

const initialState: InboxState = {
  deliveredIds: [],
  unreadIds: [],
  isModalOpen: false,
  selectedEmailId: null,
  hasShownConsoleHint: false,
  isConsoleHintActive: false,
  missionsScheduled: false,
};

export const useInboxStore = create<InboxState & InboxActions>((set, get) => ({
  ...initialState,

  deliverWelcome: () => {
    if (get().deliveredIds.includes("E0")) return;
    set((state) => ({
      deliveredIds: [...state.deliveredIds, "E0"],
      unreadIds: [...state.unreadIds, "E0"],
    }));
  },

  openModal: () => set({ isModalOpen: true }),

  closeModal: () => {
    const { deliveredIds, unreadIds, missionsScheduled } = get();
    set({ isModalOpen: false, selectedEmailId: null });

    // First close after E0 was read triggers the mission batch (D11): all
    // three mission emails arrive together, no gating between them.
    const welcomeWasRead = deliveredIds.includes("E0") && !unreadIds.includes("E0");
    const missionsAlreadyDelivered = MISSION_EMAIL_IDS.some((id) => deliveredIds.includes(id));
    if (welcomeWasRead && !missionsAlreadyDelivered && !missionsScheduled) {
      // Flip the flag synchronously so a close/reopen/close within the delay
      // window can't schedule a second timer (deliveredIds/unreadIds only
      // reflect the batch once the timer below actually fires).
      set({ missionsScheduled: true });
      const delay = EMAILS.find((email) => email.id === "E1")?.arrivesAfter ?? 4000;
      setTimeout(() => {
        set((state) => {
          const newIds = MISSION_EMAIL_IDS.filter((id) => !state.deliveredIds.includes(id));
          if (newIds.length === 0) return state;
          return {
            deliveredIds: [...state.deliveredIds, ...newIds],
            unreadIds: [...state.unreadIds, ...newIds],
          };
        });
      }, delay);
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
  },

  dismissConsoleHint: () => set({ isConsoleHintActive: false }),
}));
