import type { SessionRecord } from "../types";

// Used only by the explicit development preview; never saved to user history.
export function reportPreviewRecords(today: Date): SessionRecord[] {
  const records: SessionRecord[] = [];
  for (let day = 0; day < 370; day++) {
    const count = day % 9 === 5 ? 0 : 3 + day % 5;
    for (let index = 0; index < count; index++) {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - day, 9 + index * 2, 20);
      const skipped = (day + index) % 7 === 3;
      const rest = skipped && index % 2 === 1;
      records.push({
        id: `preview-${day}-${index}`,
        title: ["梳理产品方案", "阅读与思考", "完成今天的重要任务", "整理设计细节"][index % 4],
        note: index === 0 ? "留一点时间，把重要的事情做好。" : "",
        mode: rest ? "rest" : "focus",
        durationMinutes: rest ? 5 : 25 + index % 3 * 10,
        elapsedSeconds: skipped ? 240 + index * 63 : (25 + index % 3 * 10) * 60,
        outcome: skipped ? "skipped" : "completed",
        completedAt: date.toISOString(),
      });
    }
  }
  return records;
}
