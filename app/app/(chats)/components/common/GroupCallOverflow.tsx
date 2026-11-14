"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { PANEL_EASE } from "@/lib/client/panel-motion";
import { groupCallOverflowWindow, orderedGroupCallIds, promoteHiddenGroupSpeakers } from "@/lib/client/group-call-layout";
import { GroupCallParticipantTile } from "./GroupCallParticipantTile";
import { GroupCallParticipantStrip } from "./GroupCallParticipantStrip";
import type { GroupCallPerson } from "./GroupCallWindow";

export function GroupCallOverflow({ people, glass, readLevel, onSelect, onMenu }: { people: GroupCallPerson[]; glass: boolean; readLevel: (id: string) => number; onSelect: (id: string) => void; onMenu?: (id: string, anchor: HTMLElement) => void }) {
  const reduced = useReducedMotion();
  const viewport = useRef<HTMLDivElement>(null), speaking = useRef(new Set<string>()), scrollFrame = useRef(0);
  const [order, setOrder] = useState<string[]>([]), [position, setPosition] = useState({ top: 0, height: 400, width: 128 });
  const cardWidth = position.width >= 640 ? 136 : 104;
  const itemStep = cardWidth + 8;
  const idsKey = JSON.stringify(people.map(person => person.id));
  const speakersKey = JSON.stringify(people.filter(person => person.speaking && !person.muted).map(person => person.id));
  const ordered = useMemo(() => orderedGroupCallIds(people.map(person => person.id), order), [people, order]);
  const byId = useMemo(() => new Map(people.map(person => [person.id, person])), [people]);
  const { start, end } = groupCallOverflowWindow(ordered.length, position.top, position.height, itemStep);

  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const sync = () => setPosition(previous => {
      const top = node.scrollLeft, height = node.clientWidth, width = node.clientWidth;
      return previous.top === top && previous.height === height && previous.width === width ? previous : { top, height, width };
    });
    sync(); const observer = new ResizeObserver(sync); observer.observe(node);
    return () => { observer.disconnect(); cancelAnimationFrame(scrollFrame.current); };
  }, []);
  useEffect(() => {
    const active = new Set<string>(JSON.parse(speakersKey)), newcomers = [...active].filter(id => !speaking.current.has(id));
    speaking.current = active;
    if (!newcomers.length) return;
    const frame = requestAnimationFrame(() => {
      const node = viewport.current;
      if (!node) return;
      const top = node.scrollLeft, height = node.clientWidth, measuredRow = (node.clientWidth >= 640 ? 136 : 104) + 8;
      setOrder(previous => {
        const ids = orderedGroupCallIds(JSON.parse(idsKey), previous);
        const promoted = promoteHiddenGroupSpeakers(ids, newcomers, top, height, measuredRow);
        return promoted === ids ? previous : promoted;
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [idsKey, speakersKey]);

  const scroll = (node: HTMLDivElement) => { cancelAnimationFrame(scrollFrame.current); scrollFrame.current = requestAnimationFrame(() => setPosition({ top: node.scrollLeft, height: node.clientWidth, width: node.clientWidth })); };
  const cards = ordered.slice(start, end).map((id, offset) => {
    const person = byId.get(id)!, axis = (start + offset) * itemStep;
    const coordinates = { x: axis, y: 0 };
    return <motion.div key={id} data-group-call-overflow-person={id} className="absolute left-0 top-0" style={{ width: cardWidth }}
      initial={{ ...coordinates, opacity: 0 }} animate={{ ...coordinates, opacity: 1 }} exit={{ opacity: 0, transition: { duration: reduced ? 0 : .12 } }} transition={{ duration: reduced ? 0 : .28, ease: PANEL_EASE }}>
      <GroupCallParticipantTile person={person} compact glass={glass} readLevel={readLevel} onSelect={() => onSelect(id)} onMenu={onMenu} />
    </motion.div>;
  });
  return <GroupCallParticipantStrip kind="overflow" glass={glass} viewportRef={viewport} onScroll={scroll}>
    <div className="relative mx-auto shrink-0" style={{ width: Math.max(0, ordered.length * itemStep - 8), height: cardWidth * 11 / 16 }}><AnimatePresence initial={false}>{cards}</AnimatePresence></div>
  </GroupCallParticipantStrip>;
}
