import { CATEGORY_LABELS, TRANSPORT_METHOD_LABELS } from "@sugara/shared";

export const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export const TRANSPORT_METHOD_OPTIONS = Object.entries(TRANSPORT_METHOD_LABELS).map(
  ([value, label]) => ({
    value,
    label,
  }),
);
