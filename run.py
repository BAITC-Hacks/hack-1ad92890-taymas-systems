#!/usr/bin/env python3
"""Запуск обоих кейсов подряд."""

from classify import classify, render as render_tickets
from filter import critical_only, load_events, render as render_alerts


def main() -> None:
    print(render_tickets(classify()))
    print()
    events = load_events()
    print(render_alerts(events, critical_only(events)))


if __name__ == "__main__":
    main()
