from classify import classify
from filter import load_events

def bar(count, total, width=20):
    filled = round(count / total * width) if total else 0
    return "█" * filled + "░" * (width - filled)

def section(title, items, total):
    print(f"\n{title} — всего: {total}")
    for label, count in items.items():
        pct = round(count / total * 100) if total else 0
        print(f"  {label:<10}: {count}  ({pct}%)  {bar(count, total)}")

def main():
    tickets = classify()
    events = load_events()

    cats = {}
    for t in tickets:
        cats[t.category] = cats.get(t.category, 0) + 1

    levels = {}
    for e in events:
        levels[e.level] = levels.get(e.level, 0) + 1

    print("─" * 45)
    print("Статистика")
    section("Обращения", cats, len(tickets))
    section("Алерты", levels, len(events))
    print("\n" + "─" * 45)

if __name__ == "__main__":
    main()