import type { Component, ComputedRef, VNode } from 'vue';
import type { ToastProps } from './index.ts';
import { computed, ref } from 'vue';

const TOAST_LIMIT = 5;
const TOAST_REMOVE_DELAY: number | null = null;

export type StringOrVNode = string | VNode | (() => VNode);

type ToasterToast = ToastProps & {
  id: string;
  title?: string;
  description?: StringOrVNode;
  action?: Component;
};

const actionTypes = {
  ADD_TOAST: 'ADD_TOAST',
  UPDATE_TOAST: 'UPDATE_TOAST',
  DISMISS_TOAST: 'DISMISS_TOAST',
  REMOVE_TOAST: 'REMOVE_TOAST',
} as const;

let count = 0;

function genId() {
  count = (count + 1) % Number.MAX_VALUE;
  return count.toString();
}

type ActionType = typeof actionTypes;

type Action =
  | {
      type: ActionType['ADD_TOAST'];
      toast: ToasterToast;
    }
  | {
      type: ActionType['UPDATE_TOAST'];
      toast: Partial<ToasterToast>;
    }
  | {
      type: ActionType['DISMISS_TOAST'];
      toastId?: ToasterToast['id'];
    }
  | {
      type: ActionType['REMOVE_TOAST'];
      toastId?: ToasterToast['id'];
    };

interface State {
  toasts: ToasterToast[];
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

function addToRemoveQueue(toastId: string) {
  if (toastTimeouts.has(toastId) || TOAST_REMOVE_DELAY === null) return;

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId);
    dispatch({ type: actionTypes.REMOVE_TOAST, toastId });
  }, TOAST_REMOVE_DELAY);

  toastTimeouts.set(toastId, timeout);
}

const state = ref<State>({
  toasts: [],
});

function dispatch(action: Action) {
  // biome-ignore lint/style/useDefaultSwitchClause: no
  switch (action.type) {
    case actionTypes.ADD_TOAST: {
      state.value.toasts = [action.toast, ...state.value.toasts].slice(0, TOAST_LIMIT);
      break;
    }

    case actionTypes.UPDATE_TOAST: {
      state.value.toasts = state.value.toasts.map((t) => (t.id === action.toast.id ? { ...t, ...action.toast } : t));
      break;
    }

    case actionTypes.DISMISS_TOAST: {
      const { toastId } = action;

      if (toastId) {
        addToRemoveQueue(toastId);
      } else {
        for (const toast of state.value.toasts) {
          addToRemoveQueue(toast.id);
        }
      }

      if (toastId === undefined) {
        state.value.toasts = state.value.toasts.map((t) => ({ ...t, open: false }));
      } else {
        state.value.toasts = state.value.toasts.map((t) => (t.id === toastId ? { ...t, open: false } : t));
      }
      break;
    }

    case actionTypes.REMOVE_TOAST: {
      if (action.toastId === undefined) state.value.toasts = [];
      else state.value.toasts = state.value.toasts.filter((t) => t.id !== action.toastId);

      break;
    }
  }
}

function useToast(): {
  toasts: ComputedRef<ToasterToast[]>;
  toast: (props: Toast) => { id: string; dismiss: () => void; update: (props: ToasterToast) => void };
  dismiss: (toastId?: string) => void;
} {
  return {
    toasts: computed(() => state.value.toasts),
    toast,
    dismiss: (toastId?: string) => {
      dispatch({ type: actionTypes.DISMISS_TOAST, toastId });
    },
  };
}

type Toast = Omit<ToasterToast, 'id'>;

function toast(props: Toast) {
  const id = genId();

  const update = (props: ToasterToast) =>
    dispatch({
      type: actionTypes.UPDATE_TOAST,
      toast: { ...props, id },
    });

  const dismiss = () => dispatch({ type: actionTypes.DISMISS_TOAST, toastId: id });

  dispatch({
    type: actionTypes.ADD_TOAST,
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open: boolean) => {
        if (!open) dismiss();
      },
    },
  });

  return {
    id,
    dismiss,
    update,
  };
}

export { toast, useToast };