import type { CallParticipant, CallTrackSource, CallMediaTrack } from "./call-media-session";

export function visibleCallTrack(person: Pick<CallParticipant, "getTrackPublication"> | undefined, source: CallTrackSource): CallMediaTrack | undefined {
  const publication = person?.getTrackPublication(source);
  return publication && !publication.isMuted ? publication.track : undefined;
}

export function selectCallVideo<T>(remoteScreen: T | undefined, localScreen: T | undefined, remoteCamera: T | undefined) {
  return {
    main: remoteScreen ?? localScreen ?? remoteCamera,
    screen: Boolean(remoteScreen ?? localScreen),
    local: !remoteScreen && Boolean(localScreen),
    secondary: (remoteScreen || localScreen) ? remoteCamera : undefined,
    localPreview: remoteScreen ? localScreen : undefined,
  };
}

export function screenShareError(error: unknown): string | null {
  const name = error && typeof error === "object" && "name" in error ? error.name : "";
  if (name === "NotAllowedError" || name === "AbortError") return null;
  if (name === "NotReadableError") return "Не удалось захватить экран. Проверьте разрешение на запись экрана в настройках системы.";
  return "Не удалось начать демонстрацию экрана. Попробуйте выбрать другое окно.";
}
