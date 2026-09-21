#!/usr/bin/env python3
"""Классификатор обращений: справка / жалоба / другое + черновик ответа."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MESSAGES_FILE = ROOT / "data" / "messages.txt"

COMPLAINT_HINTS = (
    "очередь",
    "холодн",
    "пропал",
    "не работает",
    "сломан",
    "грязн",
    "wifi",
    "wi-fi",
    "wi‑fi",
)

INFO_HINTS = (
    "справка",
    "как получить",
    "где ",
    "парковк",
    "расписани",
    "как пройти",
    "график",
)

DRAFTS = {
    "справка": {
        "учёбы": (
            "Справку о месте учёбы можно заказать в деканате или в личном кабинете: "
            "«Документы» → «Заказать справку». Обычно готова в течение 1 рабочего дня."
        ),
        "парковк": (
            "Гостевая парковка — у главного входа, сектор P2. Въезд по временному "
            "пропуску на охране. Свободные места видны на табло у шлагбаума."
        ),
        "default": (
            "Это справочный вопрос. Напишите, пожалуйста, уточнение — подскажем "
            "точный кабинет, ссылку или график."
        ),
    },
    "жалоба": {
        "столов": (
            "Спасибо, что сообщили. Передаём замечание в комбинат питания: проверим "
            "температуру блюд и организацию очереди. Если есть детали (время, корпус) — пришлите."
        ),
        "wi": (
            "Заявку приняли: Wi‑Fi в корпусе B. Передаём в IT-службу, обычно "
            "восстановление занимает до 30 минут. Если не заработает — напишите номер аудитории."
        ),
        "default": (
            "Приняли обращение как жалобу. Передадим ответственным и вернёмся "
            "со статусом, как только будет обновление."
        ),
    },
    "другое": {
        "консультац": (
            "Запись на консультацию: напишите удобный слот и тему вопроса. "
            "На завтра есть окна в 10:00, 14:00 и 16:30 — подтвердим сразу после выбора."
        ),
        "default": (
            "Приняли запрос. Уточните, пожалуйста, чего именно не хватает — "
            "подберём нужный отдел и ответ."
        ),
    },
}


@dataclass(frozen=True)
class Ticket:
    number: int
    text: str
    category: str
    draft: str


def categorize(text: str) -> str:
    lowered = text.lower()
    if any(hint in lowered for hint in COMPLAINT_HINTS):
        return "жалоба"
    if any(hint in lowered for hint in INFO_HINTS):
        return "справка"
    return "другое"


def draft_for(text: str, category: str) -> str:
    lowered = text.lower()
    variants = DRAFTS[category]
    for hint, reply in variants.items():
        if hint != "default" and hint in lowered:
            return reply
    return variants["default"]


def load_messages(path: Path = MESSAGES_FILE) -> list[str]:
    lines = path.read_text(encoding="utf-8").splitlines()
    return [line.strip() for line in lines if line.strip()]


def classify_text(text: str, number: int = 0) -> Ticket:
    cleaned = text.strip()
    category = categorize(cleaned)
    return Ticket(
        number=number,
        text=cleaned,
        category=category,
        draft=draft_for(cleaned, category),
    )


def classify(path: Path = MESSAGES_FILE) -> list[Ticket]:
    return [
        classify_text(text, number=index)
        for index, text in enumerate(load_messages(path), start=1)
    ]


def ticket_payload(ticket: Ticket) -> dict[str, str | int]:
    return {
        "id": ticket.number,
        "text": ticket.text,
        "category": ticket.category,
        "draft": ticket.draft,
    }


def render(tickets: list[Ticket]) -> str:
    width = 64
    lines = [
        "═" * width,
        "  КЛАССИФИКАТОР ОБРАЩЕНИЙ",
        "═" * width,
        "",
    ]
    for ticket in tickets:
        lines.extend(
            [
                f"[{ticket.number}] {ticket.text}",
                f"    категория: {ticket.category}",
                f"    черновик:  {ticket.draft}",
                "",
            ]
        )
    counts = {}
    for ticket in tickets:
        counts[ticket.category] = counts.get(ticket.category, 0) + 1
    summary = " · ".join(f"{name}: {counts[name]}" for name in ("справка", "жалоба", "другое") if name in counts)
    lines.append(f"итого: {len(tickets)} обращений ({summary})")
    return "\n".join(lines)


def main() -> None:
    print(render(classify()))


if __name__ == "__main__":
    main()
