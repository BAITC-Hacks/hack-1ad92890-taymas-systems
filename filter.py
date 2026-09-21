#!/usr/bin/env python3
"""Фильтр алертов: из потока событий оставляем только critical."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent
EVENTS_FILE = ROOT / "data" / "events.json"


@dataclass(frozen=True)
class Event:
    message: str
    level: str


def load_events(path: Path = EVENTS_FILE) -> list[Event]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    return [Event(message=item["message"], level=item["level"]) for item in raw]


def critical_only(events: list[Event]) -> list[Event]:
    return [event for event in events if event.level == "critical"]


def render(events: list[Event], critical: list[Event]) -> str:
    width = 64
    lines = [
        "═" * width,
        "  ФИЛЬТР АЛЕРТОВ  (шум выкинут, остались critical)",
        "═" * width,
        "",
        f"всего событий: {len(events)}",
        "",
    ]
    for event in critical:
        lines.append(f"  ● {event.message}")
    lines.extend(
        [
            "",
            f"критичных {len(critical)}",
        ]
    )
    return "\n".join(lines)


def main() -> None:
    events = load_events()
    critical = critical_only(events)
    print(render(events, critical))


if __name__ == "__main__":
    main()
