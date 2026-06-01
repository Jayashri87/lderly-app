import {
  appStateSchema,
  type AppStateInput,
  type AuthStateInput,
  type BookingStepInput,
  type CareStateInput,
  type CustomerTabInput
} from "./schemas";

export type AppAction =
  | { type: "SET_SESSION"; user: AuthStateInput["user"]; ready: boolean; sessionId?: string | null }
  | { type: "SET_ACTIVE_TAB"; tab: CustomerTabInput }
  | { type: "OPEN_BOOKING"; step?: BookingStepInput }
  | { type: "CLOSE_BOOKING" }
  | { type: "SET_BOOKING_STEP"; step: BookingStepInput }
  | { type: "SET_CARE_STATE"; care: CareStateInput }
  | { type: "SET_CARE_ON_WAY"; careOnWay: boolean }
  | { type: "SET_SIDEBAR_OPEN"; sidebarOpen: boolean }
  | { type: "SET_DARK_MODE"; darkMode: boolean };

export const initialAppState: AppStateInput = {
  auth: {
    user: null,
    ready: false,
    sessionId: null
  },
  care: {
    type: "idle",
    data: null
  },
  ui: {
    activeTab: "home",
    bookingOpen: false,
    bookingStep: "need",
    careOnWay: false,
    sidebarOpen: false,
    darkMode: true
  }
};

export function appReducer(state: AppStateInput, action: AppAction): AppStateInput {
  const nextState = (() => {
    switch (action.type) {
      case "SET_SESSION":
        return {
          ...state,
          auth: {
            ...state.auth,
            user: action.user,
            ready: action.ready,
            sessionId: action.sessionId ?? state.auth.sessionId
          }
        };

      case "SET_ACTIVE_TAB":
        return {
          ...state,
          ui: {
            ...state.ui,
            activeTab: action.tab
          }
        };

      case "OPEN_BOOKING":
        return {
          ...state,
          ui: {
            ...state.ui,
            bookingOpen: true,
            bookingStep: action.step ?? "need"
          }
        };

      case "CLOSE_BOOKING":
        return {
          ...state,
          ui: {
            ...state.ui,
            bookingOpen: false
          }
        };

      case "SET_BOOKING_STEP":
        return {
          ...state,
          ui: {
            ...state.ui,
            bookingStep: action.step
          }
        };

      case "SET_CARE_STATE":
        return {
          ...state,
          care: action.care
        };

      case "SET_CARE_ON_WAY":
        return {
          ...state,
          ui: {
            ...state.ui,
            careOnWay: action.careOnWay
          }
        };

      case "SET_SIDEBAR_OPEN":
        return {
          ...state,
          ui: {
            ...state.ui,
            sidebarOpen: action.sidebarOpen
          }
        };

      case "SET_DARK_MODE":
        return {
          ...state,
          ui: {
            ...state.ui,
            darkMode: action.darkMode
          }
        };
    }
  })();

  return appStateSchema.parse(nextState);
}
