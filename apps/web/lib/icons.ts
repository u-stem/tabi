import type { SpotCategory, TransportMethod } from "@tabi/shared";
import {
  Bed,
  Bus,
  Camera,
  Car,
  Footprints,
  MapPin,
  Plane,
  Ticket,
  Train,
  Utensils,
} from "lucide-react";

export const CATEGORY_ICONS: Record<SpotCategory, typeof Camera> = {
  sightseeing: Camera,
  restaurant: Utensils,
  hotel: Bed,
  transport: Train,
  activity: Ticket,
  other: MapPin,
};

export const TRANSPORT_ICONS: Record<TransportMethod, typeof Train> = {
  train: Train,
  bus: Bus,
  taxi: Car,
  walk: Footprints,
  car: Car,
  airplane: Plane,
};
