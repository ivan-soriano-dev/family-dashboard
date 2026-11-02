import { dateInZone, monday, shiftDate, weekDays } from "./menu-model";

describe("weekly menu dates", () => {
  it("finds Monday across months, years and daylight-saving changes", () => {
    expect(monday("2027-01-03")).toBe("2026-12-28");
    expect(monday("2026-11-02")).toBe("2026-11-02");
    expect(monday("2026-10-25")).toBe("2026-10-19");
    expect(shiftDate("2026-12-28", 7)).toBe("2027-01-04");
  });
  it("shows exactly nine meals over seven days", () => {
    const days = weekDays("2026-11-02");
    expect(days.map((d) => d.date)).toEqual([
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-07",
      "2026-11-08",
    ]);
    expect(days.flatMap((d) => d.meals)).toHaveLength(9);
    expect(days.slice(0, 5).every((d) => d.meals.join() === "dinner")).toBe(
      true,
    );
    expect(days.slice(5).every((d) => d.meals.join() === "lunch,dinner")).toBe(
      true,
    );
  });
  it("uses the family time zone at the week boundary", () => {
    expect(dateInZone(new Date("2026-11-01T23:30:00Z"), "Europe/Madrid")).toBe(
      "2026-11-02",
    );
  });
});
