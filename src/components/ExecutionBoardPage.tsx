import React, { useEffect, useMemo, useState } from "react";
import type { CompletionStatus, DB, Shift, ShiftActivity } from "../types";
import { NavBar } from "./NavBar";

const SHIFT_LABEL: Record<Shift["shiftType"], string> = {
  Frueh: "Frühschicht",
  Spaet: "Spätschicht",
  Nacht: "Nachtschicht",
};

type ExecutionBoardPageProps = {
  db: DB;
  setDB: (db: DB) => void;
  shift: Shift;
  onBack: () => void;
  onCompleteActivity: (shiftId: number, shiftActivityId: number) => void;
  onUndoCompleteActivity: (shiftId: number, shiftActivityId: number) => void;
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("de-DE", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatTimestamp(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(timestamp);
  }
}

function statusLabel(status: CompletionStatus): string {
  switch (status) {
    case "done":
      return "Erledigt";
    case "blocked":
      return "Blockiert";
    case "skipped":
      return "Übersprungen";
    default:
      return status;
  }
}

export function ExecutionBoardPage({
  db,
  setDB,
  shift,
  onBack,
  onCompleteActivity,
  onUndoCompleteActivity,
}: ExecutionBoardPageProps) {
  const dateLabel = formatDate(shift.date);

  const topLevelParents = useMemo(() => {
    return shift.shiftActivities
      .filter((a) => a.parentIdSnapshot === null)
      .sort((a, b) => a.sortOrderSnapshot - b.sortOrderSnapshot);
  }, [shift.shiftActivities]);

  const [selectedParentId, setSelectedParentId] = useState<number | null>(() => {
    return topLevelParents[0]?.id ?? null;
  });

  const firstLevelChildren = useMemo(() => {
    if (selectedParentId === null) return [];
    return shift.shiftActivities
      .filter((a) => a.parentIdSnapshot === selectedParentId)
      .sort((a, b) => a.sortOrderSnapshot - b.sortOrderSnapshot);
  }, [shift.shiftActivities, selectedParentId]);

  const [selectedChildId, setSelectedChildId] = useState<number | null>(null);
  const [noteText, setNoteText] = useState("");

  useEffect(() => {
    if (firstLevelChildren.length === 0) {
      setSelectedChildId(null);
      return;
    }

    const stillValid = firstLevelChildren.some((child) => child.id === selectedChildId);
    if (!stillValid) {
      setSelectedChildId(firstLevelChildren[0].id);
    }
  }, [firstLevelChildren, selectedChildId]);

  const visibleTasks = useMemo(() => {
    if (selectedChildId === null) return [];
    return shift.shiftActivities
      .filter((a) => a.parentIdSnapshot === selectedChildId)
      .sort((a, b) => a.sortOrderSnapshot - b.sortOrderSnapshot);
  }, [shift.shiftActivities, selectedChildId]);

  const completionsByShiftActivityId = useMemo(() => {
    return new Map(shift.completions.map((c) => [c.shiftActivityId, c]));
  }, [shift.completions]);

  const selectedParent =
    topLevelParents.find((p) => p.id === selectedParentId) ?? null;

  const selectedChild =
    firstLevelChildren.find((c) => c.id === selectedChildId) ?? null;

  const totalLeafTasks = useMemo(() => {
    const parentIds = new Set(
      shift.shiftActivities
        .map((a) => a.parentIdSnapshot)
        .filter((v): v is number => v !== null)
    );

    return shift.shiftActivities.filter((a) => !parentIds.has(a.id)).length;
  }, [shift.shiftActivities]);

  const doneCount = shift.completions.filter((c) => c.status === "done").length;
  const blockedCount = shift.completions.filter((c) => c.status === "blocked").length;
  const skippedCount = shift.completions.filter((c) => c.status === "skipped").length;

  const saveStatus = (activity: ShiftActivity, status: CompletionStatus) => {
    if (status === "done") {
      const existing = completionsByShiftActivityId.get(activity.id);

      if (existing?.status === "done") {
        onUndoCompleteActivity(shift.id, activity.id);
        return;
      }

      if (!existing) {
        onCompleteActivity(shift.id, activity.id);
        return;
      }
    }

    const existing = completionsByShiftActivityId.get(activity.id);

    const next: DB = {
      ...db,
      nextId: existing ? db.nextId : db.nextId + 1,
      shifts: db.shifts.map((s) => {
        if (s.id !== shift.id) return s;

        if (!existing) {
          return {
            ...s,
            completions: [
              ...s.completions,
              {
                id: db.nextId,
                shiftActivityId: activity.id,
                status,
                timestamp: Date.now(),
                note: "",
                imageData: null,
              },
            ],
          };
        }

        return {
          ...s,
          completions: s.completions.map((c) =>
            c.shiftActivityId === activity.id
              ? { ...c, status, timestamp: Date.now() }
              : c
          ),
        };
      }),
    };

    setDB(next);
  };

  const addShiftNote = (kind: Shift["notes"][number]["kind"]) => {
    const text = noteText.trim();
    if (!text) return;

    const next: DB = {
      ...db,
      nextId: db.nextId + 1,
      shifts: db.shifts.map((s) =>
        s.id === shift.id
          ? {
              ...s,
              notes: [
                ...s.notes,
                {
                  id: db.nextId,
                  text,
                  kind,
                  createdAt: Date.now(),
                },
              ],
            }
          : s
      ),
    };

    setDB(next);
    setNoteText("");
  };

  return (
    <>
      <NavBar active="board" onDashboardClick={onBack} />

      <main className="main dashboard-layout">
        <section className="card">
          <div className="row">
            <div>
              <h1 className="card-title">Ausführungsboard</h1>
              <p className="card-subtitle">
                {SHIFT_LABEL[shift.shiftType]} · {dateLabel} · CWID {shift.operator} · {shift.line}
              </p>
            </div>
            <div className="spacer" />
            <button className="btn-ghost" onClick={onBack}>
              ← Zurück
            </button>
          </div>
        </section>

        <section className="grid grid-3">
          <article className="kpi-card">
            <div className="kpi-label">Gesamtaufgaben</div>
            <div className="kpi-value">{totalLeafTasks}</div>
          </article>

          <article className="kpi-card">
            <div className="kpi-label">Erledigt</div>
            <div className="kpi-value">{doneCount}</div>
          </article>

          <article className="kpi-card">
            <div className="kpi-label">Offen / Blockiert / Übersprungen</div>
            <div className="kpi-value">
              {Math.max(totalLeafTasks - doneCount - blockedCount - skippedCount, 0)} / {blockedCount} / {skippedCount}
            </div>
          </article>
        </section>

        <section className="dashboard-grid">
          <article className="card">
            <h2 className="card-title">Bereiche</h2>
            <p className="card-subtitle">
              Wähle Primär oder Sekundär als Hauptbereich.
            </p>

            <div className="parent-list">
              {topLevelParents.map((parent) => (
                <button
                  key={parent.id}
                  type="button"
                  className={`parent-pill ${selectedParentId === parent.id ? "parent-pill--active" : ""}`}
                  onClick={() => setSelectedParentId(parent.id)}
                >
                  {parent.nameSnapshot}
                </button>
              ))}
            </div>

            <div style={{ marginTop: 16 }}>
              <h3 className="card-title" style={{ fontSize: 16 }}>
                {selectedParent ? selectedParent.nameSnapshot : "Kein Bereich ausgewählt"}
              </h3>
              <p className="card-subtitle">
                {selectedParent
                  ? "Wähle einen Unterbereich, um die Aufgaben zu sehen."
                  : "Wähle links einen Hauptbereich, um weiterzuarbeiten."}
              </p>

              {selectedParent && firstLevelChildren.length > 0 ? (
                <div className="parent-list">
                  {firstLevelChildren.map((child) => (
                    <button
                      key={child.id}
                      type="button"
                      className={`parent-pill ${selectedChildId === child.id ? "parent-pill--active" : ""}`}
                      onClick={() => setSelectedChildId(child.id)}
                    >
                      {child.nameSnapshot}
                    </button>
                  ))}
                </div>
              ) : selectedParent ? (
                <div className="card empty">
                  Keine Unterbereiche für diesen Bereich definiert.
                </div>
              ) : null}
            </div>
          </article>

          <article className="card">
            <h2 className="card-title">
              {selectedChild ? selectedChild.nameSnapshot : "Aufgaben"}
            </h2>
            <p className="card-subtitle">
              {selectedChild
                ? "Markiere Aufgaben als erledigt, blockiert oder übersprungen."
                : "Wähle links zuerst einen Unterbereich."}
            </p>

            {selectedChildId === null ? (
              <div className="card empty">Noch kein Unterbereich ausgewählt.</div>
            ) : visibleTasks.length === 0 ? (
              <div className="card empty">
                Keine Aufgaben für diesen Unterbereich definiert.
              </div>
            ) : (
              <div className="shift-list">
                {visibleTasks.map((task) => {
                  const completion = completionsByShiftActivityId.get(task.id);

                  return (
                    <div key={task.id} className="shift-card task-card">
                      <div className="shift-meta">
                        <div className="shift-date">{task.nameSnapshot}</div>
                        <div className="shift-sub">
                          {completion
                            ? `${statusLabel(completion.status)} · ${formatTimestamp(completion.timestamp)}`
                            : "Noch offen"}
                        </div>
                        {completion?.note ? (
                          <div className="shift-sub">Notiz: {completion.note}</div>
                        ) : null}
                      </div>

                      <div className="parent-list">
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => saveStatus(task, "done")}
                        >
                          {completion?.status === "done"
                            ? "Erledigt rückgängig"
                            : "Erledigt"}
                        </button>

                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => saveStatus(task, "blocked")}
                        >
                          Blockiert
                        </button>

                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => saveStatus(task, "skipped")}
                        >
                          Übersprungen
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </article>
        </section>

        <section className="card">
          <h2 className="card-title">Übergabe & Meldungen</h2>
          <p className="card-subtitle">
            Notizen für die nächste Schicht, Hinweise oder Warnungen.
          </p>

          <div className="field">
            <label className="label" htmlFor="shift-note">
              Neue Notiz
            </label>
            <textarea
              id="shift-note"
              className="input textarea"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={4}
              placeholder="Zum Beispiel: Material knapp, Kamera geprüft, Linie wartet auf Freigabe ..."
            />
          </div>

          <div className="parent-list" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="btn-primary"
              onClick={() => addShiftNote("handover")}
            >
              Als Übergabe speichern
            </button>

            <button
              type="button"
              className="btn-ghost"
              onClick={() => addShiftNote("warning")}
            >
              Als Warnung speichern
            </button>

            <button
              type="button"
              className="btn-ghost"
              onClick={() => addShiftNote("info")}
            >
              Als Info speichern
            </button>
          </div>

          <div className="shift-list" style={{ marginTop: 16 }}>
            {shift.notes.length === 0 ? (
              <div className="card empty">
                Noch keine Übergaben oder Meldungen erfasst.
              </div>
            ) : (
              [...shift.notes]
                .sort((a, b) => b.createdAt - a.createdAt)
                .map((note) => (
                  <div
                    key={note.id}
                    className={`shift-card note-card note-${note.kind}`}
                  >
                    <div className="shift-meta">
                      <div className="shift-date">
                        {note.kind === "handover"
                          ? "Übergabe"
                          : note.kind === "warning"
                          ? "Warnung"
                          : "Info"}
                      </div>
                      <div className="shift-sub">
                        {formatTimestamp(note.createdAt)}
                      </div>
                      <div className="shift-sub">{note.text}</div>
                    </div>
                  </div>
                ))
            )}
          </div>
        </section>
      </main>
    </>
  );
}
