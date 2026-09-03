import * as Speech from "expo-speech";
import type { Coord } from "@/src/circuits";

const EARTH_RADIUS_M = 6371000;
const ANNOUNCE_DISTANCE_M = 50; // distance à laquelle on annonce le virage
const REACHED_DISTANCE_M = 15; // distance pour considérer qu'on a atteint le point
const TURN_ANGLE_THRESHOLD_DEG = 20; // en dessous, on considère que c'est tout droit

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}
function toDeg(rad: number) {
  return (rad * 180) / Math.PI;
}

function distanceM(a: Coord, b: Coord): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_M * c;
}

function bearingDeg(a: Coord, b: Coord): number {
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const dLon = toRad(b.longitude - a.longitude);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const brng = toDeg(Math.atan2(y, x));
  return (brng + 360) % 360;
}

function angleDiffDeg(a: number, b: number): number {
  let diff = b - a;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return diff;
}

type TurnDirection = "left" | "right" | "straight";

function turnLabel(direction: TurnDirection): string {
  if (direction === "left") return "à gauche";
  if (direction === "right") return "à droite";
  return "tout droit";
}

export class RouteGuide {
  private coords: Coord[];
  private currentIndex = 0;
  private announcedIndex = -1;
  private reachedIndex = -1;

  constructor(coords: Coord[]) {
    this.coords = coords;
  }

  /** Appelé à chaque nouvelle position GPS reçue */
  update(position: Coord) {
    if (this.currentIndex >= this.coords.length - 1) return;

    const nextPoint = this.coords[this.currentIndex + 1];
    const distToNext = distanceM(position, nextPoint);

    // Annoncer le virage à venir
    if (
      distToNext <= ANNOUNCE_DISTANCE_M &&
      this.announcedIndex !== this.currentIndex
    ) {
      this.announceTurn(position, this.currentIndex);
      this.announcedIndex = this.currentIndex;
    }

    // Passer au segment suivant si on a atteint le point
    if (
      distToNext <= REACHED_DISTANCE_M &&
      this.reachedIndex !== this.currentIndex
    ) {
      this.reachedIndex = this.currentIndex;
      this.currentIndex += 1;
    }
  }

  private announceTurn(position: Coord, index: number) {
    const current = this.coords[index];
    const next = this.coords[index + 1];
    const afterNext = this.coords[index + 2];

    if (!afterNext) {
      // Dernier segment : pas de virage à annoncer, juste la fin
      Speech.speak("Vous approchez de la fin du circuit.", { language: "fr-FR" });
      return;
    }

    const bearingIn = bearingDeg(current, next);
    const bearingOut = bearingDeg(next, afterNext);
    const diff = angleDiffDeg(bearingIn, bearingOut);

    let direction: TurnDirection = "straight";
    if (diff > TURN_ANGLE_THRESHOLD_DEG) direction = "right";
    else if (diff < -TURN_ANGLE_THRESHOLD_DEG) direction = "left";

    const distance = Math.round(distanceM(position, next));
    const message =
      direction === "straight"
        ? `Continuez tout droit sur ${distance} mètres.`
        : `Tournez ${turnLabel(direction)} dans ${distance} mètres.`;

    Speech.speak(message, { language: "fr-FR" });
  }

  /** Réinitialise le guide (par exemple au redémarrage d'une course) */
  reset() {
    this.currentIndex = 0;
    this.announcedIndex = -1;
    this.reachedIndex = -1;
  }
}
